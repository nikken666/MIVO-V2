-- =====================================================================
-- MIVO Shopee import fix: one SKU may be listed in several shops
-- Run once in Supabase → SQL Editor. Safe to re-run.
--
-- Linked stock (multi-shop-linked-stock.sql) shares stock between
-- variants with the same SKU in different shops. If product_variants
-- still has a database-wide unique rule on sku, importing a product that
-- MIVO Direct already sells into another shop fails with "duplicate key".
-- This swaps that rule for "unique within one shop".
-- =====================================================================

begin;

do $$
declare
  sku_col smallint;
  c record;
begin
  select attnum into sku_col
    from pg_attribute
   where attrelid = 'public.product_variants'::regclass and attname = 'sku';

  -- Unique constraints on sku alone.
  for c in
    select conname from pg_constraint
     where conrelid = 'public.product_variants'::regclass and contype = 'u'
       and conkey = array[sku_col]
  loop
    execute format('alter table public.product_variants drop constraint %I', c.conname);
  end loop;

  -- Unique indexes on sku alone (plain or upper/lower(sku)).
  for c in
    select i.relname as index_name
      from pg_index x join pg_class i on i.oid = x.indexrelid
     where x.indrelid = 'public.product_variants'::regclass and x.indisunique
       and not x.indisprimary and x.indnatts = 1
       and (x.indkey[0] = sku_col
            or (x.indkey[0] = 0 and pg_get_indexdef(x.indexrelid) ~* '\(\s*(upper|lower)\s*\(\s*sku\s*\)\s*\)'))
  loop
    execute format('drop index if exists public.%I', c.index_name);
  end loop;
end $$;

-- Repeated SKUs are allowed, also within one shop (same part in several
-- listings shares one stock). See sku-repeat.sql.
create index if not exists product_variants_seller_sku_idx
  on public.product_variants (seller_id, upper(btrim(sku)));

commit;

-- Check: unique rules left on product_variants
--   select indexname, indexdef from pg_indexes
--    where tablename = 'product_variants' and indexdef ilike '%unique%';

-- Make new functions available to the website immediately.
notify pgrst, 'reload schema';
