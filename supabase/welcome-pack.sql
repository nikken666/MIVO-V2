-- =====================================================================
-- New customer gift popup: vouchers.welcome_pack marks the vouchers shown
-- in the popup (tick "Show in the new customer gift popup" in Admin ->
-- Marketing -> Vouchers). Safe to re-run.
-- =====================================================================
begin;
alter table public.vouchers add column if not exists welcome_pack boolean not null default false;
commit;
notify pgrst, 'reload schema';
