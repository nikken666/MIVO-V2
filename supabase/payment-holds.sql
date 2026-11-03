-- =====================================================================
-- MIVO card payment holds
-- Run once in Supabase → SQL Editor. Safe to re-run.
--
-- Card payments are authorised (held on the card) at checkout and only
-- captured when the order ships. Cancelling before shipping releases the
-- hold: nothing is charged, so no fees apply. FPX and GrabPay are still
-- charged immediately. Checkout only starts holding cards once these
-- columns exist.
-- =====================================================================

begin;

alter table public.orders add column if not exists payment_capture_status text;
alter table public.orders add column if not exists payment_authorized_until timestamptz;
alter table public.orders add column if not exists payment_captured_at timestamptz;

do $$ begin
  alter table public.orders add constraint orders_payment_capture_status_check
    check (payment_capture_status is null or payment_capture_status in ('authorized', 'captured', 'released'));
exception when duplicate_object then null; end $$;

create index if not exists orders_payment_holds_idx
  on public.orders (payment_authorized_until)
  where payment_capture_status = 'authorized';

commit;

-- Make new functions available to the website immediately.
notify pgrst, 'reload schema';
