-- =====================================================================
-- "New customers only" vouchers. Safe to re-run.
--   * vouchers.new_user_only: can be claimed only by someone who has not
--     paid for an order yet. Once claimed it keeps working until it is
--     used up (per_user_limit) or expires — e.g. 3 free-shipping vouchers.
--   * vouchers.claim_ends_at (optional): last moment a voucher can be
--     claimed. Vouchers already claimed keep working until ends_at
--     (e.g. claim until 31 Dec, use until 28 Feb).
--   * New accounts get every active new-customer voucher in their wallet
--     automatically when they sign up (where Supabase allows a trigger on
--     auth.users; otherwise they claim them on the home page).
-- The existing claim / checkout functions are not changed: the rule is
-- checked when a voucher is added to someone's wallet.
-- =====================================================================

begin;

alter table public.vouchers add column if not exists new_user_only boolean not null default false;
alter table public.vouchers add column if not exists claim_ends_at timestamptz;

-- Has this person paid for an order before?
create or replace function public.mivo_has_paid_order(p_user uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.orders
     where user_id = p_user
       and status::text in ('paid','processing','packed','shipped','delivered','completed','refunded','partially_refunded'));
$$;
revoke all on function public.mivo_has_paid_order(uuid) from public, anon, authenticated;

-- Checked whenever a voucher goes into a wallet: the claim deadline, and
-- new-customer vouchers only for people who haven't bought yet.
create or replace function public.mivo_guard_new_user_voucher()
returns trigger language plpgsql security definer set search_path = public as $$
declare v record;
begin
  select new_user_only, claim_ends_at into v from public.vouchers where id = new.voucher_id;
  if found then
    if v.claim_ends_at is not null and now() > v.claim_ends_at then
      raise exception 'This voucher can no longer be claimed';
    end if;
    if v.new_user_only and public.mivo_has_paid_order(new.user_id) then
      raise exception 'This voucher is for new customers only';
    end if;
  end if;
  return new;
end;
$$;
drop trigger if exists customer_vouchers_new_user_guard on public.customer_vouchers;
create trigger customer_vouchers_new_user_guard
  before insert on public.customer_vouchers
  for each row execute function public.mivo_guard_new_user_voucher();

-- New sign-ups get the new-customer vouchers straight away.
create or replace function public.mivo_give_new_user_vouchers()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  begin
    insert into public.customer_vouchers (user_id, voucher_id)
    select new.id, v.id
      from public.vouchers v
     where v.new_user_only and v.is_active and now() <= v.ends_at
       and (v.claim_ends_at is null or now() <= v.claim_ends_at)
    on conflict do nothing;
  exception when others then
    null; -- a voucher problem must never block a sign-up
  end;
  return new;
end;
$$;
revoke all on function public.mivo_give_new_user_vouchers() from public, anon, authenticated;
-- If Supabase doesn't allow a trigger on auth.users, everything above is still
-- saved; new customers then claim the vouchers on the home page instead.
do $$
begin
  execute 'drop trigger if exists mivo_new_user_vouchers on auth.users';
  execute 'create trigger mivo_new_user_vouchers after insert on auth.users '
       || 'for each row execute function public.mivo_give_new_user_vouchers()';
exception when others then
  raise notice 'Sign-up trigger not added (%). New customers can still claim the vouchers on the home page.', sqlerrm;
end $$;

commit;

notify pgrst, 'reload schema';
