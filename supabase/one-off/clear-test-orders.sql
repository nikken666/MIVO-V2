-- =====================================================================
-- ONE-OFF: clear test orders before going live.
--
-- You can run the whole file at once. STEP 1 only shows numbers; STEP 2
-- does the work inside one transaction (if anything fails, nothing changes).
--
-- What STEP 2 does:
--   * Gives back stock that the test orders were holding ("reserved").
--   * Deletes the orders. Everything attached to them goes too (shop parcels,
--     items, payments, shipments, status history, voucher uses, returns,
--     warranty claims, reviews on those orders).
--   * Products, shops, customers, vouchers and campaigns are NOT touched.
--
-- By default EVERY order is cleared (the shop isn't open yet). To keep some,
-- change the line marked "<-- choose orders", e.g.
--   where o.created_at < '2026-11-05'
-- =====================================================================

-- ------------------------------------------------------------ STEP 1: look
select
  (select count(*) from public.orders)                                         as orders_now,
  (select count(*) from public.orders o where o.payment_status::text = 'paid') as of_which_paid;

-- Tables that point at orders, and what happens to them (c = deleted with the order).
select conrelid::regclass as table_name, confrelid::regclass as points_at, confdeltype as on_delete
  from pg_constraint
 where contype = 'f'
   and confrelid in ('public.orders'::regclass, 'public.seller_orders'::regclass)
 order by 2, 1;


-- ------------------------------------------------------------ STEP 2: clear
begin;

create temporary table mivo_test_orders on commit drop as
  select o.id from public.orders o
   where true;                                   -- <-- choose orders

do $$
declare
  r record;
  has_reservations boolean := to_regclass('public.inventory_reservations') is not null;
  has_group boolean := exists (select 1 from information_schema.columns
                                where table_schema = 'public' and table_name = 'product_variants'
                                  and column_name = 'stock_group');
  has_reserved boolean := exists (select 1 from information_schema.columns
                                   where table_schema = 'public' and table_name = 'product_variants'
                                     and column_name = 'stock_reserved');
begin
  -- 1) Stock still held by these orders goes back on sale (newer databases only).
  if has_reservations and to_regprocedure('public.mivo_release_reservations(uuid)') is not null then
    for r in execute 'select distinct order_id from public.inventory_reservations
                       where status = ''reserved'' and order_id in (select id from mivo_test_orders)' loop
      perform public.mivo_release_reservations(r.order_id);
    end loop;
  end if;

  -- 2) Delete. Child rows go with it (on delete cascade).
  delete from public.orders where id in (select id from mivo_test_orders);

  -- 3) Fix "reserved" counts so nothing stays held by a deleted order.
  if has_reserved then
    perform set_config('mivo.skip_stock_sync', 'on', true);
    if has_reservations then
      -- Count what live orders still hold (repeated SKUs share one count).
      execute format($q$
        with held as (
          select %1$s as k, sum(r.quantity)::int as qty
            from public.inventory_reservations r join public.product_variants v on v.id = r.variant_id
           where r.status = 'reserved'
           group by 1
        )
        update public.product_variants v
           set stock_reserved = coalesce(h.qty, 0), updated_at = now()
          from public.product_variants v2
          left join held h on h.k = %2$s
         where v2.id = v.id and v.stock_reserved <> coalesce(h.qty, 0)$q$,
        case when has_group then 'coalesce(v.stock_group, v.id::text)' else 'v.id::text' end,
        case when has_group then 'coalesce(v2.stock_group, v2.id::text)' else 'v2.id::text' end);
    elsif not exists (select 1 from public.orders) then
      -- No orders left at all, so nothing can be reserved.
      update public.product_variants set stock_reserved = 0, updated_at = now() where stock_reserved <> 0;
    end if;
    perform set_config('mivo.skip_stock_sync', 'off', true);
  end if;
end;
$$;

select (select count(*) from public.orders) as orders_left;

commit;
