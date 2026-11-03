-- =====================================================================
-- MIVO × EasyParcel (Open API): connection tokens and shipment labels
-- Run once in Supabase → SQL Editor, AFTER checkout-per-shop.sql. Safe to re-run.
-- =====================================================================

begin;

-- One row: MIVO's linked EasyParcel account. Server-only (service role):
-- no policies, so the website's public/anon and signed-in roles can't read tokens.
create table if not exists public.easyparcel_connection (
  id int primary key default 1 check (id = 1),
  access_token text not null,
  refresh_token text,
  expires_at timestamptz,
  refresh_expires_at timestamptz,
  connected_by uuid references auth.users(id) on delete set null,
  connected_at timestamptz,
  updated_at timestamptz not null default now()
);
alter table public.easyparcel_connection enable row level security;
revoke all on public.easyparcel_connection from anon, authenticated;

commit;

notify pgrst, 'reload schema';
