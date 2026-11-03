-- =====================================================================
-- MIVO storage upload fix. Safe to re-run.
--
-- 1) "permission denied for table sellers" when a new seller uploads
--    SSM / bank statement: Postgres checks EVERY upload policy on
--    storage.objects, and the product-image policies call helper
--    functions that read public.sellers. Shoppers can't read that table,
--    so the helpers must run as their owner (security definer). This
--    keeps each helper's body exactly as it is and only changes how it runs.
-- 2) Seller product-image policies compared the folder with the file's
--    own id instead of the seller's shop id. Fixed.
-- =====================================================================

begin;

do $$
declare f text;
begin
  foreach f in array array[
    'public.current_seller_id()',
    'public.current_approved_seller_id()',
    'public.is_admin()',
    'public.is_superadmin()',
    'public.my_shop_ids()',
    'public.is_seller()'
  ] loop
    if to_regprocedure(f) is not null then
      execute format('alter function %s security definer', f);
      execute format('alter function %s set search_path = public', f);
    end if;
  end loop;
end;
$$;

drop policy if exists "MIVO sellers upload images to own shops" on storage.objects;
create policy "MIVO sellers upload images to own shops" on storage.objects for insert to authenticated
  with check (bucket_id = 'product-images'
              and (storage.foldername(name))[1] in (select s::text from public.my_shop_ids() as s));
drop policy if exists "MIVO sellers change images of own shops" on storage.objects;
create policy "MIVO sellers change images of own shops" on storage.objects for update to authenticated
  using (bucket_id = 'product-images'
         and (storage.foldername(name))[1] in (select s::text from public.my_shop_ids() as s));
drop policy if exists "MIVO sellers delete images of own shops" on storage.objects;
create policy "MIVO sellers delete images of own shops" on storage.objects for delete to authenticated
  using (bucket_id = 'product-images'
         and (storage.foldername(name))[1] in (select s::text from public.my_shop_ids() as s));

-- Seller documents: make sure the private bucket and its policies exist.
insert into storage.buckets (id, name, public) values ('seller-documents', 'seller-documents', false)
  on conflict (id) do nothing;
drop policy if exists "MIVO seller documents upload" on storage.objects;
create policy "MIVO seller documents upload" on storage.objects for insert to authenticated
  with check (bucket_id = 'seller-documents' and (storage.foldername(name))[1] = auth.uid()::text);
drop policy if exists "MIVO seller documents read" on storage.objects;
create policy "MIVO seller documents read" on storage.objects for select to authenticated
  using (bucket_id = 'seller-documents' and ((storage.foldername(name))[1] = auth.uid()::text or public.is_admin()));

commit;

notify pgrst, 'reload schema';
