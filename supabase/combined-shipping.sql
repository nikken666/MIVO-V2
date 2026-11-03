-- =====================================================================
-- MIVO: one parcel, one shipping fee for shops that ship from the same place.
-- Run after checkout-per-shop.sql and easyparcel.sql. Safe to re-run.
--
-- Shops of the same owner with the same pickup address form a "shipping
-- group". At checkout the group is priced as one parcel (combined weight),
-- the fee is charged once, and when one of its parcels ships, the others in
-- the same order ship with it under the same courier and tracking number.
-- =====================================================================

begin;

alter table public.seller_orders add column if not exists shipping_group text;

-- Same owner + same pickup address (spaces/case ignored) = one group.
create or replace function public.mivo_pickup_group(p_seller_id uuid)
returns text language sql stable security definer set search_path = public as $$
  select case
    when coalesce(s.pickup_address ->> 'postcode', '') = '' or coalesce(s.pickup_address ->> 'line', '') = ''
      then 'shop:' || s.id::text
    else coalesce(s.owner_id::text, 'none') || '|' || (s.pickup_address ->> 'postcode') || '|'
         || lower(regexp_replace(s.pickup_address ->> 'line', '[^a-zA-Z0-9]', '', 'g'))
  end
  from public.sellers s where s.id = p_seller_id;
$$;
revoke all on function public.mivo_pickup_group(uuid) from public, anon;
grant execute on function public.mivo_pickup_group(uuid) to authenticated, service_role;

-- Shipping options per parcel (a parcel = shops shipping from the same place).
create or replace function public.quote_shipping_by_shop(p_items jsonb, p_state text, p_postcode text)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare
  v_group record;
  v_out jsonb := '[]'::jsonb;
begin
  for v_group in
    with lines as (
      select v.id as variant_id, (i ->> 'quantity')::int as quantity, v.seller_id, s.shop_name, s.tier,
             public.mivo_pickup_group(v.seller_id) as grp
        from jsonb_array_elements(coalesce(p_items, '[]'::jsonb)) i
        join public.product_variants v on v.id = (i ->> 'variant_id')::uuid
        join public.sellers s on s.id = v.seller_id
    ), shops as (
      select distinct seller_id, shop_name, tier, grp from lines
    )
    select l.grp,
           (array_agg(sh.seller_id order by (sh.tier = 'direct') desc, sh.shop_name))[1] as lead_id,
           (select jsonb_agg(x.seller_id order by (x.tier = 'direct') desc, x.shop_name) from shops x where x.grp = l.grp) as seller_ids,
           (select string_agg(x.shop_name, ' · ' order by (x.tier = 'direct') desc, x.shop_name) from shops x where x.grp = l.grp) as names,
           (array_agg(sh.tier order by (sh.tier = 'direct') desc, sh.shop_name))[1] as tier,
           jsonb_agg(jsonb_build_object('variant_id', l.variant_id, 'quantity', l.quantity)) as items
      from lines l join shops sh on sh.seller_id = l.seller_id
     group by l.grp
     order by bool_or(sh.tier = 'direct') desc, min(sh.shop_name)
  loop
    v_out := v_out || jsonb_build_array(jsonb_build_object(
      'seller_id', v_group.lead_id,
      'seller_ids', v_group.seller_ids,
      'group', v_group.grp,
      'shop_name', v_group.names,
      'tier', v_group.tier,
      'options', public.mivo_quote_options(v_group.items, p_state, p_postcode)
    ));
  end loop;
  return v_out;
end;
$$;
grant execute on function public.quote_shipping_by_shop(jsonb, text, text) to anon, authenticated;

create or replace function public.create_pending_order_by_shop(
  p_items jsonb,
  p_shipping_address jsonb,
  p_customer_note text default null,
  p_voucher_id uuid default null,
  p_couriers jsonb default '{}'::jsonb,
  p_quote_id uuid default null
)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_quotes jsonb;
  v_shop jsonb;
  v_choice jsonb;
  v_code text;
  v_first_code text;
  v_shipping numeric := 0;
  v_result jsonb;
  v_order public.orders%rowtype;
  v_discount numeric;
  v_voucher record;
  v_live public.checkout_shipping_quotes%rowtype;
  v_fees jsonb := '[]'::jsonb;   -- [{seller_id, fee, courier_code, courier_name}]
  v_promo public.shipping_promotions%rowtype;
  v_subsidy numeric := 0;
