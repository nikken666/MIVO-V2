-- =====================================================================
-- MIVO Seller Centre: Marketing centre (like Shopee).
-- Run after seller-centre.sql and platform.sql. Safe to re-run.
-- Works whether the voucher columns are text or Postgres enums.
--
--  * Discounts   – a shop puts its own products on sale (% off, with dates).
--  * Shop vouchers – a shop creates voucher codes for its own products
--                    (paid by the shop). Customers claim them on the shop
--                    and product pages and use them at checkout like any
--                    other voucher (product-scoped, so they only discount
--                    that shop's items).
--  * MIVO campaigns – campaigns the superadmin sends; each shop sees them
--                    in one place and decides whether to join.
-- =====================================================================

begin;

-- ------------------------------------------------------- shop vouchers
alter table public.vouchers add column if not exists seller_id uuid references public.sellers(id) on delete cascade;
alter table public.vouchers add column if not exists shop_wide boolean not null default false;
create index if not exists vouchers_seller_idx on public.vouchers (seller_id) where seller_id is not null;

create or replace function public.mivo_require_my_shop(p_seller_id uuid)
returns void language plpgsql stable security definer set search_path = public as $$
begin
  if p_seller_id is null or not (
       exists (select 1 from public.sellers s where s.id = p_seller_id and s.owner_id = auth.uid() and s.status = 'approved')
       or public.is_admin()) then
    raise exception 'Not your shop';
  end if;
end;
$$;

-- Vouchers of the shops I run, with how often they were used.
create or replace function public.seller_vouchers()
returns table (id uuid, seller_id uuid, shop_name text, code text, name text, discount_type text,
               discount_value numeric, minimum_spend numeric, max_discount numeric, starts_at timestamptz,
               ends_at timestamptz, usage_limit integer, per_user_limit integer, is_active boolean,
               shop_wide boolean, product_ids uuid[], claimed bigint, used bigint)
language sql stable security definer set search_path = public as $$
  select v.id, v.seller_id, s.shop_name, v.code, v.name, v.discount_type::text, v.discount_value, v.minimum_spend,
         v.max_discount, v.starts_at, v.ends_at, v.usage_limit, v.per_user_limit, v.is_active, v.shop_wide,
         coalesce((select array_agg(vp.product_id) from public.voucher_products vp where vp.voucher_id = v.id), '{}'),
         (select count(*) from public.customer_vouchers cv where cv.voucher_id = v.id),
         (select count(*) from public.voucher_redemptions r where r.voucher_id = v.id and r.status::text = 'redeemed')
    from public.vouchers v join public.sellers s on s.id = v.seller_id
   where s.owner_id = auth.uid() or public.is_admin()
   order by v.created_at desc;
$$;

create or replace function public.seller_save_voucher(p jsonb)
returns uuid language plpgsql security definer set search_path = public as $$
declare
  v_id uuid := nullif(p->>'id', '')::uuid;
  v_seller uuid := nullif(p->>'seller_id', '')::uuid;
  v_code text := upper(regexp_replace(coalesce(p->>'code', ''), '[^A-Za-z0-9]', '', 'g'));
  v_type text := coalesce(p->>'discount_type', 'fixed');
  v_value numeric := coalesce((p->>'discount_value')::numeric, 0);
  v_min numeric := greatest(coalesce((p->>'minimum_spend')::numeric, 0), 0);
  v_max numeric := nullif((p->>'max_discount')::numeric, 0);
  v_starts timestamptz := coalesce((p->>'starts_at')::timestamptz, now());
  v_ends timestamptz := (p->>'ends_at')::timestamptz;
  v_shop_wide boolean := coalesce((p->>'shop_wide')::boolean, true);
  v_products uuid[];
  v_existing public.vouchers%rowtype;
begin
  perform public.mivo_require_my_shop(v_seller);
  if length(v_code) < 4 or length(v_code) > 20 then raise exception 'The code needs 4–20 letters or numbers'; end if;
  if v_type not in ('fixed', 'percent') then raise exception 'Choose an amount or a percentage off'; end if;
  if v_value <= 0 then raise exception 'Enter the discount'; end if;
  if v_type = 'percent' and v_value > 90 then raise exception 'Up to 90%% off'; end if;
  if v_type = 'fixed' and v_min > 0 and v_value > v_min then raise exception 'The discount can''t be more than the minimum spend'; end if;
  if v_ends is null or v_ends <= v_starts then raise exception 'The end date must be after the start date'; end if;
  if v_ends > v_starts + interval '180 days' then raise exception 'A voucher can run for up to 180 days'; end if;

  if v_id is not null then
    select * into v_existing from public.vouchers where id = v_id;
    if not found or v_existing.seller_id is distinct from v_seller then raise exception 'Voucher not found'; end if;
  end if;
  if exists (select 1 from public.vouchers where upper(code) = v_code and id is distinct from v_id) then
    raise exception 'That code is already taken. Try another one.';
  end if;

  if v_shop_wide then
    select array_agg(id) into v_products from public.products where seller_id = v_seller;
  else
    select array_agg(x) into v_products
      from unnest(coalesce(array(select jsonb_array_elements_text(p->'product_ids'))::uuid[], '{}')) x
     where exists (select 1 from public.products pr where pr.id = x and pr.seller_id = v_seller);
    if coalesce(cardinality(v_products), 0) = 0 then raise exception 'Choose at least one of your products'; end if;
  end if;

  if v_id is null then
    insert into public.vouchers (code, name, description, discount_type, discount_value, minimum_spend, max_discount,
                                 starts_at, ends_at, usage_limit, per_user_limit, first_order_only, scope_type, scope_id,
                                 is_active, seller_id, shop_wide)
    values (v_code, coalesce(nullif(btrim(p->>'name'), ''), v_code), nullif(btrim(coalesce(p->>'description', '')), ''),
            (jsonb_populate_record(null::public.vouchers, jsonb_build_object('discount_type', v_type))).discount_type,
            v_value, v_min, case when v_type = 'percent' then v_max end, v_starts, v_ends,
            nullif((p->>'usage_limit')::int, 0), greatest(coalesce((p->>'per_user_limit')::int, 1), 1), false,
            (jsonb_populate_record(null::public.vouchers, jsonb_build_object('scope_type', 'product'))).scope_type,
            null, true, v_seller, v_shop_wide)
    returning id into v_id;
  else
    update public.vouchers
       set code = v_code, name = coalesce(nullif(btrim(p->>'name'), ''), v_code),
           discount_type = (jsonb_populate_record(null::public.vouchers, jsonb_build_object('discount_type', v_type))).discount_type,
           discount_value = v_value, minimum_spend = v_min,
           max_discount = case when v_type = 'percent' then v_max end,
           starts_at = v_starts, ends_at = v_ends, usage_limit = nullif((p->>'usage_limit')::int, 0),
           per_user_limit = greatest(coalesce((p->>'per_user_limit')::int, 1), 1),
           shop_wide = v_shop_wide, is_active = true, updated_at = now()
     where id = v_id;
  end if;

  delete from public.voucher_products where voucher_id = v_id;
  insert into public.voucher_products (voucher_id, product_id)
  select v_id, x from unnest(coalesce(v_products, '{}')) x on conflict do nothing;
  return v_id;
end;
$$;

create or replace function public.seller_end_voucher(p_voucher_id uuid)
returns void language plpgsql security definer set search_path = public as $$
declare v_seller uuid;
begin
  select seller_id into v_seller from public.vouchers where id = p_voucher_id;
  perform public.mivo_require_my_shop(v_seller);
  update public.vouchers set is_active = false, ends_at = least(ends_at, now()), updated_at = now() where id = p_voucher_id;
end;
$$;

-- New products of a shop join its shop-wide vouchers automatically.
create or replace function public.mivo_shop_voucher_products()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.seller_id is not null then
    insert into public.voucher_products (voucher_id, product_id)
    select v.id, new.id from public.vouchers v
     where v.seller_id = new.seller_id and v.shop_wide and v.is_active and v.ends_at > now()
    on conflict do nothing;
  end if;
  return new;
end;
$$;
drop trigger if exists products_shop_vouchers on public.products;
create trigger products_shop_vouchers after insert or update of seller_id on public.products
  for each row execute function public.mivo_shop_voucher_products();

-- Storefront: a shop's live vouchers (shop page, product page).
create or replace function public.shop_vouchers(p_seller_id uuid)
returns table (id uuid, code text, name text, discount_type text, discount_value numeric, minimum_spend numeric,
               max_discount numeric, ends_at timestamptz, shop_wide boolean)
language sql stable security definer set search_path = public as $$
  select v.id, v.code, v.name, v.discount_type::text, v.discount_value, v.minimum_spend, v.max_discount, v.ends_at, v.shop_wide
    from public.vouchers v
   where v.seller_id = p_seller_id and v.is_active and v.starts_at <= now() and v.ends_at > now()
     and (v.usage_limit is null or (select count(*) from public.voucher_redemptions r
                                     where r.voucher_id = v.id and r.status::text in ('reserved', 'redeemed')) < v.usage_limit)
   order by v.minimum_spend, v.discount_value desc
   limit 10;
$$;

-- ------------------------------------------------------------ discounts
create or replace function public.seller_discount_items(p_seller_id uuid)
returns table (variant_id uuid, product_id uuid, product_name text, variant_title text, sku text,
               image_url text, price numeric, stock integer, discount_enabled boolean, discount_percent numeric,
               discount_starts_at timestamptz, discount_ends_at timestamptz)
language plpgsql stable security definer set search_path = public as $$
begin
  perform public.mivo_require_my_shop(p_seller_id);
  return query
  select v.id, p.id, p.name, v.title, v.sku, coalesce(v.variant_image_url, p.primary_image_url), v.price,
         greatest(coalesce(v.stock_on_hand, 0) - coalesce(v.stock_reserved, 0), 0)::int,
         coalesce(v.discount_enabled, false), v.discount_percent, v.discount_starts_at, v.discount_ends_at
    from public.product_variants v join public.products p on p.id = v.product_id
   where p.seller_id = p_seller_id and coalesce(v.is_active, true) and p.status::text <> 'archived'
   order by p.name, v.sort_order nulls last, v.title;
end;
$$;

create or replace function public.seller_set_discount(
  p_seller_id uuid, p_variant_ids uuid[], p_percent numeric, p_starts_at timestamptz, p_ends_at timestamptz)
returns integer language plpgsql security definer set search_path = public as $$
declare n integer;
begin
  perform public.mivo_require_my_shop(p_seller_id);
  if p_percent is null or p_percent <= 0 or p_percent > 90 then raise exception 'Choose 1–90%% off'; end if;
  if p_ends_at is null or p_ends_at <= coalesce(p_starts_at, now()) then raise exception 'The end date must be after the start date'; end if;
  update public.product_variants v
     set discount_enabled = true, discount_percent = round(p_percent, 2),
         discount_starts_at = coalesce(p_starts_at, now()), discount_ends_at = p_ends_at
    from public.products p
   where p.id = v.product_id and p.seller_id = p_seller_id and v.id = any(p_variant_ids);
  get diagnostics n = row_count;
  return n;
end;
$$;

create or replace function public.seller_clear_discount(p_seller_id uuid, p_variant_ids uuid[])
returns integer language plpgsql security definer set search_path = public as $$
declare n integer;
begin
  perform public.mivo_require_my_shop(p_seller_id);
  update public.product_variants v
     set discount_enabled = false
    from public.products p
   where p.id = v.product_id and p.seller_id = p_seller_id and v.id = any(p_variant_ids);
  get diagnostics n = row_count;
  return n;
end;
$$;

-- ------------------------------------------------------- MIVO campaigns
-- Every live or upcoming MIVO campaign, with this shop's answer.
create or replace function public.seller_campaigns(p_seller_id uuid)
returns table (id uuid, name text, description text, voucher_code text, starts_at timestamptz, ends_at timestamptz,
               funding text, platform_share_pct numeric, invited boolean, participation text, responded_at timestamptz)
language plpgsql stable security definer set search_path = public as $$
begin
  perform public.mivo_require_my_shop(p_seller_id);
  return query
  select c.id, c.name, c.description, c.voucher_code, c.starts_at, c.ends_at, c.funding, c.platform_share_pct,
         cp.seller_id is not null, coalesce(cp.status, case when c.funding = 'platform' then 'included' else 'not_invited' end),
         cp.responded_at
    from public.platform_campaigns c
    left join public.campaign_participants cp on cp.campaign_id = c.id and cp.seller_id = p_seller_id
   where c.status = 'active' and c.ends_at > now() - interval '30 days'
   order by c.starts_at desc;
end;
$$;

revoke all on function public.mivo_require_my_shop(uuid) from public, anon;
revoke all on function public.seller_vouchers() from public, anon;
revoke all on function public.seller_save_voucher(jsonb) from public, anon;
revoke all on function public.seller_end_voucher(uuid) from public, anon;
revoke all on function public.seller_discount_items(uuid) from public, anon;
revoke all on function public.seller_set_discount(uuid, uuid[], numeric, timestamptz, timestamptz) from public, anon;
revoke all on function public.seller_clear_discount(uuid, uuid[]) from public, anon;
revoke all on function public.seller_campaigns(uuid) from public, anon;
revoke all on function public.mivo_shop_voucher_products() from public, anon, authenticated;
grant execute on function public.mivo_require_my_shop(uuid) to authenticated;
grant execute on function public.seller_vouchers() to authenticated;
grant execute on function public.seller_save_voucher(jsonb) to authenticated;
grant execute on function public.seller_end_voucher(uuid) to authenticated;
grant execute on function public.seller_discount_items(uuid) to authenticated;
grant execute on function public.seller_set_discount(uuid, uuid[], numeric, timestamptz, timestamptz) to authenticated;
grant execute on function public.seller_clear_discount(uuid, uuid[]) to authenticated;
grant execute on function public.seller_campaigns(uuid) to authenticated;
grant execute on function public.shop_vouchers(uuid) to anon, authenticated;

commit;

notify pgrst, 'reload schema';
