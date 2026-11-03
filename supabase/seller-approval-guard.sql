-- =====================================================================
-- Only MIVO admins can open shops or change a shop's standing.
-- Run once in Supabase → SQL Editor. Safe to re-run.
--
-- Future merchants may submit a shop application (a sellers row), but:
--   * a non-admin's new shop always starts as 'pending' / 'standard',
--   * a non-admin can never change status, tier, commission, approval
--     date, sort order or ownership — even on their own shop.
-- Admins (public.is_admin()) and the SQL editor / service role are not
-- restricted. This works regardless of the table's RLS policies.
-- =====================================================================

create or replace function public.mivo_guard_seller_changes()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  -- SQL editor / service role (no signed-in user) and admins are trusted.
  if auth.uid() is null or public.is_admin() then
    return new;
  end if;

  if tg_op = 'INSERT' then
    new.status := 'pending';
    new.tier := 'standard';
    new.approved_at := null;
    new.sort_order := 100;
    new.owner_id := auth.uid();
    return new;
  end if;

  -- UPDATE by a non-admin: protected fields keep their old values.
  new.status := old.status;
  new.tier := old.tier;
  new.approved_at := old.approved_at;
  new.sort_order := old.sort_order;
  new.owner_id := old.owner_id;
  new.commission_rate := old.commission_rate;
  return new;
end;
$$;

drop trigger if exists sellers_guard_changes on public.sellers;
create trigger sellers_guard_changes
  before insert or update on public.sellers
  for each row execute function public.mivo_guard_seller_changes();

revoke all on function public.mivo_guard_seller_changes() from public, anon, authenticated;

-- Check: as a normal shopper, inserting a shop with status 'approved'
-- now stores 'pending'; only an admin (or this editor) can approve it.

-- Make new functions available to the website immediately.
notify pgrst, 'reload schema';
