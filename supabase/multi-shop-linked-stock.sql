-- =====================================================================
-- MIVO multi-shop + linked stock + data-exposure fix
-- Run once in Supabase → SQL Editor. Safe to re-run.
-- =====================================================================

begin;

-- ---------------------------------------------------------------------
-- 1. SECURITY: stop exposing private seller and cost data publicly.
--    Until now anyone with the public site key could read every seller's
--    bank account, registration/tax numbers, phone and email, and every
--    variant's cost price. Column-level grants keep only storefront
--    columns readable by visitors and signed-in shoppers.
-- ---------------------------------------------------------------------

-- New storefront columns for shops (added first so they can be granted).
alter table public.sellers add column if not exists tier text not null default 'standard';
alter table public.sellers add column if not exists tagline text;
alter table public.sellers add column if not exists sort_order integer not null default 100;
do $$ begin
  alter table public.sellers add constraint sellers_tier_check
    check (tier in ('direct', 'preferred', 'standard'));
exception when duplicate_object then null; end $$;

revoke select on public.sellers from anon, authenticated;
grant select (id, shop_name, slug, logo_url, banner_url, description, status,
              tier, tagline, sort_order, approved_at, created_at, updated_at)
  on public.sellers to anon, authenticated;

-- Shared-stock key (added first so it can be granted).
alter table public.product_variants add column if not exists stock_group text;

revoke select on public.product_variants from anon, authenticated;
grant select (id, product_id, seller_id, title, sku, barcode, price, compare_at_price,
              stock_on_hand, stock_reserved, low_stock_threshold, weight_kg, length_cm,
              width_cm, height_cm, is_active, created_at, updated_at,
              variation_1_value, variation_2_value, discount_enabled, discount_percent,
              discount_starts_at, discount_ends_at, variant_image_url, sort_order,
              stock_group)
  on public.product_variants to anon, authenticated;
-- cost_price is intentionally NOT granted (service role / SQL editor only).

-- The existing MIVO-owned shop becomes the official "MIVO Direct" tier.
update public.sellers
   set tier = 'direct', sort_order = 0
 where shop_name ilike 'MIVO DIRECT%' and tier <> 'direct';

-- ---------------------------------------------------------------------
-- 2. LINKED STOCK across shops.
--    Variants with the same stock_group share one physical stock
--    (same warehouse). Default group = the SKU, so the same SKU listed in
--    several shops is linked automatically.
-- ---------------------------------------------------------------------

create index if not exists product_variants_stock_group_idx
  on public.product_variants (stock_group);

update public.product_variants
   set stock_group = upper(btrim(sku))
 where stock_group is null and sku is not null and btrim(sku) <> '';

-- Align any group that already has several members to its most recently
-- updated member, before the sync trigger exists.
with latest as (
  select distinct on (stock_group) stock_group, stock_on_hand, stock_reserved
    from public.product_variants
   where stock_group is not null
   order by stock_group, updated_at desc nulls last
)
update public.product_variants v
   set stock_on_hand = latest.stock_on_hand,
       stock_reserved = latest.stock_reserved
  from latest
 where v.stock_group = latest.stock_group
   and (v.stock_on_hand, v.stock_reserved)
       is distinct from (latest.stock_on_hand, latest.stock_reserved);

-- New / relinked variants adopt the group's current stock.
create or replace function public.mivo_join_stock_group()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  g record;
begin
  if new.stock_group is null and new.sku is not null and btrim(new.sku) <> '' then
    new.stock_group := upper(btrim(new.sku));
  elsif new.stock_group is not null then
    new.stock_group := upper(btrim(new.stock_group));
  end if;

  if new.stock_group is not null
     and (tg_op = 'INSERT' or new.stock_group is distinct from old.stock_group) then
    select stock_on_hand, stock_reserved into g
      from public.product_variants
     where stock_group = new.stock_group
       and id is distinct from new.id
     limit 1;
    if found then
      new.stock_on_hand := g.stock_on_hand;
      new.stock_reserved := g.stock_reserved;
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists product_variants_join_stock_group on public.product_variants;
create trigger product_variants_join_stock_group
  before insert or update of stock_group, sku on public.product_variants
  for each row execute function public.mivo_join_stock_group();

-- Any stock change on one listing (order, cancel, fulfil, manual edit) is
-- applied as the same delta to every other listing in its group. Deltas
-- (not absolute values) keep concurrent orders in different shops correct.
create or replace function public.mivo_sync_stock_group()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  d_hand integer;
  d_reserved integer;
begin
  if pg_trigger_depth() > 1
     or coalesce(current_setting('mivo.skip_stock_sync', true), '') = 'on'
     or new.stock_group is null then
    return new;
  end if;

  d_hand := coalesce(new.stock_on_hand, 0) - coalesce(old.stock_on_hand, 0);
  d_reserved := coalesce(new.stock_reserved, 0) - coalesce(old.stock_reserved, 0);

  if d_hand = 0 and d_reserved = 0 then
    return new;
  end if;

  update public.product_variants
     set stock_on_hand = stock_on_hand + d_hand,
         stock_reserved = stock_reserved + d_reserved,
         updated_at = now()
   where stock_group = new.stock_group
     and id <> new.id;

  return new;
