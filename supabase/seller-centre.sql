-- =====================================================================
-- MIVO Seller Centre: sellers manage only their own shops
-- Run once in Supabase → SQL Editor, AFTER per-shop-fulfilment.sql,
-- chat.sql and returns.sql. Safe to re-run.
--
-- A seller is a normal account that owns one or more approved shops
-- (sellers.owner_id). These policies are added ON TOP of the existing
-- ones: MIVO admins keep full access; a seller only gains access to rows
-- of their own shops.
-- =====================================================================

begin;

-- Who may act for a shop: MIVO admins and the shop's owner.
create or replace function public.mivo_can_manage_shop(p_seller_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select public.is_admin()
      or exists (select 1 from public.sellers s where s.id = p_seller_id and s.owner_id = auth.uid());
$$;

-- Shops the signed-in user owns and may run (approved only).
create or replace function public.my_shop_ids()
returns setof uuid language sql stable security definer set search_path = public as $$
  select id from public.sellers where owner_id = auth.uid() and status = 'approved';
$$;

create or replace function public.is_seller()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.sellers where owner_id = auth.uid() and status = 'approved');
$$;

-- Seller Centre home: my shops (including pending applications).
create or replace function public.seller_my_shops()
returns table (id uuid, shop_name text, slug text, status text, tier text, logo_url text, commission_rate numeric)
language sql stable security definer set search_path = public as $$
  select s.id, s.shop_name, s.slug, s.status, s.tier, s.logo_url, s.commission_rate
    from public.sellers s where s.owner_id = auth.uid() order by s.created_at;
$$;

grant execute on function public.my_shop_ids() to authenticated;
grant execute on function public.is_seller() to authenticated;
grant execute on function public.seller_my_shops() to authenticated;
grant execute on function public.mivo_can_manage_shop(uuid) to authenticated;

-- ---------------------------------------------------------------------
-- Open a shop: any signed-in user can apply; MIVO approves.
-- ---------------------------------------------------------------------
create or replace function public.seller_apply(p_shop_name text, p_phone text, p_note text)
returns uuid language plpgsql security definer set search_path = public as $$
declare
  v_id uuid;
  v_slug text;
  v_email text;
  v_phone text := nullif(btrim(coalesce(p_phone, '')), '');
  v_cols text := 'owner_id, shop_name, slug, status, tier, description';
  v_vals text := '$1, $2, $3, ''pending'', ''standard'', $4';
  c record;
