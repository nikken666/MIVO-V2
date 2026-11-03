-- =====================================================================
-- MIVO's own shops. Run after seller-rules.sql. Safe to re-run.
--
--  * Shops the superadmin owns (other than MIVO Direct) are Preferred, and
--    their products' vehicle fitment counts as MIVO-verified.
--  * One pickup address can be applied to all of the superadmin's shops.
--  * Platform settings, starting with whether "Sell on MIVO" is shown.
-- =====================================================================

begin;

create or replace function public.mivo_is_superadmin_user(p_user uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.platform_roles r where r.user_id = p_user and r.role = 'superadmin');
$$;
revoke all on function public.mivo_is_superadmin_user(uuid) from public, anon, authenticated;

-- 1) Own shops are Preferred (MIVO Direct stays Direct).
update public.sellers set tier = 'preferred', updated_at = now()
 where public.mivo_is_superadmin_user(owner_id) and coalesce(tier, 'standard') = 'standard';

create or replace function public.mivo_own_shop_tier()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if public.mivo_is_superadmin_user(new.owner_id) and coalesce(new.tier, 'standard') = 'standard' then
    new.tier := 'preferred';
  end if;
  return new;
end;
$$;
drop trigger if exists sellers_own_shop_tier on public.sellers;
create trigger sellers_own_shop_tier before insert or update of owner_id on public.sellers
  for each row execute function public.mivo_own_shop_tier();
revoke all on function public.mivo_own_shop_tier() from public, anon, authenticated;

-- ...and their fitment is trusted like MIVO Direct's.
do $$
begin
  if exists (select 1 from information_schema.columns
              where table_schema = 'public' and table_name = 'products' and column_name = 'fitment_verified') then
    update public.products p set fitment_verified = true
      from public.sellers s
     where s.id = p.seller_id and public.mivo_is_superadmin_user(s.owner_id) and not coalesce(p.fitment_verified, false);

    create or replace function public.mivo_own_shop_fitment()
    returns trigger language plpgsql security definer set search_path = public as $f$
    begin
      if exists (select 1 from public.sellers s where s.id = new.seller_id and public.mivo_is_superadmin_user(s.owner_id)) then
        new.fitment_verified := true;
      end if;
      return new;
    end;
    $f$;
    revoke all on function public.mivo_own_shop_fitment() from public, anon, authenticated;
    -- Named to run after products_guard_verification (triggers fire in name order).
    drop trigger if exists products_zz_own_shop_fitment on public.products;
    create trigger products_zz_own_shop_fitment before insert or update of seller_id on public.products
      for each row execute function public.mivo_own_shop_fitment();
  else
    raise notice 'Run fitment-verification.sql first, then this file again, to trust fitment on your own shops.';
  end if;
end;
$$;

-- 2) One pickup address for all my shops.
create or replace function public.platform_apply_pickup_to_my_shops(p_address jsonb)
returns integer language plpgsql security definer set search_path = public as $$
declare n integer;
begin
  perform public.mivo_require_superadmin();
  if coalesce(btrim(p_address ->> 'name'), '') = '' or coalesce(btrim(p_address ->> 'phone'), '') = ''
     or coalesce(btrim(p_address ->> 'line'), '') = '' or coalesce(p_address ->> 'postcode', '') !~ '^\d{5}$'
     or coalesce(btrim(p_address ->> 'city'), '') = '' or coalesce(btrim(p_address ->> 'state'), '') = '' then
    raise exception 'Fill in name, phone, street, 5-digit postcode, city and state';
  end if;
  update public.sellers set pickup_address = p_address, updated_at = now() where owner_id = auth.uid();
  get diagnostics n = row_count;
  return n;
end;
$$;
revoke all on function public.platform_apply_pickup_to_my_shops(jsonb) from public, anon;
grant execute on function public.platform_apply_pickup_to_my_shops(jsonb) to authenticated;

-- 3) Platform settings (public read, superadmin write).
create table if not exists public.platform_settings (
  key text primary key,
  value jsonb not null,
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users(id) on delete set null
);
alter table public.platform_settings enable row level security;
revoke all on public.platform_settings from anon, authenticated;
grant select on public.platform_settings to anon, authenticated;
drop policy if exists "platform settings: everyone reads" on public.platform_settings;
create policy "platform settings: everyone reads" on public.platform_settings for select to anon, authenticated using (true);
insert into public.platform_settings (key, value) values ('show_sell_link', 'false'::jsonb) on conflict (key) do nothing;

create or replace function public.platform_set_setting(p_key text, p_value jsonb)
returns void language plpgsql security definer set search_path = public as $$
begin
  perform public.mivo_require_superadmin();
  if p_key not in ('show_sell_link') then raise exception 'Unknown setting'; end if;
  insert into public.platform_settings (key, value, updated_at, updated_by) values (p_key, p_value, now(), auth.uid())
  on conflict (key) do update set value = excluded.value, updated_at = now(), updated_by = auth.uid();
end;
$$;
revoke all on function public.platform_set_setting(text, jsonb) from public, anon;
grant execute on function public.platform_set_setting(text, jsonb) to authenticated;

commit;

notify pgrst, 'reload schema';