end;
$$;

drop trigger if exists product_variants_sync_stock_group on public.product_variants;
create trigger product_variants_sync_stock_group
  after update of stock_on_hand, stock_reserved on public.product_variants
  for each row execute function public.mivo_sync_stock_group();

revoke all on function public.mivo_join_stock_group() from public, anon, authenticated;
revoke all on function public.mivo_sync_stock_group() from public, anon, authenticated;

-- Admin: set a whole group's on-hand stock in one go (e.g. from a
-- BigSeller inventory export) without double-counting.
create or replace function public.admin_set_group_stock(p_stock_group text, p_on_hand integer)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  affected integer;
begin
  if not public.is_admin() then
    raise exception 'Only MIVO admins can update stock';
  end if;
  if p_on_hand is null or p_on_hand < 0 then
    raise exception 'Stock must be zero or more';
  end if;

  perform set_config('mivo.skip_stock_sync', 'on', true);

  update public.product_variants
     set stock_on_hand = p_on_hand,
         updated_at = now()
   where stock_group = upper(btrim(p_stock_group));
  get diagnostics affected = row_count;

  perform set_config('mivo.skip_stock_sync', 'off', true);
  return affected;
end;
$$;

revoke all on function public.admin_set_group_stock(text, integer) from public, anon;
grant execute on function public.admin_set_group_stock(text, integer) to authenticated;

-- ---------------------------------------------------------------------
-- 3. SHOPS: one MIVO admin account can own several shops.
--    Remove any "one shop per owner" unique rule on sellers.owner_id.
-- ---------------------------------------------------------------------
do $$
declare
  owner_col smallint;
  c record;
begin
  select attnum into owner_col
    from pg_attribute
   where attrelid = 'public.sellers'::regclass and attname = 'owner_id';
  if owner_col is null then return; end if;

  for c in
    select conname from pg_constraint
     where conrelid = 'public.sellers'::regclass and contype = 'u'
       and conkey = array[owner_col]
  loop
    execute format('alter table public.sellers drop constraint %I', c.conname);
  end loop;

  for c in
    select i.relname as index_name
      from pg_index x join pg_class i on i.oid = x.indexrelid
     where x.indrelid = 'public.sellers'::regclass and x.indisunique
       and not x.indisprimary and x.indnatts = 1 and x.indkey[0] = owner_col
  loop
    execute format('drop index if exists public.%I', c.index_name);
  end loop;
end $$;

create unique index if not exists sellers_slug_unique_idx
  on public.sellers (lower(slug)) where slug is not null;

-- Admin: create or edit a shop (approved immediately, owned by the admin).
create or replace function public.admin_save_shop(
  p_id uuid,
  p_shop_name text,
  p_slug text,
  p_tier text,
  p_tagline text,
  p_description text,
  p_logo_url text,
  p_banner_url text,
  p_sort_order integer
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
  v_slug text := nullif(lower(regexp_replace(btrim(coalesce(p_slug, '')), '[^a-zA-Z0-9]+', '-', 'g')), '');
begin
  if not public.is_admin() then
    raise exception 'Only MIVO admins can manage shops';
  end if;
  if coalesce(btrim(p_shop_name), '') = '' then
    raise exception 'Shop name is required';
  end if;
  if p_tier not in ('direct', 'preferred', 'standard') then
    raise exception 'Unknown shop tier';
  end if;

  if p_id is null then
    insert into public.sellers
      (owner_id, shop_name, slug, tier, tagline, description, logo_url, banner_url,
       sort_order, status, approved_at)
    values
      (auth.uid(), btrim(p_shop_name), v_slug, p_tier, nullif(btrim(p_tagline), ''),
       nullif(btrim(p_description), ''), nullif(btrim(p_logo_url), ''),
       nullif(btrim(p_banner_url), ''), coalesce(p_sort_order, 100), 'approved', now())
    returning id into v_id;
  else
    update public.sellers
       set shop_name = btrim(p_shop_name),
           slug = v_slug,
           tier = p_tier,
           tagline = nullif(btrim(p_tagline), ''),
           description = nullif(btrim(p_description), ''),
           logo_url = nullif(btrim(p_logo_url), ''),
           banner_url = nullif(btrim(p_banner_url), ''),
           sort_order = coalesce(p_sort_order, 100),
           updated_at = now()
     where id = p_id
    returning id into v_id;
    if v_id is null then
      raise exception 'Shop not found';
    end if;
  end if;

  return v_id;
end;
$$;

revoke all on function public.admin_save_shop(uuid, text, text, text, text, text, text, text, integer)
  from public, anon;
grant execute on function public.admin_save_shop(uuid, text, text, text, text, text, text, text, integer)
  to authenticated;

commit;

-- Quick checks after running:
--   select tier, shop_name from public.sellers order by sort_order;
--   select stock_group, count(*) from public.product_variants
--    group by stock_group having count(*) > 1;
