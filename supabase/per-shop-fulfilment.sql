-- =====================================================================
-- MIVO per-shop fulfilment
-- Run once in Supabase → SQL Editor. Safe to re-run.
--
-- Checkout splits a cart into one seller_order per shop. Until now the
-- admin screens moved the whole order through processing → packed →
-- shipped → delivered with one tracking number. This adds a per-shop
-- step so each shop's parcel gets its own status and tracking.
--
-- The parent order follows the slowest shop. When the slowest shop
-- moves, the existing admin_update_order_fulfilment runs for the parent
-- order, so its effects (inventory, timestamps, status history) stay
-- exactly as for single-shop orders. Per-shop statuses and tracking are
-- snapshotted around that call and restored afterwards.
-- =====================================================================

begin;

-- Who may act for a shop: MIVO admins and the shop's owner (seller).
create or replace function public.mivo_can_manage_shop(p_seller_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select public.is_admin()
      or exists (select 1 from public.sellers s where s.id = p_seller_id and s.owner_id = auth.uid());
$$;
grant execute on function public.mivo_can_manage_shop(uuid) to authenticated;

create or replace function public.mivo_fulfilment_rank(p_status text)
returns integer
language sql
immutable
as $$
  select case p_status
    when 'paid' then 1
    when 'processing' then 2
    when 'packed' then 3
    when 'shipped' then 4
    when 'delivered' then 5
    else 0
  end;
$$;

create or replace function public.mivo_fulfilment_status(p_rank integer)
returns text
language sql
immutable
as $$
  select (array['paid', 'processing', 'packed', 'shipped', 'delivered'])[p_rank];
$$;

create or replace function public.admin_update_shop_fulfilment(
  p_seller_order_id uuid,
  p_status text,
  p_courier_name text default null,
  p_tracking_number text default null,
  p_tracking_url text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_seller_order public.seller_orders%rowtype;
  v_order public.orders%rowtype;
  v_parent_rank integer;
  v_current_rank integer;
  v_next_rank integer := public.mivo_fulfilment_rank(p_status);
  v_min_rank integer;
  v_shipment_id uuid;
  v_first_shipment record;
  v_seller_snapshot jsonb;
  v_shipment_snapshot jsonb;
  v_columns text;
  v_step integer;
  v_assignments text;
begin

  if v_next_rank < 2 then
    raise exception 'Unknown fulfilment status %', p_status;
  end if;

  select * into v_seller_order
  from public.seller_orders
  where id = p_seller_order_id
  for update;

  if not found then
    raise exception 'Shop order not found';
  end if;

  -- MIVO admins, or the seller who owns this shop.
  if not public.mivo_can_manage_shop(v_seller_order.seller_id) then
    raise exception 'Only MIVO or this shop can update its fulfilment';
  end if;

  select * into v_order
  from public.orders
  where id = v_seller_order.order_id
  for update;

  if v_order.payment_status <> 'paid' then
    raise exception 'Order % is not paid yet', v_order.order_number;
  end if;

  v_parent_rank := public.mivo_fulfilment_rank(v_order.status);
  if v_parent_rank = 0 then
    raise exception 'Order % is %, it cannot be fulfilled',
      v_order.order_number, v_order.status;
  end if;

  -- A shop is never behind its parent order (older orders were moved as a whole).
  v_current_rank := greatest(public.mivo_fulfilment_rank(v_seller_order.status), v_parent_rank);

  -- Forward only. Shipping may skip processing/packed, like the whole-order flow.
  if v_next_rank <= v_current_rank or (v_next_rank = 5 and v_current_rank < 4) then
    raise exception 'This shop parcel is %, it cannot move to %',
      public.mivo_fulfilment_status(v_current_rank), p_status;
  end if;

  if p_status = 'shipped' and (
    coalesce(btrim(p_courier_name), '') = '' or
    coalesce(btrim(p_tracking_number), '') = ''
  ) then
    raise exception 'Courier and tracking number are required';
  end if;

  -- 1. Move this shop's parcel.
  update public.seller_orders
     set status = p_status,
         updated_at = now()
   where id = v_seller_order.id;

  if p_status in ('shipped', 'delivered') then
    select id into v_shipment_id
    from public.shipments
    where seller_order_id = v_seller_order.id
    order by created_at
    limit 1;

    if p_status = 'shipped' then
      if v_shipment_id is null then
        insert into public.shipments
          (seller_order_id, courier_name, tracking_number, tracking_url, status)
        values
          (v_seller_order.id, btrim(p_courier_name), btrim(p_tracking_number),
           nullif(btrim(p_tracking_url), ''), 'in_transit');
      else
        update public.shipments
           set courier_name = btrim(p_courier_name),
               tracking_number = btrim(p_tracking_number),
               tracking_url = nullif(btrim(p_tracking_url), ''),
               status = 'in_transit'
         where id = v_shipment_id;
      end if;
    elsif v_shipment_id is not null then
      update public.shipments set status = 'delivered' where id = v_shipment_id;
    end if;
  end if;

  -- 2. The parent order follows its slowest active shop.
  select min(greatest(public.mivo_fulfilment_rank(so.status), v_parent_rank))
    into v_min_rank
  from public.seller_orders so
  where so.order_id = v_order.id
    and so.status not in ('cancelled', 'refunded');

  -- Sellers (not MIVO admins) can't run the admin order function: move the
  -- parent order directly and record each step in its history.
  if v_min_rank > v_parent_rank and not public.is_admin() then
    for v_step in (v_parent_rank + 1)..v_min_rank loop
      update public.orders set status = public.mivo_fulfilment_status(v_step), updated_at = now()
       where id = v_order.id;
      insert into public.order_status_history (order_id, old_status, new_status, note, changed_by)
      values (v_order.id, public.mivo_fulfilment_status(v_step - 1), public.mivo_fulfilment_status(v_step),
              'All shops reached this step', auth.uid());
    end loop;
  elsif v_min_rank > v_parent_rank then
    -- Snapshot per-shop state; the order-level function may overwrite it.
    select coalesce(jsonb_agg(jsonb_build_object('id', id, 'status', status)), '[]'::jsonb)
      into v_seller_snapshot
    from public.seller_orders
    where order_id = v_order.id;

    select coalesce(jsonb_agg(to_jsonb(sh)), '[]'::jsonb)
      into v_shipment_snapshot
    from public.shipments sh
    join public.seller_orders so on so.id = sh.seller_order_id
    where so.order_id = v_order.id;

    -- Pass the first shop's own tracking so a whole-order write changes nothing.
    select sh.courier_name, sh.tracking_number, sh.tracking_url
      into v_first_shipment
    from public.seller_orders so
    left join public.shipments sh on sh.seller_order_id = so.id
    where so.order_id = v_order.id
    order by so.created_at, sh.created_at
    limit 1;

    -- One step at a time, so the parent order passes through every status.
    for v_step in (v_parent_rank + 1)..v_min_rank loop
      perform public.admin_update_order_fulfilment(
        p_order_number => v_order.order_number,
        p_status => public.mivo_fulfilment_status(v_step),
        p_courier_name => case when v_step = 4 then v_first_shipment.courier_name end,
        p_tracking_number => case when v_step = 4 then v_first_shipment.tracking_number end,
        p_tracking_url => case when v_step = 4 then v_first_shipment.tracking_url end
      );
    end loop;

    -- Restore per-shop state.
    update public.seller_orders so
       set status = snap.status
      from jsonb_to_recordset(v_seller_snapshot) as snap(id uuid, status text)
     where so.id = snap.id
       and so.status is distinct from snap.status;

    -- Shipments: put back exactly the rows that existed before the call.
    delete from public.shipments sh
     using public.seller_orders so
     where so.id = sh.seller_order_id
       and so.order_id = v_order.id
       and not exists (
         select 1 from jsonb_to_recordset(v_shipment_snapshot) as snap(id uuid)
         where snap.id = sh.id
       );

    select string_agg(format('%I', c.column_name), ', ' order by c.ordinal_position),
           string_agg(format('%I = snap.%I', c.column_name, c.column_name), ', '
                      order by c.ordinal_position) filter (where c.column_name <> 'id')
      into v_columns, v_assignments
    from information_schema.columns c
    where c.table_schema = 'public'
      and c.table_name = 'shipments'
      and c.is_generated = 'NEVER'
      and c.identity_generation is distinct from 'ALWAYS';

    execute format(
      'update public.shipments sh set %s
         from jsonb_populate_recordset(null::public.shipments, $1) snap
        where sh.id = snap.id and to_jsonb(sh) is distinct from to_jsonb(snap)',
      v_assignments
    ) using v_shipment_snapshot;

    execute format(
      'insert into public.shipments (%1$s)
       select %1$s from jsonb_populate_recordset(null::public.shipments, $1) snap
        where not exists (select 1 from public.shipments sh where sh.id = snap.id)',
      v_columns
    ) using v_shipment_snapshot;
  end if;

  select status into v_order.status from public.orders where id = v_order.id;

  return jsonb_build_object(
    'order_number', v_order.order_number,
    'order_status', v_order.status,
    'shop_status', p_status
  );
end;
$$;

revoke all on function public.admin_update_shop_fulfilment(uuid, text, text, text, text)
  from public, anon;
grant execute on function public.admin_update_shop_fulfilment(uuid, text, text, text, text)
  to authenticated;

-- Mass-arrange shipment for individual shop parcels (multi-shop orders).
create or replace function public.admin_arrange_shop_shipments(
  p_seller_order_ids uuid[],
  p_arrangement_method text,
  p_pickup_date text default null,
  p_courier_name text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row record;
  v_shipment_id uuid;
  v_courier text;
  v_count integer := 0;
begin
  if p_arrangement_method not in ('drop_off', 'pickup') then
    raise exception 'Unknown arrangement method %', p_arrangement_method;
  end if;

  for v_row in
    select so.id, o.shipping_address
      from public.seller_orders so
      join public.orders o on o.id = so.order_id
     where so.id = any(p_seller_order_ids)
       and o.payment_status = 'paid'
       and o.status in ('paid', 'processing', 'packed', 'shipped')
       and public.mivo_fulfilment_rank(so.status) < 4
       and public.mivo_can_manage_shop(so.seller_id)
  loop
    v_courier := coalesce(
      nullif(btrim(p_courier_name), ''),
      nullif(v_row.shipping_address ->> 'shipping_courier_name', '')
    );

    select id into v_shipment_id
      from public.shipments
     where seller_order_id = v_row.id
     order by created_at
     limit 1;

    if v_shipment_id is null then
      insert into public.shipments
        (seller_order_id, courier_name, status, arrangement_method, pickup_date)
      values
        (v_row.id, v_courier, 'booked', p_arrangement_method,
         case when p_arrangement_method = 'pickup' then nullif(p_pickup_date, '')::date end);
    else
      update public.shipments
         set courier_name = coalesce(v_courier, courier_name),
             status = 'booked',
             arrangement_method = p_arrangement_method,
             pickup_date = case when p_arrangement_method = 'pickup'
                                then nullif(p_pickup_date, '')::date end
       where id = v_shipment_id;
    end if;
    v_count := v_count + 1;
  end loop;

  return jsonb_build_object('processed_count', v_count);
end;
$$;

revoke all on function public.admin_arrange_shop_shipments(uuid[], text, text, text)
  from public, anon;
grant execute on function public.admin_arrange_shop_shipments(uuid[], text, text, text)
  to authenticated;

commit;

-- Quick check after running (orders that span more than one shop):
--   select o.order_number, o.status, so.status as shop_status, s.shop_name
--     from public.orders o
--     join public.seller_orders so on so.order_id = o.id
--     join public.sellers s on s.id = so.seller_id
--    where o.id in (select order_id from public.seller_orders
--                    group by order_id having count(*) > 1)
--    order by o.created_at desc;
