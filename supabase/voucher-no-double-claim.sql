-- =====================================================================
-- A customer can claim each voucher only once. Safe to re-run.
-- Claiming again (popup, home page, cart, shop page, a second device)
-- adds nothing: the voucher is already in their wallet. How many times
-- it can be USED is still set by the voucher's per_user_limit.
-- =====================================================================

create or replace function public.mivo_voucher_claim_once()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  -- Two claims at the same moment wait for each other instead of both getting in.
  perform pg_advisory_xact_lock(hashtext(new.user_id::text || ':' || new.voucher_id::text));
  if exists (select 1 from public.customer_vouchers
              where user_id = new.user_id and voucher_id = new.voucher_id) then
    return null; -- already in the wallet: skip quietly
  end if;
  return new;
end;
$$;
revoke all on function public.mivo_voucher_claim_once() from public, anon, authenticated;

drop trigger if exists customer_vouchers_claim_once on public.customer_vouchers;
create trigger customer_vouchers_claim_once
  before insert on public.customer_vouchers
  for each row execute function public.mivo_voucher_claim_once();

-- Check: customers who already got the same voucher more than once (should be empty).
select v.code, cv.user_id, count(*) as times_in_wallet
  from public.customer_vouchers cv
  join public.vouchers v on v.id = cv.voucher_id
 group by v.code, cv.user_id
having count(*) > 1
 order by times_in_wallet desc;
