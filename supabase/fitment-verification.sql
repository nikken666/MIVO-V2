-- =====================================================================
-- MIVO fitment levels: MIVO-verified / seller-listed / unverified
-- Run once in Supabase → SQL Editor. Safe to re-run.
--
-- MIVO Direct parts are always treated as verified. Another shop's part is
-- verified only after MIVO staff check its fitment list. If the vehicle
-- list changes afterwards (by anyone other than MIVO), the check resets.
-- =====================================================================

begin;

alter table public.products add column if not exists fitment_verified boolean not null default false;
alter table public.products add column if not exists fitment_verified_at timestamptz;
alter table public.products add column if not exists fitment_verified_by uuid references auth.users(id) on delete set null;

-- Storefront may read the flag (products use column grants on some setups).
do $$ begin
  grant select (fitment_verified) on public.products to anon, authenticated;
exception when others then null; end $$;

create or replace function public.admin_set_fitment_verified(p_product_id uuid, p_verified boolean)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'Only MIVO can verify fitment'; end if;
  update public.products
     set fitment_verified = coalesce(p_verified, false),
         fitment_verified_at = case when p_verified then now() end,
         fitment_verified_by = case when p_verified then auth.uid() end
   where id = p_product_id;
end;
$$;
revoke all on function public.admin_set_fitment_verified(uuid, boolean) from public, anon;
grant execute on function public.admin_set_fitment_verified(uuid, boolean) to authenticated;

-- A seller changing the vehicle list after verification resets it.
create or replace function public.mivo_reset_fitment_verified()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if public.is_admin() then return null; end if;
  update public.products set fitment_verified = false, fitment_verified_at = null, fitment_verified_by = null
   where id = coalesce(new.product_id, old.product_id) and fitment_verified;
  return null;
end;
$$;

drop trigger if exists product_vehicle_fitments_reset_verified on public.product_vehicle_fitments;
create trigger product_vehicle_fitments_reset_verified
  after insert or update or delete on public.product_vehicle_fitments
  for each row execute function public.mivo_reset_fitment_verified();

commit;
