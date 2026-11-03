-- =====================================================================
-- MIVO platform tools (superadmin): notices to sellers, commission
-- changes, platform campaigns with subsidies.
-- Run once in Supabase → SQL Editor, AFTER superadmin.sql and
-- seller-centre.sql. Safe to re-run.
--
-- Campaign money works on top of the existing voucher system:
--   * A platform campaign is linked to a voucher code customers use.
--   * funding = 'platform': MIVO pays the whole discount. Optionally a
--     temporary commission increase applies to sellers during the
--     campaign (sellers are notified automatically).
--   * funding = 'shared': sellers are invited (notice) and accept or
--     reject. Accepted sellers pay their share of the discount on their
--     items; MIVO pays the rest, and the whole discount for shops that
--     did not accept.
-- Commission changes: scheduled (from a date) or temporary (from–until),
-- for all shops or chosen shops; every change sends a notice. The daily
-- cron applies and reverts them (see /api/cron/capture-holds).
-- =====================================================================

begin;

-- ----------------------------------------------------------------- notices
create table if not exists public.platform_notices (
  id uuid primary key default gen_random_uuid(),
  kind text not null default 'info' check (kind in ('info','campaign_invite','commission_change')),
  title text not null,
  body text not null,
  seller_ids uuid[],                       -- null = every shop
  campaign_id uuid,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);