begin
  if auth.uid() is null then raise exception 'Please sign in'; end if;

  v_quotes := public.quote_shipping_by_shop(p_items, p_shipping_address ->> 'state', p_shipping_address ->> 'postcode');
  if jsonb_array_length(v_quotes) = 0 then raise exception 'Your cart is empty'; end if;

  if p_quote_id is not null then
    -- Live EasyParcel prices quoted for this cart and address.
    select * into v_live from public.checkout_shipping_quotes
     where id = p_quote_id and user_id = auth.uid();
    if not found or v_live.expires_at < now() then
      raise exception 'Shipping price expired. Please refresh the checkout page.';
    end if;
    if v_live.items_key <> public.mivo_items_key(p_items)
       or v_live.postcode <> coalesce(p_shipping_address ->> 'postcode', '')
       or v_live.state <> coalesce(p_shipping_address ->> 'state', '') then
      raise exception 'Your cart or address changed. Please refresh the checkout page.';
    end if;
    for v_shop in select * from jsonb_array_elements(v_quotes) loop
      select q into v_choice from jsonb_array_elements(v_live.shops) q
       where q ->> 'seller_id' = v_shop ->> 'seller_id'
          or coalesce(q -> 'seller_ids', '[]'::jsonb) ? (v_shop ->> 'seller_id')
       limit 1;
      if v_choice is null then raise exception 'Shipping price missing for %', v_shop ->> 'shop_name'; end if;
      v_shipping := v_shipping + coalesce((v_choice ->> 'amount')::numeric, 0);
      v_fees := v_fees || jsonb_build_array(jsonb_build_object(
        'seller_id', v_shop ->> 'seller_id', 'seller_ids', coalesce(v_shop -> 'seller_ids', jsonb_build_array(v_shop ->> 'seller_id')),
        'group', v_shop ->> 'group', 'fee', (v_choice ->> 'amount')::numeric,
        'courier_code', v_choice ->> 'service_id', 'courier_name', v_choice ->> 'courier'));
      -- create_pending_order still needs one of MIVO's courier codes.
      v_first_code := coalesce(v_first_code, v_shop -> 'options' -> 0 ->> 'courier_code');
      v_choice := null;
    end loop;
  else
    -- MIVO's own shipping rules: one courier per shop.
    for v_shop in select * from jsonb_array_elements(v_quotes) loop
      v_code := p_couriers ->> (v_shop ->> 'seller_id');
      v_choice := null;
      select o into v_choice from jsonb_array_elements(v_shop -> 'options') o
       where o ->> 'courier_code' = v_code limit 1;
      if v_choice is null then
        raise exception 'Choose a courier for %', v_shop ->> 'shop_name';
      end if;
      v_first_code := coalesce(v_first_code, v_code);
      v_shipping := v_shipping + coalesce((v_choice ->> 'shipping_amount')::numeric, 0);
      v_fees := v_fees || jsonb_build_array(jsonb_build_object(
        'seller_id', v_shop ->> 'seller_id', 'seller_ids', coalesce(v_shop -> 'seller_ids', jsonb_build_array(v_shop ->> 'seller_id')),
        'group', v_shop ->> 'group', 'fee', (v_choice ->> 'shipping_amount')::numeric,
        'courier_code', v_code, 'courier_name', v_choice ->> 'courier_name'));
    end loop;
  end if;

  -- The existing checkout does stock, prices, vouchers and the order itself.
  v_result := public.create_pending_order(
    p_items,
    p_shipping_address || jsonb_build_object('courier_code', v_first_code, 'shop_couriers', p_couriers),
    p_customer_note,
    p_voucher_id
  );

  select * into v_order from public.orders
   where order_number = v_result ->> 'order_number' and user_id = auth.uid()
   for update;
  if not found then raise exception 'Order not found after checkout'; end if;

  -- MIVO free-shipping promotion: MIVO pays shipping (up to the cap) when the
  -- order reaches the minimum spend. The buyer pays only what's left.
  select * into v_promo from public.shipping_promotions
   where active and now() between starts_at and ends_at
   order by max_subsidy desc nulls first, min_spend limit 1;
  if found and coalesce(v_order.subtotal, 0) >= v_promo.min_spend then
    v_subsidy := least(v_shipping, coalesce(v_promo.max_subsidy, v_shipping));
  end if;
  v_shipping := v_shipping - v_subsidy;

  -- Free-shipping vouchers follow the new shipping total.
  v_discount := coalesce(v_order.discount_amount, 0);
  if v_order.voucher_code is not null then
    select discount_type, max_discount into v_voucher
      from public.vouchers where code = v_order.voucher_code limit 1;
    if found and v_voucher.discount_type = 'free_shipping' then
      v_discount := least(v_shipping, coalesce(nullif(v_voucher.max_discount, 0), v_shipping));
    end if;
  end if;

  update public.orders
     set shipping_amount = v_shipping,
         shipping_subsidy = v_subsidy,
         shipping_promotion_id = case when v_subsidy > 0 then v_promo.id end,
         discount_amount = v_discount,
         total_amount = greatest(0, coalesce(subtotal, 0) + v_shipping - v_discount),
         updated_at = now()
   where id = v_order.id;

  -- Shops that ship from the same address travel as one parcel: the fee sits
  -- on the first shop's parcel, the others are 0, and all share a group key
  -- so they ship together with one tracking number.
  for v_shop in select * from jsonb_array_elements(v_fees) loop
    update public.seller_orders
       set buyer_courier_code = v_shop ->> 'courier_code',
           buyer_courier_name = v_shop ->> 'courier_name',
           buyer_shipping_fee = case when seller_id = (v_shop ->> 'seller_id')::uuid then (v_shop ->> 'fee')::numeric else 0 end,
           shipping_group = case when jsonb_array_length(v_shop -> 'seller_ids') > 1 then v_shop ->> 'group' end
     where order_id = v_order.id
       and seller_id in (select (x)::uuid from jsonb_array_elements_text(v_shop -> 'seller_ids') x);
  end loop;

  if p_quote_id is not null then
    delete from public.checkout_shipping_quotes where id = p_quote_id or expires_at < now() - interval '1 day';
  end if;

  return v_result || jsonb_build_object(
    'shipping_amount', v_shipping,
    'shipping_subsidy', v_subsidy,
    'discount_amount', v_discount,
    'total_amount', greatest(0, coalesce(v_order.subtotal, 0) + v_shipping - v_discount)
  );
