-- =====================================================================
-- MIVO: keep products in step with Shopee. Safe to re-run.
--
-- 1) Each imported product / option remembers its Shopee Item ID and
--    Variation ID (external_ref, e.g. 'shopee:58169897867'), so importing
--    the same listing again updates it instead of adding a copy.
-- 2) mivo_sync_variants: the website updates price / original price / stock
--    of many options in one go (used by Import from Shopee).
-- =====================================================================

begin;

alter table public.products add column if not exists external_ref text;
alter table public.product_variants add column if not exists external_ref text;
create index if not exists products_seller_external_ref on public.products (seller_id, external_ref) where external_ref is not null;
create index if not exists product_variants_seller_external_ref on public.product_variants (seller_id, external_ref) where external_ref is not null;

-- p_rows: [{"id": "<variant uuid>", "price": 128, "compare_at_price": 400, "stock": 10, "external_ref": "shopee:123"}]
-- "stock" and "external_ref" are optional. Only options of p_shop are touched.
create or replace function public.mivo_sync_variants(p_shop uuid, p_rows jsonb)
returns integer language plpgsql security definer set search_path = public as $$
declare v_count integer;
begin
  update public.product_variants v
     set price = greatest(0, r.price),
         compare_at_price = case when r.compare_at_price is not null and r.compare_at_price > r.price then r.compare_at_price end,
         stock_on_hand = coalesce(greatest(0, r.stock), v.stock_on_hand),
         external_ref = coalesce(nullif(r.external_ref, ''), v.external_ref),
         updated_at = now()
    from jsonb_to_recordset(coalesce(p_rows, '[]'::jsonb))
         as r(id uuid, price numeric, compare_at_price numeric, stock integer, external_ref text)
   where v.id = r.id
     and v.seller_id = p_shop
     and r.price is not null;
  get diagnostics v_count = row_count;
  return v_count;
end;
$$;
revoke all on function public.mivo_sync_variants(uuid, jsonb) from public, anon, authenticated;

commit;

notify pgrst, 'reload schema';