create table if not exists public.platform_notice_reads (
  notice_id uuid not null references public.platform_notices(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  read_at timestamptz not null default now(),
  primary key (notice_id, user_id)
);
alter table public.platform_notices enable row level security;
alter table public.platform_notice_reads enable row level security;
revoke all on public.platform_notices, public.platform_notice_reads from anon, authenticated;

-- ----------------------------------------------------------- commission
create table if not exists public.commission_changes (
  id uuid primary key default gen_random_uuid(),
  seller_ids uuid[],                       -- null = every approved shop (except MIVO Direct)
  rate numeric(5,2) not null check (rate >= 0 and rate <= 50),
  starts_at timestamptz not null,
  ends_at timestamptz,                     -- null = permanent
  reason text,
  campaign_id uuid,
  status text not null default 'scheduled' check (status in ('scheduled','active','done','cancelled')),
  previous_rates jsonb,                    -- {seller_id: old_rate} captured when applied
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);
alter table public.commission_changes enable row level security;
revoke all on public.commission_changes from anon, authenticated;

-- ------------------------------------------------------------ campaigns
create table if not exists public.platform_campaigns (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text,
  voucher_code text not null,
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  funding text not null check (funding in ('platform','shared')),
  platform_share_pct numeric(5,2) not null default 100 check (platform_share_pct between 0 and 100),
  commission_bump_rate numeric(5,2),       -- temporary commission during the campaign (platform-funded only)
  status text not null default 'active' check (status in ('active','cancelled')),
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  check (ends_at > starts_at)
);
create table if not exists public.campaign_participants (
  campaign_id uuid not null references public.platform_campaigns(id) on delete cascade,
  seller_id uuid not null references public.sellers(id) on delete cascade,
  status text not null default 'invited' check (status in ('invited','accepted','rejected')),
  responded_at timestamptz,
  responded_by uuid references auth.users(id) on delete set null,
  primary key (campaign_id, seller_id)
);
alter table public.platform_campaigns enable row level security;
alter table public.campaign_participants enable row level security;
revoke all on public.platform_campaigns, public.campaign_participants from anon, authenticated;

-- ============================================================ functions
create or replace function public.mivo_require_superadmin()
returns void language plpgsql stable security definer set search_path = public as $$
begin
  if not public.is_superadmin() then raise exception 'Only the MIVO superadmin can do this'; end if;
end;
$$;

-- Send a notice (superadmin). seller_ids null = all shops.
create or replace function public.platform_send_notice(
  p_title text, p_body text, p_seller_ids uuid[] default null, p_kind text default 'info', p_campaign_id uuid default null)
returns uuid language plpgsql security definer set search_path = public as $$
declare v_id uuid;
begin
  perform public.mivo_require_superadmin();
  if coalesce(btrim(p_title), '') = '' or coalesce(btrim(p_body), '') = '' then
    raise exception 'Title and message are required';
  end if;
  insert into public.platform_notices (kind, title, body, seller_ids, campaign_id, created_by)
  values (coalesce(p_kind, 'info'), btrim(p_title), btrim(p_body),
          case when p_seller_ids is null or cardinality(p_seller_ids) = 0 then null else p_seller_ids end,
          p_campaign_id, auth.uid())
  returning id into v_id;
  return v_id;
end;
$$;

-- Superadmin: sent notices with how many shop owners read them.
create or replace function public.platform_notices_sent()
returns table (id uuid, kind text, title text, body text, seller_ids uuid[], created_at timestamptz, reads bigint)
language plpgsql stable security definer set search_path = public as $$
begin
  perform public.mivo_require_superadmin();
  return query
    select n.id, n.kind, n.title, n.body, n.seller_ids, n.created_at,
           (select count(*) from public.platform_notice_reads r where r.notice_id = n.id)
      from public.platform_notices n order by n.created_at desc limit 300;
end;
$$;

-- Seller: notices for any of my shops, with read state and campaign invite state.
create or replace function public.seller_notices()
returns table (id uuid, kind text, title text, body text, campaign_id uuid, created_at timestamptz,
               is_read boolean, invites jsonb)
language sql stable security definer set search_path = public as $$
  select n.id, n.kind, n.title, n.body, n.campaign_id, n.created_at,
         exists (select 1 from public.platform_notice_reads r where r.notice_id = n.id and r.user_id = auth.uid()),
         (select coalesce(jsonb_agg(jsonb_build_object('seller_id', p.seller_id, 'shop', s.shop_name, 'status', p.status)), '[]'::jsonb)
            from public.campaign_participants p join public.sellers s on s.id = p.seller_id
           where p.campaign_id = n.campaign_id and s.owner_id = auth.uid())
    from public.platform_notices n
   where exists (select 1 from public.sellers s where s.owner_id = auth.uid() and s.status = 'approved'
                   and (n.seller_ids is null or s.id = any(n.seller_ids)))
   order by n.created_at desc
   limit 200;
$$;

create or replace function public.seller_unread_notices()
returns integer language sql stable security definer set search_path = public as $$
  select count(*)::int from public.seller_notices() where not is_read;
$$;

create or replace function public.seller_mark_notice_read(p_notice_id uuid)
returns void language sql security definer set search_path = public as $$
  insert into public.platform_notice_reads (notice_id, user_id) values (p_notice_id, auth.uid())
  on conflict do nothing;
$$;

-- ---------------------------------------------------------- commission
create or replace function public.platform_schedule_commission(
  p_seller_ids uuid[], p_rate numeric, p_starts_at timestamptz, p_ends_at timestamptz,
  p_reason text, p_campaign_id uuid default null)
returns uuid language plpgsql security definer set search_path = public as $$
declare v_id uuid; v_scope text; v_when text;
begin
  perform public.mivo_require_superadmin();
  if p_rate is null or p_rate < 0 or p_rate > 50 then raise exception 'Commission must be between 0%% and 50%%'; end if;
  if p_starts_at is null then raise exception 'Choose when the change starts'; end if;
  if p_ends_at is not null and p_ends_at <= p_starts_at then raise exception 'End must be after start'; end if;

  insert into public.commission_changes (seller_ids, rate, starts_at, ends_at, reason, campaign_id, created_by)
  values (case when p_seller_ids is null or cardinality(p_seller_ids) = 0 then null else p_seller_ids end,
          round(p_rate, 2), p_starts_at, p_ends_at, nullif(btrim(coalesce(p_reason, '')), ''), p_campaign_id, auth.uid())
  returning id into v_id;

  v_scope := case when p_seller_ids is null or cardinality(p_seller_ids) = 0 then 'all shops' else 'your shop' end;
  v_when := 'from ' || to_char(p_starts_at at time zone 'Asia/Kuala_Lumpur', 'DD Mon YYYY HH24:MI')
         || coalesce(' until ' || to_char(p_ends_at at time zone 'Asia/Kuala_Lumpur', 'DD Mon YYYY HH24:MI')
                     || ' (then back to the previous rate)', '');
  perform public.platform_send_notice(
    'Commission change: ' || round(p_rate, 2) || '%',
    'MIVO commission for ' || v_scope || ' will be ' || round(p_rate, 2) || '% ' || v_when || '.'
      || coalesce(E'\n\nReason: ' || nullif(btrim(coalesce(p_reason, '')), ''), ''),
    p_seller_ids, 'commission_change', p_campaign_id);
  return v_id;
end;
$$;

create or replace function public.platform_cancel_commission(p_id uuid)
returns void language plpgsql security definer set search_path = public as $$
declare c public.commission_changes%rowtype;
begin
  perform public.mivo_require_superadmin();
  select * into c from public.commission_changes where id = p_id for update;
  if not found then raise exception 'Not found'; end if;
  if c.status = 'scheduled' then
    update public.commission_changes set status = 'cancelled' where id = p_id;
    perform public.platform_send_notice('Commission change cancelled',
      'The commission change to ' || c.rate || '% scheduled for '
      || to_char(c.starts_at at time zone 'Asia/Kuala_Lumpur', 'DD Mon YYYY') || ' has been cancelled.',
      c.seller_ids, 'commission_change', c.campaign_id);
  elsif c.status = 'active' then
    -- End it now: the next apply run restores previous rates.
    update public.commission_changes set ends_at = now() where id = p_id;
  else
    raise exception 'This change is already %', c.status;
  end if;
end;
$$;

-- Applies due changes and reverts finished temporary ones. Called by the
-- daily cron (service role) and by the superadmin's "apply now".
create or replace function public.mivo_apply_commission_changes()
returns jsonb language plpgsql security definer set search_path = public as $$
declare c record; v_prev jsonb; v_applied int := 0; v_reverted int := 0;
begin
  if auth.uid() is not null and not public.is_superadmin() then raise exception 'Not allowed'; end if;

  for c in select * from public.commission_changes
            where status = 'scheduled' and starts_at <= now() order by starts_at for update loop
    select coalesce(jsonb_object_agg(id::text, commission_rate), '{}'::jsonb) into v_prev
      from public.sellers
     where status = 'approved' and coalesce(tier, 'standard') <> 'direct'
       and (c.seller_ids is null or id = any(c.seller_ids));
    update public.sellers set commission_rate = c.rate, updated_at = now()
     where status = 'approved' and coalesce(tier, 'standard') <> 'direct'
       and (c.seller_ids is null or id = any(c.seller_ids));
    update public.commission_changes
       set status = case when ends_at is null then 'done' else 'active' end, previous_rates = v_prev
     where id = c.id;
    v_applied := v_applied + 1;
  end loop;

  for c in select * from public.commission_changes
            where status = 'active' and ends_at is not null and ends_at <= now() for update loop
    update public.sellers s set commission_rate = (c.previous_rates ->> s.id::text)::numeric, updated_at = now()
     where c.previous_rates ? s.id::text;
    update public.commission_changes set status = 'done' where id = c.id;
    v_reverted := v_reverted + 1;
  end loop;

  return jsonb_build_object('applied', v_applied, 'reverted', v_reverted);
end;
$$;

create or replace function public.platform_commission_overview()
returns jsonb language plpgsql stable security definer set search_path = public as $$
begin
  perform public.mivo_require_superadmin();
  return jsonb_build_object(
    'shops', (select coalesce(jsonb_agg(jsonb_build_object('id', id, 'shop_name', shop_name, 'tier', tier,
                       'status', status, 'commission_rate', commission_rate) order by shop_name), '[]'::jsonb)
                from public.sellers),
    'changes', (select coalesce(jsonb_agg(to_jsonb(c) order by c.created_at desc), '[]'::jsonb)
                  from (select * from public.commission_changes order by created_at desc limit 200) c));
end;
$$;

-- ----------------------------------------------------------- campaigns
create or replace function public.platform_create_campaign(
  p_name text, p_description text, p_voucher_code text, p_starts_at timestamptz, p_ends_at timestamptz,
  p_funding text, p_platform_share_pct numeric, p_commission_bump_rate numeric, p_seller_ids uuid[] default null)
returns uuid language plpgsql security definer set search_path = public as $$
declare v_id uuid; v_share numeric; v_invited uuid[];
begin
  perform public.mivo_require_superadmin();
  if coalesce(btrim(p_name), '') = '' or coalesce(btrim(p_voucher_code), '') = '' then
    raise exception 'Name and voucher code are required';
  end if;
  if p_funding not in ('platform','shared') then raise exception 'Choose who pays'; end if;
  v_share := case when p_funding = 'platform' then 100 else coalesce(p_platform_share_pct, 50) end;
  if v_share < 0 or v_share >= 100 and p_funding = 'shared' then
    raise exception 'For a shared campaign, MIVO''s share must be below 100%%';
  end if;

  insert into public.platform_campaigns (name, description, voucher_code, starts_at, ends_at, funding,
                                         platform_share_pct, commission_bump_rate, created_by)
  values (btrim(p_name), nullif(btrim(coalesce(p_description, '')), ''), upper(btrim(p_voucher_code)),
          p_starts_at, p_ends_at, p_funding, v_share,
          case when p_funding = 'platform' then p_commission_bump_rate end, auth.uid())
  returning id into v_id;

  if p_funding = 'shared' then
    insert into public.campaign_participants (campaign_id, seller_id)
    select v_id, s.id from public.sellers s
     where s.status = 'approved' and coalesce(s.tier, 'standard') <> 'direct'
       and (p_seller_ids is null or cardinality(p_seller_ids) = 0 or s.id = any(p_seller_ids))
    on conflict do nothing;
    select array_agg(seller_id) into v_invited from public.campaign_participants where campaign_id = v_id;
    perform public.platform_send_notice(
      'Join campaign: ' || btrim(p_name),
      coalesce(nullif(btrim(coalesce(p_description, '')), '') || E'\n\n', '')
        || 'Voucher ' || upper(btrim(p_voucher_code)) || ', '
        || to_char(p_starts_at at time zone 'Asia/Kuala_Lumpur', 'DD Mon') || ' – '
        || to_char(p_ends_at at time zone 'Asia/Kuala_Lumpur', 'DD Mon YYYY') || '. '
        || 'MIVO pays ' || v_share || '% of the discount and your shop pays ' || (100 - v_share)
        || '% on your items. Accept to join; if you reject, MIVO pays the full discount on your items '
        || 'but your shop is not featured in the campaign.',
      v_invited, 'campaign_invite', v_id);
  elsif p_commission_bump_rate is not null then
    perform public.platform_schedule_commission(null, p_commission_bump_rate, p_starts_at, p_ends_at,
      'Campaign "' || btrim(p_name) || '" — MIVO pays the full voucher discount', v_id);
  else
    perform public.platform_send_notice('New MIVO campaign: ' || btrim(p_name),
      coalesce(nullif(btrim(coalesce(p_description, '')), '') || E'\n\n', '')
        || 'MIVO pays the full discount of voucher ' || upper(btrim(p_voucher_code)) || '. No cost to your shop.',
      null, 'info', v_id);
  end if;
  return v_id;
end;
$$;

create or replace function public.seller_respond_campaign(p_campaign_id uuid, p_seller_id uuid, p_accept boolean)
returns void language plpgsql security definer set search_path = public as $$
declare c public.platform_campaigns%rowtype;
begin
  if not exists (select 1 from public.sellers where id = p_seller_id and owner_id = auth.uid()) then
    raise exception 'Not your shop';
  end if;
  select * into c from public.platform_campaigns where id = p_campaign_id;
  if not found or c.status <> 'active' then raise exception 'Campaign not found'; end if;
  if c.ends_at <= now() then raise exception 'This campaign has ended'; end if;
  if c.starts_at <= now() and p_accept = false
     and exists (select 1 from public.campaign_participants where campaign_id = p_campaign_id
                  and seller_id = p_seller_id and status = 'accepted') then
    raise exception 'The campaign has started; you can''t leave it now';
  end if;
  update public.campaign_participants
     set status = case when p_accept then 'accepted' else 'rejected' end, responded_at = now(), responded_by = auth.uid()
   where campaign_id = p_campaign_id and seller_id = p_seller_id;
  if not found then raise exception 'Your shop was not invited to this campaign'; end if;
end;
$$;

-- Who pays what, per shop, for orders that used the campaign voucher.
create or replace function public.campaign_settlement(p_campaign_id uuid)
returns table (seller_id uuid, shop_name text, participation text, orders bigint,
               discount numeric, seller_pays numeric, mivo_pays numeric)
language plpgsql stable security definer set search_path = public as $$
declare c public.platform_campaigns%rowtype;
begin
  select * into c from public.platform_campaigns where id = p_campaign_id;
  if not found then raise exception 'Campaign not found'; end if;
  return query
  with lines as (
    select so.seller_id,
           round(coalesce(o.discount_amount, 0) * so.subtotal / nullif(o.subtotal, 0), 2) as alloc
      from public.orders o
      join public.seller_orders so on so.order_id = o.id
     where upper(coalesce(o.voucher_code, '')) = c.voucher_code
       and o.payment_status in ('paid', 'partially_refunded')
       and o.created_at between c.starts_at and c.ends_at
  )
  select s.id, s.shop_name, coalesce(p.status, case when c.funding = 'platform' then 'platform-funded' else 'not invited' end),
         count(*)::bigint, sum(l.alloc),
         sum(case when c.funding = 'shared' and p.status = 'accepted'
                  then round(l.alloc * (100 - c.platform_share_pct) / 100, 2) else 0 end),
         sum(l.alloc) - sum(case when c.funding = 'shared' and p.status = 'accepted'
                  then round(l.alloc * (100 - c.platform_share_pct) / 100, 2) else 0 end)
    from lines l
    join public.sellers s on s.id = l.seller_id
    left join public.campaign_participants p on p.campaign_id = c.id and p.seller_id = s.id
   where public.is_superadmin() or s.owner_id = auth.uid()
   group by s.id, s.shop_name, p.status
   order by s.shop_name;
end;
$$;

create or replace function public.platform_campaigns_overview()
returns jsonb language plpgsql stable security definer set search_path = public as $$
begin
  perform public.mivo_require_superadmin();
  return (select coalesce(jsonb_agg(jsonb_build_object(
            'campaign', to_jsonb(c),
            'participants', (select coalesce(jsonb_agg(jsonb_build_object('seller_id', p.seller_id, 'shop', s.shop_name, 'status', p.status)), '[]'::jsonb)
                               from public.campaign_participants p join public.sellers s on s.id = p.seller_id where p.campaign_id = c.id))
          order by c.created_at desc), '[]'::jsonb)
          from public.platform_campaigns c);
end;
$$;

create or replace function public.platform_cancel_campaign(p_id uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  perform public.mivo_require_superadmin();
  update public.platform_campaigns set status = 'cancelled' where id = p_id;
  update public.commission_changes set status = 'cancelled' where campaign_id = p_id and status = 'scheduled';
  update public.commission_changes set ends_at = now() where campaign_id = p_id and status = 'active';
end;
$$;

-- ---------------------------------------------------------- permissions
do $$
declare f text;
begin
  foreach f in array array[
    'mivo_require_superadmin()', 'platform_send_notice(text, text, uuid[], text, uuid)', 'platform_notices_sent()',
    'seller_notices()', 'seller_unread_notices()', 'seller_mark_notice_read(uuid)',
    'platform_schedule_commission(uuid[], numeric, timestamptz, timestamptz, text, uuid)',
    'platform_cancel_commission(uuid)', 'mivo_apply_commission_changes()', 'platform_commission_overview()',
    'platform_create_campaign(text, text, text, timestamptz, timestamptz, text, numeric, numeric, uuid[])',
    'seller_respond_campaign(uuid, uuid, boolean)', 'campaign_settlement(uuid)',
    'platform_campaigns_overview()', 'platform_cancel_campaign(uuid)'] loop
    execute 'revoke all on function public.' || f || ' from public, anon';
    execute 'grant execute on function public.' || f || ' to authenticated';
  end loop;
end $$;

commit;

-- Make new functions available to the website immediately.
notify pgrst, 'reload schema';
