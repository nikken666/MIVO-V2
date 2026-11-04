-- =====================================================================
-- ONE-OFF: clear test orders before going live.
--
-- Run STEP 1 by itself first and look at the numbers.
-- Then run STEP 2 (the whole block from "begin;" to "commit;").
--
-- What STEP 2 does:
--   * Gives back stock that unpaid or unshipped test orders were holding.
--   * Deletes the orders. Everything attached to them goes too: shop parcels,
--     items, payments, shipments and tracking, status history, voucher uses,
--     returns, warranty claims, and reviews written on those orders.
--   * Products, shops, customers, vouchers and campaigns are NOT touched.
--
-- By default EVERY order is cleared (the shop isn't open yet). To keep some,
-- change the WHERE line marked "<-- choose orders" in both steps,
-- e.g. where o.created_at < '2026-11-05'.
-- =====================================================================

-- ------------------------------------------------------------ STEP 1: look
select
  (select count(*) from public.orders o where true /* <-- choose orders */)      as orders_to_delete,
  (select coalesce(sum(o.total_amount), 0) from public.orders o where true)      as their_total_rm,
  (select count(*) from public.orders o where o.payment_status::text = 'paid')   as of_which_paid,
  (select count(*) from public.inventory_reservations r
     where r.status = 'reserved' and r.order_id in (select o.id from public.orders o where true)) as stock_holds_to_release;

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

-- 1) Stock still held by these orders goes back on sale.
do $$
declare r record;
begin
  for r in select distinct order_id from public.inventory_reservations
            where status = 'reserved' and order_id in (select id from mivo_test_orders) loop
    perform public.mivo_release_reservations(r.order_id);
  end loop;
end;
$$;

-- 2) Stock taken by test orders that were shipped is NOT added back here, because
--    your stock counts came from the Shopee import afterwards. If you want it back,
--    run this before commit:
--    select public.mivo_adjust_stock(variant_id, quantity, 0) from public.inventory_reservations
--     where status = 'fulfilled' and order_id in (select id from mivo_test_orders);

-- 3) Delete. Child rows go with it (on delete cascade).
delete from public.orders where id in (select id from mivo_test_orders);

-- 4) Fix any "reserved" count with no live order behind it. Repeated SKUs
--    (same stock_group) share one count, so it is worked out per group.
select set_config('mivo.skip_stock_sync', 'on', true);
with held as (
  select coalesce(v.stock_group, v.id::text) as k, sum(r.quantity)::int as qty
    from public.inventory_reservations r join public.product_variants v on v.id = r.variant_id
   where r.status = 'reserved'
   group by 1
)
update public.product_variants v
   set stock_reserved = coalesce(h.qty, 0), updated_at = now()
  from public.product_variants v2
  left join held h on h.k = coalesce(v2.stock_group, v2.id::text)
 where v2.id = v.id
   and v.stock_reserved <> coalesce(h.qty, 0);
select set_config('mivo.skip_stock_sync', 'off', true);

select (select count(*) from public.orders) as orders_left;

commit;
