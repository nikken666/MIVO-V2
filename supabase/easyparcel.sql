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

-- EasyParcel booking details on each shop parcel's shipment.
alter table public.shipments add column if not exists provider text;              -- 'easyparcel' | null (manual)
alter table public.shipments add column if not exists ep_shipment_number text;    -- ES-YYMM-XXXXX
alter table public.shipments add column if not exists ep_order_number text;       -- EI-YYMM-XXXXX
alter table public.shipments add column if not exists ep_service_id text;
alter table public.shipments add column if not exists ep_service_name text;
alter table public.shipments add column if not exists ep_paid_amount numeric(12,2);
alter table public.shipments add column if not exists awb_url text;
alter table public.shipments add column if not exists label_urls jsonb;
alter table public.shipments add column if not exists collection_method text;    -- pickup | dropoff
alter table public.shipments add column if not exists tracking_status_code int;
alter table public.shipments add column if not exists tracking_status text;
alter table public.shipments add column if not exists tracking_checked_at timestamptz;
create unique index if not exists shipments_ep_shipment_number on public.shipments (ep_shipment_number)
  where ep_shipment_number is not null;

-- Courier scan history for the animated tracker.
create table if not exists public.shipment_tracking_events (
  id bigint generated always as identity primary key,
  shipment_id uuid not null references public.shipments(id) on delete cascade,
  status_code int,
  description text not null,
  location text,
  event_time timestamptz not null,
  created_at timestamptz not null default now(),
  unique (shipment_id, event_time, description)
);
alter table public.shipment_tracking_events enable row level security;
revoke all on public.shipment_tracking_events from anon, authenticated;
grant select on public.shipment_tracking_events to authenticated;
drop policy if exists "tracking events: buyer, shop or admin" on public.shipment_tracking_events;
create policy "tracking events: buyer, shop or admin" on public.shipment_tracking_events for select to authenticated
  using (exists (
    select 1 from public.shipments sh
      join public.seller_orders so on so.id = sh.seller_order_id
      join public.orders o on o.id = so.order_id
     where sh.id = shipment_id
       and (o.user_id = auth.uid() or public.mivo_can_manage_shop(so.seller_id))
  ));

-- Each shop's pickup (sender) address for couriers. Read and written through
-- the functions below; prefilled from the approved seller application.
alter table public.sellers add column if not exists pickup_address jsonb;
do $$
begin
  if to_regclass('public.seller_applications') is not null then
    update public.sellers s
       set pickup_address = a.pickup_address
      from public.seller_applications a
     where a.seller_id = s.id and a.status = 'approved'
       and s.pickup_address is null and a.pickup_address is not null;
  end if;
end;
$$;

create or replace function public.shop_pickup_address(p_seller_id uuid)
returns jsonb language plpgsql stable security definer set search_path = public as $$
begin
  if not public.mivo_can_manage_shop(p_seller_id) then raise exception 'Not allowed'; end if;
  return (select pickup_address from public.sellers where id = p_seller_id);
end;
$$;

create or replace function public.shop_save_pickup_address(p_seller_id uuid, p_address jsonb)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.mivo_can_manage_shop(p_seller_id) then raise exception 'Not allowed'; end if;
  if coalesce(btrim(p_address ->> 'name'), '') = '' or coalesce(btrim(p_address ->> 'phone'), '') = ''
     or coalesce(btrim(p_address ->> 'line'), '') = '' or coalesce(p_address ->> 'postcode', '') !~ '^\d{5}$'
     or coalesce(btrim(p_address ->> 'city'), '') = '' or coalesce(btrim(p_address ->> 'state'), '') = '' then
    raise exception 'Fill in name, phone, street, 5-digit postcode, city and state';
  end if;
  update public.sellers set pickup_address = p_address, updated_at = now() where id = p_seller_id;
end;
$$;

revoke all on function public.shop_pickup_address(uuid) from public, anon;
revoke all on function public.shop_save_pickup_address(uuid, jsonb) from public, anon;
grant execute on function public.shop_pickup_address(uuid) to authenticated;
grant execute on function public.shop_save_pickup_address(uuid, jsonb) to authenticated;

-- Server only: mark a shop parcel shipped once EasyParcel has issued the AWB
-- (from the booking route, the webhook or the daily job). Runs the normal
-- per-shop fulfilment as the shop's owner so all its rules still apply.
create or replace function public.mivo_system_ship_parcel(
  p_seller_order_id uuid, p_courier text, p_tracking text, p_tracking_url text
)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_owner uuid; v_result jsonb;
begin
  select s.owner_id into v_owner
    from public.seller_orders so join public.sellers s on s.id = so.seller_id
   where so.id = p_seller_order_id;
  if v_owner is null then raise exception 'Shop has no owner'; end if;
  perform set_config('request.jwt.claims', json_build_object('sub', v_owner, 'role', 'authenticated')::text, true);
  perform set_config('request.jwt.claim.sub', v_owner::text, true);
  v_result := public.admin_update_shop_fulfilment(p_seller_order_id, 'shipped', p_courier, p_tracking, p_tracking_url);
  return v_result;
end;
$$;
revoke all on function public.mivo_system_ship_parcel(uuid, text, text, text) from public, anon, authenticated;
grant execute on function public.mivo_system_ship_parcel(uuid, text, text, text) to service_role;

-- Short-lived cache of EasyParcel rates (same route, weight and size) so
-- checkout stays within EasyParcel's quotation limits. Server only.
create table if not exists public.easyparcel_rate_cache (
  cache_key text primary key,
  quotes jsonb not null,
  expires_at timestamptz not null
);
alter table public.easyparcel_rate_cache enable row level security;
revoke all on public.easyparcel_rate_cache from anon, authenticated;

commit;

notify pgrst, 'reload schema';
