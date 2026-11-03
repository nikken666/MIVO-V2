-- =====================================================================
-- MIVO checkout per shop (marketplace style)
-- Run once in Supabase → SQL Editor, AFTER seller-centre.sql. Safe to re-run.
--
-- Each shop packs and ships its own parcel, so the buyer chooses a courier
-- per shop and pays each shop's shipping. This builds on the existing
-- quote_shipping_options() and create_pending_order() (unchanged):
--   * quote_shipping_by_shop()   quotes every shop's items separately.
--   * create_pending_order_by_shop() creates the order as before, then sets
--     the order's shipping to the sum of the chosen per-shop quotes and
--     records each shop's courier (sellers must ship with that courier).
-- The website falls back to the old single-courier checkout until this runs.
-- =====================================================================

begin;

alter table public.seller_orders add column if not exists buyer_courier_code text;
alter table public.seller_orders add column if not exists buyer_courier_name text;
alter table public.seller_orders add column if not exists buyer_shipping_fee numeric(12,2);

-- Rows of quote_shipping_options() as a jsonb array, whatever its return type.
create or replace function public.mivo_quote_options(p_items jsonb, p_state text, p_postcode text)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare
  v_set boolean;
  v_result jsonb;
begin
  select p.proretset into v_set
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'public' and p.proname = 'quote_shipping_options'
   limit 1;
  if v_set then
    execute 'select coalesce(jsonb_agg(to_jsonb(q)), ''[]''::jsonb) from public.quote_shipping_options($1, $2, $3) q'
      into v_result using p_items, p_state, p_postcode;
  else
    execute 'select to_jsonb(public.quote_shipping_options($1, $2, $3))'
      into v_result using p_items, p_state, p_postcode;
  end if;
  return coalesce(v_result, '[]'::jsonb);
end;
$$;

-- Shipping options for each shop's parcel.
create or replace function public.quote_shipping_by_shop(p_items jsonb, p_state text, p_postcode text)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare
  v_group record;
  v_out jsonb := '[]'::jsonb;
begin
  for v_group in
    select v.seller_id, s.shop_name, s.tier,
           jsonb_agg(jsonb_build_object('variant_id', v.id, 'quantity', (i ->> 'quantity')::int)) as items
      from jsonb_array_elements(coalesce(p_items, '[]'::jsonb)) i
      join public.product_variants v on v.id = (i ->> 'variant_id')::uuid
      join public.sellers s on s.id = v.seller_id
     group by v.seller_id, s.shop_name, s.tier
     order by (s.tier = 'direct') desc, s.shop_name
  loop
    v_out := v_out || jsonb_build_array(jsonb_build_object(
      'seller_id', v_group.seller_id,
      'shop_name', v_group.shop_name,
      'tier', v_group.tier,
      'options', public.mivo_quote_options(v_group.items, p_state, p_postcode)
    ));
  end loop;
  return v_out;
end;
$$;

-- Create the order with a courier per shop. p_couriers: {"<seller_id>": "<courier_code>", ...}
create or replace function public.create_pending_order_by_shop(
  p_items jsonb,
  p_shipping_address jsonb,
  p_customer_note text default null,
  p_voucher_id uuid default null,
  p_couriers jsonb default '{}'::jsonb
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
begin
  if auth.uid() is null then raise exception 'Please sign in'; end if;

  v_quotes := public.quote_shipping_by_shop(p_items, p_shipping_address ->> 'state', p_shipping_address ->> 'postcode');
  if jsonb_array_length(v_quotes) = 0 then raise exception 'Your cart is empty'; end if;

  -- Validate one courier per shop and add up shipping.
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
  end loop;

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
         discount_amount = v_discount,
         total_amount = greatest(0, coalesce(subtotal, 0) + v_shipping - v_discount),
         updated_at = now()
   where id = v_order.id;

  -- Remember each shop's courier and shipping fee on its parcel.
  for v_shop in select * from jsonb_array_elements(v_quotes) loop
    v_code := p_couriers ->> (v_shop ->> 'seller_id');
    v_choice := null;
    select o into v_choice from jsonb_array_elements(v_shop -> 'options') o
     where o ->> 'courier_code' = v_code limit 1;
    update public.seller_orders
       set buyer_courier_code = v_code,
           buyer_courier_name = v_choice ->> 'courier_name',
           buyer_shipping_fee = (v_choice ->> 'shipping_amount')::numeric
     where order_id = v_order.id and seller_id = (v_shop ->> 'seller_id')::uuid;
  end loop;

  return v_result || jsonb_build_object(
    'shipping_amount', v_shipping,
    'discount_amount', v_discount,
    'total_amount', greatest(0, coalesce(v_order.subtotal, 0) + v_shipping - v_discount)
  );
end;
$$;

revoke all on function public.mivo_quote_options(jsonb, text, text) from public, anon;
revoke all on function public.quote_shipping_by_shop(jsonb, text, text) from public;
revoke all on function public.create_pending_order_by_shop(jsonb, jsonb, text, uuid, jsonb) from public, anon;
grant execute on function public.mivo_quote_options(jsonb, text, text) to authenticated;
grant execute on function public.quote_shipping_by_shop(jsonb, text, text) to anon, authenticated;
grant execute on function public.create_pending_order_by_shop(jsonb, jsonb, text, uuid, jsonb) to authenticated;

-- Seller Centre: include the courier the buyer chose for each parcel.
drop function if exists public.seller_parcels(uuid);
create function public.seller_parcels(p_seller_id uuid default null)
returns table (
  seller_order_id uuid, seller_id uuid, order_number text, order_status text, payment_status text,
  parcel_status text, subtotal numeric, shipping_address jsonb, customer_note text, created_at timestamptz,
  paid_at timestamptz, courier_name text, tracking_number text, buyer_courier_name text)
language sql stable security definer set search_path = public as $$
  select so.id, so.seller_id, o.order_number, o.status, o.payment_status,
         greatest_status.status, so.subtotal, so.shipping_address, so.customer_note, o.created_at,
         o.paid_at, sh.courier_name, sh.tracking_number,
         coalesce(so.buyer_courier_name, o.shipping_address ->> 'shipping_courier_name', o.shipping_address ->> 'courier_name')
    from public.seller_orders so
    join public.orders o on o.id = so.order_id
    cross join lateral (
      select case
        when public.mivo_fulfilment_rank(so.status) >= public.mivo_fulfilment_rank(o.status) then so.status
        else o.status end as status
    ) greatest_status
    left join lateral (
      select courier_name, tracking_number from public.shipments s
       where s.seller_order_id = so.id order by s.created_at limit 1
    ) sh on true
   where so.seller_id in (select public.my_shop_ids())
     and (p_seller_id is null or so.seller_id = p_seller_id)
   order by o.created_at desc
   limit 500;
$$;
grant execute on function public.seller_parcels(uuid) to authenticated;

commit;

-- Make new functions available to the website immediately.
notify pgrst, 'reload schema';

-- Couriers are not shown to buyers: the shop (or EasyParcel) picks one when
-- the order is arranged. buyer_courier_* only records what shipping was priced at.
-- Remove the earlier courier lock if it was installed.
begin;
drop trigger if exists mivo_lock_buyer_courier on public.shipments;
drop function if exists public.mivo_lock_buyer_courier();
commit;

notify pgrst, 'reload schema';
