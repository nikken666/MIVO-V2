-- =====================================================================
-- MIVO superadmin
-- Run once in Supabase → SQL Editor. Safe to re-run.
--
-- Makes oonzhenlun@gmail.com the platform superadmin and the owner of the
-- MIVO Direct shop(s). Superadmin is above shop admins: platform-wide
-- settings (subsidies, platform campaigns, messages to sellers) will be
-- limited to this role. The account must already be registered on MIVO.
-- =====================================================================

begin;

create table if not exists public.platform_roles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  role text not null check (role in ('superadmin')),
  created_at timestamptz not null default now()
);
alter table public.platform_roles enable row level security;
revoke all on public.platform_roles from anon, authenticated;

create or replace function public.is_superadmin()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.platform_roles where user_id = auth.uid() and role = 'superadmin');
$$;
revoke all on function public.is_superadmin() from public, anon;
grant execute on function public.is_superadmin() to authenticated;

do $$
declare v_user uuid;
begin
  select id into v_user from auth.users where lower(email) = 'oonzhenlun@gmail.com';
  if v_user is null then
    raise notice 'oonzhenlun@gmail.com has not registered yet. Sign up on MIVO first, then run this file again.';
    return;
  end if;

  insert into public.platform_roles (user_id, role) values (v_user, 'superadmin')
  on conflict (user_id) do update set role = 'superadmin';

  update public.sellers set owner_id = v_user where tier = 'direct' and owner_id is distinct from v_user;

  if not exists (select 1 from pg_proc where proname = 'is_admin') then
    raise notice 'is_admin() not found.';
  end if;
  raise notice 'Superadmin set for oonzhenlun@gmail.com (%). MIVO Direct is owned by this account.', v_user;
end $$;

commit;

-- Check:
--   select u.email, r.role from public.platform_roles r join auth.users u on u.id = r.user_id;
--   select shop_name, owner_id from public.sellers where tier = 'direct';

-- Make new functions available to the website immediately.
notify pgrst, 'reload schema';
