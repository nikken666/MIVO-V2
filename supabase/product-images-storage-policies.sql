-- MIVO product image upload policies
-- Run once in Supabase Dashboard > SQL Editor.

drop policy if exists "MIVO sellers upload product images" on storage.objects;
create policy "MIVO sellers upload product images"
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'product-images'
  and (storage.foldername(name))[1] =
      public.current_approved_seller_id()::text
);

drop policy if exists "MIVO sellers read own product image records" on storage.objects;
create policy "MIVO sellers read own product image records"
on storage.objects
for select
to authenticated
using (
  bucket_id = 'product-images'
  and (
    (storage.foldername(name))[1] =
      public.current_seller_id()::text
    or public.is_admin()
  )
);

drop policy if exists "MIVO sellers update own product images" on storage.objects;
create policy "MIVO sellers update own product images"
on storage.objects
for update
to authenticated
using (
  bucket_id = 'product-images'
  and (
    (storage.foldername(name))[1] =
      public.current_approved_seller_id()::text
    or public.is_admin()
  )
)
with check (
  bucket_id = 'product-images'
  and (
    (storage.foldername(name))[1] =
      public.current_approved_seller_id()::text
    or public.is_admin()
  )
);

drop policy if exists "MIVO sellers delete own product images" on storage.objects;
create policy "MIVO sellers delete own product images"
on storage.objects
for delete
to authenticated
using (
  bucket_id = 'product-images'
  and (
    (storage.foldername(name))[1] =
      public.current_seller_id()::text
    or public.is_admin()
  )
);
