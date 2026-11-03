-- =====================================================================
-- MIVO: the same SKU may be listed more than once, in one shop or several.
-- Run once in Supabase → SQL Editor. Safe to re-run.
--
-- Shopee shops often list one part in several listings (and several
-- shops). MIVO keeps their SKUs exactly as in Shopee; variants with the same
-- SKU share one stock (stock_group, see multi-shop-linked-stock.sql).
-- This removes the "one SKU per shop" rule if a database has it.
-- =====================================================================

begin;

drop index if exists public.product_variants_seller_sku_unique_idx;
create index if not exists product_variants_seller_sku_idx
  on public.product_variants (seller_id, upper(btrim(sku)));

commit;

notify pgrst, 'reload schema';