begin
  if auth.uid() is null then raise exception 'Please sign in'; end if;
  if coalesce(btrim(p_shop_name), '') = '' then raise exception 'Shop name is required'; end if;
  if (select count(*) from public.sellers where owner_id = auth.uid() and status = 'pending') >= 3 then
    raise exception 'You already have shop applications waiting for approval';
  end if;
  v_slug := nullif(lower(regexp_replace(btrim(p_shop_name), '[^a-zA-Z0-9]+', '-', 'g')), '');
  if exists (select 1 from public.sellers where lower(slug) = v_slug) then
    v_slug := v_slug || '-' || substr(md5(gen_random_uuid()::text), 1, 4);
  end if;
  select email into v_email from auth.users where id = auth.uid();

  -- Older setups may have extra required columns (contact, bank, business
  -- details). Fill them with the applicant's phone/email or a blank value;
  -- MIVO completes them when approving.
  for c in
    select column_name, data_type
      from information_schema.columns
     where table_schema = 'public' and table_name = 'sellers'
       and is_nullable = 'NO' and column_default is null and is_generated = 'NEVER' and identity_generation is null
       and column_name not in ('id', 'owner_id', 'shop_name', 'slug', 'status', 'tier', 'description')
  loop
    v_cols := v_cols || ', ' || quote_ident(c.column_name);
    v_vals := v_vals || ', ' || case
      when c.column_name ~* 'email' then quote_literal(coalesce(v_email, ''))
      when c.column_name ~* 'phone|mobile|contact' then quote_literal(coalesce(v_phone, ''))
      when c.column_name ~* 'name' then quote_literal(btrim(p_shop_name))
      when c.data_type in ('text', 'character varying', 'character') then quote_literal('')
      when c.data_type in ('integer', 'bigint', 'smallint', 'numeric', 'real', 'double precision') then '0'
      when c.data_type = 'boolean' then 'false'
      when c.data_type like 'timestamp%' or c.data_type = 'date' then 'now()'
      when c.data_type = 'jsonb' then quote_literal('{}') || '::jsonb'
      when c.data_type = 'ARRAY' then quote_literal('{}')
      else 'null' end;
  end loop;

  execute format('insert into public.sellers (%s) values (%s) returning id', v_cols, v_vals)
    into v_id using auth.uid(), btrim(p_shop_name), v_slug, nullif(btrim(coalesce(p_note, '')), '');

  -- Phone on the shop record, when the column exists.
  begin
    execute 'update public.sellers set phone = coalesce(nullif(phone, ''''), $1) where id = $2' using v_phone, v_id;
  exception when undefined_column then null;
  end;
  return v_id;
end;
$$;

revoke all on function public.seller_apply(text, text, text) from public, anon;
grant execute on function public.seller_apply(text, text, text) to authenticated;

-- MIVO: approve / suspend a shop.
create or replace function public.admin_set_shop_status(p_id uuid, p_status text)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'Only MIVO can change a shop''s status'; end if;
  if p_status not in ('approved', 'pending', 'suspended', 'rejected') then raise exception 'Unknown status'; end if;
  update public.sellers
     set status = p_status,
         approved_at = case when p_status = 'approved' then coalesce(approved_at, now()) else approved_at end,
         updated_at = now()
   where id = p_id;
exception when check_violation then
  raise exception 'Status % is not allowed by the sellers table', p_status;
end;
$$;
revoke all on function public.admin_set_shop_status(uuid, text) from public, anon;
grant execute on function public.admin_set_shop_status(uuid, text) to authenticated;

-- Seller: edit own shop's storefront details (status/tier/commission stay protected).
create or replace function public.seller_save_shop(p_id uuid, p_tagline text, p_description text, p_logo_url text, p_banner_url text)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not exists (select 1 from public.sellers where id = p_id and owner_id = auth.uid()) and not public.is_admin() then
    raise exception 'Not your shop';
  end if;
  update public.sellers
     set tagline = nullif(btrim(coalesce(p_tagline, '')), ''),
         description = nullif(btrim(coalesce(p_description, '')), ''),
         logo_url = nullif(btrim(coalesce(p_logo_url, '')), ''),
         banner_url = nullif(btrim(coalesce(p_banner_url, '')), ''),
         updated_at = now()
   where id = p_id;
end;
$$;
revoke all on function public.seller_save_shop(uuid, text, text, text, text) from public, anon;
grant execute on function public.seller_save_shop(uuid, text, text, text, text) to authenticated;

-- ---------------------------------------------------------------------
-- Row access for sellers (added to existing policies).
-- ---------------------------------------------------------------------
do $$
declare t text;
begin
  -- products / variants: full management of own shop's rows
  foreach t in array array['products', 'product_variants'] loop
    execute format('drop policy if exists "sellers manage own %1$s" on public.%1$I', t);
    execute format(
      'create policy "sellers manage own %1$s" on public.%1$I for all to authenticated
         using (seller_id in (select public.my_shop_ids()))
         with check (seller_id in (select public.my_shop_ids()))', t);
  end loop;
end $$;

drop policy if exists "sellers manage own product images" on public.product_images;
create policy "sellers manage own product images" on public.product_images for all to authenticated
  using (exists (select 1 from public.products p where p.id = product_id and p.seller_id in (select public.my_shop_ids())))
  with check (exists (select 1 from public.products p where p.id = product_id and p.seller_id in (select public.my_shop_ids())));

drop policy if exists "sellers manage own fitments" on public.product_vehicle_fitments;
create policy "sellers manage own fitments" on public.product_vehicle_fitments for all to authenticated
  using (exists (select 1 from public.products p where p.id = product_id and p.seller_id in (select public.my_shop_ids())))
  with check (exists (select 1 from public.products p where p.id = product_id and p.seller_id in (select public.my_shop_ids())));

-- Orders: a seller sees their own shop parcels, items and shipments (not
-- other shops' items, and not the buyer's payment details).
drop policy if exists "sellers read own seller orders" on public.seller_orders;
create policy "sellers read own seller orders" on public.seller_orders for select to authenticated
  using (seller_id in (select public.my_shop_ids()));

drop policy if exists "sellers read own order items" on public.order_items;
create policy "sellers read own order items" on public.order_items for select to authenticated
  using (seller_id in (select public.my_shop_ids()));

drop policy if exists "sellers read own shipments" on public.shipments;
create policy "sellers read own shipments" on public.shipments for select to authenticated
  using (exists (select 1 from public.seller_orders so where so.id = seller_order_id and so.seller_id in (select public.my_shop_ids())));

-- Seller order list with what a seller needs from the parent order.
create or replace function public.seller_parcels(p_seller_id uuid default null)
returns table (
  seller_order_id uuid, seller_id uuid, order_number text, order_status text, payment_status text,
  parcel_status text, subtotal numeric, shipping_address jsonb, customer_note text, created_at timestamptz,
  paid_at timestamptz, courier_name text, tracking_number text)
language sql stable security definer set search_path = public as $$
  select so.id, so.seller_id, o.order_number, o.status, o.payment_status,
         greatest_status.status, so.subtotal, so.shipping_address, so.customer_note, o.created_at,
         o.paid_at, sh.courier_name, sh.tracking_number
    from public.seller_orders so
    join public.orders o on o.id = so.order_id
    cross join lateral (
      select case
        when public.mivo_fulfilment_rank(so.status) >= public.mivo_fulfilment_rank(o.status) then so.status
        else o.status end as status
    ) greatest_status
    left join lateral (
      select courier_name, tracking_number from public.shipments s
       where s.seller_order_id = so.id order by s.created_at limit 1
    ) sh on true
   where so.seller_id in (select public.my_shop_ids())
     and (p_seller_id is null or so.seller_id = p_seller_id)
   order by o.created_at desc
   limit 500;
$$;
grant execute on function public.seller_parcels(uuid) to authenticated;

-- Sellers can't mark their own fitment as MIVO-verified.
create or replace function public.mivo_guard_product_verification()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null or public.is_admin() then return new; end if;
  if tg_op = 'INSERT' then
    new.fitment_verified := false;
    new.fitment_verified_at := null;
    new.fitment_verified_by := null;
  else
    new.fitment_verified := old.fitment_verified;
    new.fitment_verified_at := old.fitment_verified_at;
    new.fitment_verified_by := old.fitment_verified_by;
  end if;
  return new;
end;
$$;

do $$ begin
  if exists (select 1 from information_schema.columns
              where table_schema = 'public' and table_name = 'products' and column_name = 'fitment_verified') then
    drop trigger if exists products_guard_verification on public.products;
    create trigger products_guard_verification before insert or update on public.products
      for each row execute function public.mivo_guard_product_verification();
  else
    raise notice 'Run fitment-verification.sql first, then this file again, to protect the verified flag.';
  end if;
end $$;

-- Product images: sellers upload into their own shops' folders.
drop policy if exists "MIVO sellers upload images to own shops" on storage.objects;
create policy "MIVO sellers upload images to own shops" on storage.objects for insert to authenticated
  with check (bucket_id = 'product-images'
              and (storage.foldername(name))[1] in (select id::text from public.my_shop_ids()));
drop policy if exists "MIVO sellers change images of own shops" on storage.objects;
create policy "MIVO sellers change images of own shops" on storage.objects for update to authenticated
  using (bucket_id = 'product-images'
         and (storage.foldername(name))[1] in (select id::text from public.my_shop_ids()));
drop policy if exists "MIVO sellers delete images of own shops" on storage.objects;
create policy "MIVO sellers delete images of own shops" on storage.objects for delete to authenticated
  using (bucket_id = 'product-images'
         and (storage.foldername(name))[1] in (select id::text from public.my_shop_ids()));

commit;

-- Make new functions available to the website immediately.
notify pgrst, 'reload schema';
