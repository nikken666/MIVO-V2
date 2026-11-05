-- =====================================================================
-- Returns: the delivery fee refunded for a faulty item now comes from the
-- parcel it was shipped in (each shop charges its own delivery; shops that
-- ship together share one fee), scaled to what the buyer actually paid.
-- Before, it was a share of the whole order's delivery, so returning an
-- item from a free-shipping shop could refund another shop's delivery fee.
-- Older orders without per-shop fees keep the previous rule. Safe to re-run.
-- =====================================================================

begin;

create or replace function public.mivo_return_quote(p_order_id uuid, p_items jsonb, p_reason text)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare
  o public.orders%rowtype;
  v_items numeric := 0;
  v_goods numeric;
  v_share numeric;
  v_fault boolean;
  v_verified boolean;
  v_shipping numeric := 0;
  v_all_fees numeric := 0;
  v_fee numeric := 0;
  v_already numeric := 0;
  v_refund numeric;
begin
  select * into o from public.orders where id = p_order_id;
  if not found then raise exception 'Order not found'; end if;

  select coalesce(sum(oi.unit_price * least((x.value->>'quantity')::int, oi.quantity)), 0),
         bool_and(coalesce(s.tier, 'standard') = 'direct')
    into v_items, v_verified
  from jsonb_array_elements(p_items) x
  join public.order_items oi on oi.id = (x.value->>'order_item_id')::uuid and oi.order_id = o.id
  left join public.sellers s on s.id = oi.seller_id;

  -- Item price after the order's voucher discount.
  v_items := round(v_items * greatest(o.subtotal - coalesce(o.discount_amount, 0), 0) / nullif(o.subtotal, 0), 2);
  v_items := coalesce(v_items, 0);
  v_goods := greatest(o.total_amount - coalesce(o.shipping_amount, 0), 0);
  v_share := case when v_goods > 0 then least(v_items / v_goods, 1) else 0 end;

  v_fault := p_reason in ('wrong_item','damaged','defective','not_as_described','missing_parts','not_received')
          or (p_reason = 'does_not_fit' and coalesce(v_verified, false));

  if v_fault then
    -- Delivery fee of the parcel(s) the items came in (each shop ships and
    -- charges separately; shops shipping together share one fee), scaled to
    -- what the buyer actually paid for delivery (after free-shipping promos),
    -- in proportion to the part of that parcel being returned.
    select coalesce(sum(coalesce(so.buyer_shipping_fee, 0)), 0) into v_all_fees
      from public.seller_orders so where so.order_id = o.id;
    if v_all_fees > 0 then
      with returned as (
        select coalesce(so.shipping_group, so.id::text) as grp,
               sum(oi.unit_price * least((x.value->>'quantity')::int, oi.quantity)) as value
          from jsonb_array_elements(p_items) x
          join public.order_items oi on oi.id = (x.value->>'order_item_id')::uuid and oi.order_id = o.id
          join public.seller_orders so on so.id = oi.seller_order_id
         group by 1
      ), groups as (
        select coalesce(so.shipping_group, so.id::text) as grp,
               sum(coalesce(so.buyer_shipping_fee, 0)) as fee,
               sum(coalesce(so.subtotal, 0)) as goods
          from public.seller_orders so where so.order_id = o.id
         group by 1
      )
      select coalesce(sum(coalesce(o.shipping_amount, 0) * g.fee / v_all_fees
                          * least(r.value / nullif(g.goods, 0), 1)), 0)
        into v_shipping
        from returned r join groups g using (grp);
      v_shipping := round(coalesce(v_shipping, 0), 2);
    else
      v_shipping := round(coalesce(o.shipping_amount, 0) * v_share, 2);
    end if;
  else
    v_fee := round(coalesce(o.payment_processing_fee_amount, 0) * v_share, 2);
  end if;

  -- Never refund more than what is left of the order.
  select coalesce(sum(coalesce(final_amount, requested_amount)), 0) into v_already
  from public.return_requests
  where order_id = o.id and status in ('refunding','refunded');
  v_refund := least(greatest(v_items + v_shipping - v_fee, 0),
                    greatest(o.total_amount - coalesce(o.cancellation_refund_amount, 0) - v_already, 0));

  return jsonb_build_object(
    'seller_fault', v_fault, 'items_amount', v_items, 'shipping_refund', v_shipping,
    'fee_deduction', v_fee, 'refund_amount', v_refund, 'max_refund',
    greatest(o.total_amount - coalesce(o.cancellation_refund_amount, 0) - v_already, 0));
end;
$$;

revoke all on function public.mivo_return_quote(uuid, jsonb, text) from public, anon, authenticated;

commit;
