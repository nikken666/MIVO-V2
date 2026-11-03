-- =====================================================================
-- MIVO commission: change a shop's rate right away (any shop, including
-- MIVO Direct or your own shops). Run after platform.sql. Safe to re-run.
-- Scheduled changes still work as before; this is the "set it now" button.
-- =====================================================================

begin;

create or replace function public.platform_set_shop_commission(p_seller_id uuid, p_rate numeric, p_notify boolean default true)
returns void language plpgsql security definer set search_path = public as $$
declare s public.sellers%rowtype;
begin
  perform public.mivo_require_superadmin();
  if p_rate is null or p_rate < 0 or p_rate > 50 then raise exception 'Commission must be between 0%% and 50%%'; end if;
  select * into s from public.sellers where id = p_seller_id for update;
  if not found then raise exception 'Shop not found'; end if;

  update public.sellers set commission_rate = round(p_rate, 2), updated_at = now() where id = p_seller_id;

  -- Keep a record next to the scheduled changes.
  insert into public.commission_changes (seller_ids, rate, starts_at, ends_at, reason, status, previous_rates, created_by)
  values (array[p_seller_id], round(p_rate, 2), now(), null, 'Set now by MIVO', 'done',
          jsonb_build_object(p_seller_id::text, s.commission_rate), auth.uid());

  if coalesce(p_notify, true) and coalesce(s.tier, 'standard') <> 'direct' and s.owner_id is distinct from auth.uid() then
    perform public.platform_send_notice('Commission change: ' || round(p_rate, 2) || '%',
      'MIVO commission for your shop is now ' || round(p_rate, 2) || '% (was ' || coalesce(s.commission_rate, 0) || '%).',
      array[p_seller_id], 'commission_change', null);
  end if;
end;
$$;
revoke all on function public.platform_set_shop_commission(uuid, numeric, boolean) from public, anon;
grant execute on function public.platform_set_shop_commission(uuid, numeric, boolean) to authenticated;

commit;

notify pgrst, 'reload schema';
