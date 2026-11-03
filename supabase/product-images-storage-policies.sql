-- MIVO product image upload policies
-- Run once in Supabase Dashboard > SQL Editor. Safe to re-run.

-- The policies below need these two helpers. They already exist in the live
-- database; create them only when missing (e.g. a fresh project), so an
-- existing definition is never overwritten.
do $$
begin
  if to_regprocedure('public.current_seller_id()') is null then
    execute $f$
      create function public.current_seller_id()
      returns uuid language sql stable security definer set search_path = public as $b$
        select id from public.sellers where owner_id = auth.uid() order by created_at limit 1;
      $b$;
    $f$;
    execute 'revoke all on function public.current_seller_id() from public, anon';
    execute 'grant execute on function public.current_seller_id() to authenticated';
  end if;
  if to_regprocedure('public.current_approved_seller_id()') is null then
    execute $f$
      create function public.current_approved_seller_id()
      returns uuid language sql stable security definer set search_path = public as $b$
        select id from public.sellers where owner_id = auth.uid() and status = 'approved' order by created_at limit 1;
      $b$;
    $f$;
    execute 'revoke all on function public.current_approved_seller_id() from public, anon';
    execute 'grant execute on function public.current_approved_seller_id() to authenticated';
  end if;
end;
$$;

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

-- Make new functions available to the website immediately.
notify pgrst, 'reload schema';
