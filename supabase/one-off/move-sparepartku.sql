-- =====================================================================
-- One-off: move SPAREPARTKU MALAYSIA from oon.lz9696@gmail.com to MIVO.
-- Run once in Supabase → SQL Editor. Shows what it did at the end.
--
-- * If oonzhenlun@gmail.com already has a SPAREPARTKU shop: the other
--   shop's products move into it, then the other shop is deleted
--   (or, if it already has orders, closed instead so orders stay intact).
-- * If not: the shop itself is handed over to oonzhenlun@gmail.com, with
--   all its products, and oon.lz9696's application for it is removed.
-- =====================================================================

begin;

create temp table if not exists mivo_move_log (step text, detail text) on commit drop;

do $$
declare
  v_admin uuid := (select id from auth.users where lower(email) = 'oonzhenlun@gmail.com');
  v_other uuid := (select id from auth.users where lower(email) = 'oon.lz9696@gmail.com');
  v_target uuid;
  v_source record;
  n integer;
begin
  if v_admin is null then raise exception 'oonzhenlun@gmail.com not found'; end if;
  if v_other is null then raise exception 'oon.lz9696@gmail.com not found'; end if;

  select id into v_target from public.sellers
   where owner_id = v_admin and shop_name ilike '%sparepartku%'
   order by created_at limit 1;

  for v_source in
    select id, shop_name from public.sellers
     where owner_id = v_other and shop_name ilike '%sparepartku%'
  loop
    if v_target is not null then
      update public.products set seller_id = v_target, updated_at = now() where seller_id = v_source.id;
      get diagnostics n = row_count;
      update public.product_variants set seller_id = v_target where seller_id = v_source.id;
      insert into mivo_move_log values ('moved products', n || ' from ' || v_source.shop_name || ' into your SPAREPARTKU');

      if exists (select 1 from public.seller_orders where seller_id = v_source.id) then
        update public.sellers set status = 'rejected', updated_at = now() where id = v_source.id;
        insert into mivo_move_log values ('closed shop', v_source.shop_name || ' has orders, so it was closed instead of deleted');
      else
        delete from public.seller_applications where seller_id = v_source.id;
        delete from public.sellers where id = v_source.id;
        insert into mivo_move_log values ('deleted shop', v_source.shop_name || ' (oon.lz9696@gmail.com)');
      end if;
    else
      update public.sellers set owner_id = v_admin, updated_at = now() where id = v_source.id;
      delete from public.seller_applications where seller_id = v_source.id;
      select count(*) into n from public.products where seller_id = v_source.id;
      -- Trust fitment like your other shops (own-shops.sql).
      begin
        update public.products set fitment_verified = true where seller_id = v_source.id;
      exception when undefined_column then null; end;
      insert into mivo_move_log values ('handed over shop', v_source.shop_name || ' now belongs to oonzhenlun@gmail.com with ' || n || ' products');
      v_target := v_source.id;
    end if;
  end loop;

  if not exists (select 1 from mivo_move_log) then
    insert into mivo_move_log values ('nothing to do', 'oon.lz9696@gmail.com has no SPAREPARTKU shop');
  end if;
end;
$$;

select * from mivo_move_log;

commit;