end;
$$;


revoke all on function public.create_pending_order_by_shop(jsonb, jsonb, text, uuid, jsonb, uuid) from public, anon;
grant execute on function public.create_pending_order_by_shop(jsonb, jsonb, text, uuid, jsonb, uuid) to authenticated;

-- When a parcel in a shipping group gets its tracking number, the other
-- parcels of that group in the same order ship with it.
create or replace function public.mivo_ship_group_together()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_so public.seller_orders%rowtype;
  v_sib record;
begin
  if coalesce(current_setting('mivo.group_ship', true), '') = 'on' then return new; end if;
  if coalesce(btrim(new.tracking_number), '') = '' then return new; end if;
  if tg_op = 'UPDATE' and old.tracking_number is not distinct from new.tracking_number then return new; end if;

  select * into v_so from public.seller_orders where id = new.seller_order_id;
  if not found or v_so.shipping_group is null then return new; end if;

  perform set_config('mivo.group_ship', 'on', true);
  for v_sib in
    select so.id from public.seller_orders so
     where so.order_id = v_so.order_id and so.shipping_group = v_so.shipping_group and so.id <> v_so.id
       and so.status::text not in ('shipped', 'delivered', 'completed', 'cancelled', 'refunded')
  loop
    begin
      perform public.admin_update_shop_fulfilment(v_sib.id, 'shipped', new.courier_name, new.tracking_number, new.tracking_url);
      update public.shipments s
         set provider = new.provider, awb_url = new.awb_url, label_urls = new.label_urls
       where s.seller_order_id = v_sib.id and s.tracking_number = new.tracking_number;
    exception when others then
      raise warning 'MIVO: could not ship parcel % with its group: %', v_sib.id, sqlerrm;
    end;
  end loop;
  perform set_config('mivo.group_ship', 'off', true);
  return new;
end;
$$;
revoke all on function public.mivo_ship_group_together() from public, anon, authenticated;
drop trigger if exists shipments_ship_group_together on public.shipments;
create trigger shipments_ship_group_together after insert or update of tracking_number on public.shipments
  for each row execute function public.mivo_ship_group_together();

commit;

notify pgrst, 'reload schema';
