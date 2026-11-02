-- =====================================================================
-- MIVO returns & refunds (marketplace style)
-- Run once in Supabase → SQL Editor. Safe to re-run.
--
-- Flow:
--   customer requests (items, reason, photos)                → requested
--   seller: accept                          → approved_return / refunding
--           offer partial refund (keep item)                 → seller_offer
--           dispute                                          → mivo_review
--   customer: accept offer → refunding · reject offer → mivo_review
--   customer ships item back (courier + tracking)            → returning
--   seller: received OK → refunding · amount adjusted        → mivo_review
--   MIVO: approve (amount, return needed?) / reject
--   admin refunds via Stripe                                 → refunded
--   automatic: seller silent 2 days → accepted;
--              customer doesn't ship back in 7 days → closed
--
-- Money:
--   seller's fault (wrong, damaged, defective, not as described, missing
--   parts, not received, or "doesn't fit" on a MIVO-verified part):
--   item price + its share of shipping. Return postage is on MIVO.
--   change of mind / no reason / unverified-fit: item price only; the
--   original delivery fee is not refunded, the payment processing fee
--   share is deducted, and the customer pays return postage.
-- =====================================================================

begin;

create table if not exists public.return_requests (
  id uuid primary key default gen_random_uuid(),
  request_number text unique not null,
  order_id uuid not null references public.orders(id) on delete cascade,
  seller_order_id uuid references public.seller_orders(id) on delete set null,
  seller_id uuid references public.sellers(id) on delete set null,
  customer_id uuid not null references auth.users(id) on delete cascade,
  items jsonb not null,                       -- [{order_item_id, quantity}]
  reason text not null check (reason in (
    'wrong_item','damaged','defective','not_as_described','missing_parts',
    'not_received','does_not_fit','change_of_mind','no_reason')),
  solution text not null check (solution in ('return_refund','refund_only')),
  description text,
  evidence_paths text[] not null default '{}',
  seller_fault boolean not null default false,
  items_amount numeric(12,2) not null default 0,
  shipping_refund numeric(12,2) not null default 0,
  fee_deduction numeric(12,2) not null default 0,
  requested_amount numeric(12,2) not null default 0,
  seller_amount numeric(12,2),
  final_amount numeric(12,2),
  status text not null default 'requested' check (status in (
    'requested','seller_offer','mivo_review','approved_return','returning',
    'received','refunding','refunded','rejected','cancelled','closed')),
  needs_return boolean not null default true,
  return_courier text,
  return_tracking text,
  seller_note text,
  dispute_note text,
  mivo_note text,
  respond_by timestamptz,
  ship_back_by timestamptz,
  stripe_refund_id text,
  refunded_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.return_request_events (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null references public.return_requests(id) on delete cascade,
  actor text not null check (actor in ('customer','seller','mivo','system')),
  action text not null,
  note text,
  amount numeric(12,2),
  created_at timestamptz not null default now()
);

create index if not exists return_requests_order_idx on public.return_requests(order_id);
create index if not exists return_requests_customer_idx on public.return_requests(customer_id, created_at desc);
create index if not exists return_requests_status_idx on public.return_requests(status, created_at desc);
create index if not exists return_request_events_idx on public.return_request_events(request_id, created_at);

-- Shop managers: MIVO admins and the shop's owner (also defined in chat.sql).
create or replace function public.mivo_can_manage_shop(p_seller_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select public.is_admin()
      or exists (select 1 from public.sellers s where s.id = p_seller_id and s.owner_id = auth.uid());
$$;

alter table public.return_requests enable row level security;
alter table public.return_request_events enable row level security;

drop policy if exists "returns: participants read" on public.return_requests;
create policy "returns: participants read" on public.return_requests for select to authenticated
  using (customer_id = auth.uid() or public.mivo_can_manage_shop(seller_id));

drop policy if exists "return events: participants read" on public.return_request_events;
create policy "return events: participants read" on public.return_request_events for select to authenticated
  using (exists (select 1 from public.return_requests r where r.id = request_id
                  and (r.customer_id = auth.uid() or public.mivo_can_manage_shop(r.seller_id))));

revoke insert, update, delete on public.return_requests, public.return_request_events from anon, authenticated;
grant select on public.return_requests, public.return_request_events to authenticated;

-- ---------------------------------------------------------------------
-- Refund quote for a set of items: the single source of truth for money.
-- ---------------------------------------------------------------------
create or replace function public.mivo_return_quote(p_order_id uuid, p_items jsonb, p_reason text)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare
  o public.orders%rowtype;
  v_items numeric := 0;
  v_goods numeric;
  v_share numeric;
  v_fault boolean;
  v_verified boolean;
  v_shipping numeric := 0;
  v_fee numeric := 0;
  v_already numeric := 0;
  v_refund numeric;
begin
  select * into o from public.orders where id = p_order_id;
  if not found then raise exception 'Order not found'; end if;

  select coalesce(sum(oi.unit_price * least((x.value->>'quantity')::int, oi.quantity)), 0),
         bool_and(coalesce(s.tier, 'standard') = 'direct')
    into v_items, v_verified
  from jsonb_array_elements(p_items) x
  join public.order_items oi on oi.id = (x.value->>'order_item_id')::uuid and oi.order_id = o.id
  left join public.sellers s on s.id = oi.seller_id;

  -- Item price after the order's voucher discount.
  v_items := round(v_items * greatest(o.subtotal - coalesce(o.discount_amount, 0), 0) / nullif(o.subtotal, 0), 2);
  v_items := coalesce(v_items, 0);
  v_goods := greatest(o.total_amount - coalesce(o.shipping_amount, 0), 0);
  v_share := case when v_goods > 0 then least(v_items / v_goods, 1) else 0 end;

  v_fault := p_reason in ('wrong_item','damaged','defective','not_as_described','missing_parts','not_received')
          or (p_reason = 'does_not_fit' and coalesce(v_verified, false));

  if v_fault then
    v_shipping := round(coalesce(o.shipping_amount, 0) * v_share, 2);
  else
    v_fee := round(coalesce(o.payment_processing_fee_amount, 0) * v_share, 2);
  end if;

  -- Never refund more than what is left of the order.
  select coalesce(sum(coalesce(final_amount, requested_amount)), 0) into v_already
  from public.return_requests
  where order_id = o.id and status in ('refunding','refunded');
  v_refund := least(greatest(v_items + v_shipping - v_fee, 0),
                    greatest(o.total_amount - coalesce(o.cancellation_refund_amount, 0) - v_already, 0));

  return jsonb_build_object(
    'seller_fault', v_fault, 'items_amount', v_items, 'shipping_refund', v_shipping,
    'fee_deduction', v_fee, 'refund_amount', v_refund, 'max_refund',
    greatest(o.total_amount - coalesce(o.cancellation_refund_amount, 0) - v_already, 0));
end;
$$;

create or replace function public.mivo_return_log(p_request uuid, p_actor text, p_action text, p_note text, p_amount numeric)
returns void language sql security definer set search_path = public as $$
  insert into public.return_request_events (request_id, actor, action, note, amount)
  values (p_request, p_actor, p_action, nullif(btrim(coalesce(p_note, '')), ''), p_amount);
$$;

-- When was the order delivered (status history), if at all.
create or replace function public.mivo_order_delivered_at(p_order_id uuid)
returns timestamptz language sql stable security definer set search_path = public as $$
  select max(created_at) from public.order_status_history
   where order_id = p_order_id and new_status = 'delivered';
$$;

-- Customer: preview the refund before submitting.
create or replace function public.return_request_preview(p_order_number text, p_items jsonb, p_reason text)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare o public.orders%rowtype;
begin
  select * into o from public.orders where order_number = p_order_number and user_id = auth.uid();
  if not found then raise exception 'Order not found'; end if;
  return public.mivo_return_quote(o.id, p_items, p_reason);
end;
$$;

-- Customer: open a request (items must belong to one shop parcel).
create or replace function public.return_request_create(
  p_order_number text, p_items jsonb, p_reason text, p_solution text,
  p_description text, p_evidence text[]
)
returns uuid language plpgsql security definer set search_path = public as $$
declare
  o public.orders%rowtype;
  v_quote jsonb;
  v_seller_orders int;
  v_seller_order uuid;
  v_seller uuid;
  v_delivered timestamptz;
  v_id uuid;
  v_number text;
begin
  select * into o from public.orders where order_number = p_order_number and user_id = auth.uid() for update;
  if not found then raise exception 'Order not found'; end if;
  if o.status not in ('shipped','delivered') then
    raise exception 'Returns open once the order has shipped';
  end if;
  if o.status = 'shipped' and p_reason <> 'not_received' and p_reason <> 'damaged' then
    raise exception 'Please confirm you received the order first, or choose "not received"';
  end if;
  v_delivered := public.mivo_order_delivered_at(o.id);
  if o.status = 'delivered' and coalesce(v_delivered, o.updated_at) < now() - interval '7 days' then
    raise exception 'The 7-day return window for this order has passed. Please use a warranty claim instead.';
  end if;
  if p_solution not in ('return_refund','refund_only') then raise exception 'Choose return & refund or refund only'; end if;
  if p_solution = 'refund_only' and p_reason not in ('not_received','missing_parts') then
    raise exception 'Refund without returning the item is only for items not received or missing parts';
  end if;
  if jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0 then
    raise exception 'Choose at least one item';
  end if;
  if (select count(*) from jsonb_array_elements(p_items) x
       left join public.order_items oi on oi.id = (x.value->>'order_item_id')::uuid and oi.order_id = o.id
      where oi.id is null or coalesce((x.value->>'quantity')::int, 0) < 1
         or (x.value->>'quantity')::int > oi.quantity) > 0 then
    raise exception 'Invalid items or quantities';
  end if;

  select count(distinct oi.seller_order_id), min(oi.seller_order_id::text)::uuid, min(oi.seller_id::text)::uuid
    into v_seller_orders, v_seller_order, v_seller
  from jsonb_array_elements(p_items) x
  join public.order_items oi on oi.id = (x.value->>'order_item_id')::uuid;
  if v_seller_orders > 1 then raise exception 'Request items from one shop at a time'; end if;

  if exists (
    select 1 from public.return_requests r, jsonb_array_elements(r.items) ri, jsonb_array_elements(p_items) x
     where r.order_id = o.id and r.status not in ('rejected','cancelled','closed')
       and ri.value->>'order_item_id' = x.value->>'order_item_id'
  ) then
    raise exception 'There is already a return request for one of these items';
  end if;

  v_quote := public.mivo_return_quote(o.id, p_items, p_reason);
  if (v_quote->>'refund_amount')::numeric <= 0 then raise exception 'Nothing left to refund on this order'; end if;

  v_number := 'RR' || to_char(now(), 'YYMMDD') || '-' || upper(substr(md5(gen_random_uuid()::text), 1, 5));

  insert into public.return_requests (
    request_number, order_id, seller_order_id, seller_id, customer_id, items, reason, solution,
    description, evidence_paths, seller_fault, items_amount, shipping_refund, fee_deduction,
    requested_amount, needs_return, respond_by)
  values (
    v_number, o.id, v_seller_order, v_seller, auth.uid(), p_items, p_reason, p_solution,
    nullif(btrim(coalesce(p_description, '')), ''), coalesce(p_evidence, '{}'),
    (v_quote->>'seller_fault')::boolean, (v_quote->>'items_amount')::numeric,
    (v_quote->>'shipping_refund')::numeric, (v_quote->>'fee_deduction')::numeric,
    (v_quote->>'refund_amount')::numeric, p_solution = 'return_refund', now() + interval '2 days')
  returning id into v_id;

  perform public.mivo_return_log(v_id, 'customer', 'requested', p_description, (v_quote->>'refund_amount')::numeric);
  return v_id;
end;
$$;

-- Seller: accept / offer a partial refund (customer keeps item) / dispute.
create or replace function public.return_request_seller_respond(p_id uuid, p_action text, p_amount numeric, p_note text)
returns void language plpgsql security definer set search_path = public as $$
declare r public.return_requests%rowtype;
begin
  select * into r from public.return_requests where id = p_id for update;
  if not found then raise exception 'Request not found'; end if;
  if not public.mivo_can_manage_shop(r.seller_id) then raise exception 'Not allowed'; end if;
  if r.status <> 'requested' then raise exception 'This request is already %', r.status; end if;

  if p_action = 'accept' then
    update public.return_requests
       set status = case when needs_return then 'approved_return' else 'refunding' end,
           final_amount = case when needs_return then null else requested_amount end,
           ship_back_by = case when needs_return then now() + interval '7 days' end,
           seller_note = nullif(btrim(coalesce(p_note, '')), ''), updated_at = now()
     where id = r.id;
    perform public.mivo_return_log(r.id, 'seller', 'accepted', p_note, r.requested_amount);
  elsif p_action = 'offer' then
    if p_amount is null or p_amount <= 0 or p_amount >= r.requested_amount then
      raise exception 'Offer an amount between RM0 and RM%', r.requested_amount;
    end if;
    update public.return_requests
       set status = 'seller_offer', seller_amount = round(p_amount, 2),
           seller_note = nullif(btrim(coalesce(p_note, '')), ''), updated_at = now()
     where id = r.id;
    perform public.mivo_return_log(r.id, 'seller', 'offered', p_note, round(p_amount, 2));
  elsif p_action = 'dispute' then
    if coalesce(btrim(p_note), '') = '' then raise exception 'Explain why you dispute this request'; end if;
    update public.return_requests
       set status = 'mivo_review', dispute_note = btrim(p_note), updated_at = now()
     where id = r.id;
    perform public.mivo_return_log(r.id, 'seller', 'disputed', p_note, null);
  else
    raise exception 'Unknown action';
  end if;
end;
$$;

-- Customer: accept or reject the seller's offer, cancel, or send the item back.
create or replace function public.return_request_customer_action(
  p_id uuid, p_action text, p_courier text default null, p_tracking text default null, p_note text default null)
returns void language plpgsql security definer set search_path = public as $$
declare r public.return_requests%rowtype;
begin
  select * into r from public.return_requests where id = p_id for update;
  if not found or r.customer_id <> auth.uid() then raise exception 'Request not found'; end if;

  if p_action = 'accept_offer' and r.status = 'seller_offer' then
    update public.return_requests
       set status = 'refunding', final_amount = seller_amount, needs_return = false, updated_at = now()
     where id = r.id;
    perform public.mivo_return_log(r.id, 'customer', 'accepted_offer', p_note, r.seller_amount);
  elsif p_action = 'reject_offer' and r.status = 'seller_offer' then
    update public.return_requests set status = 'mivo_review', dispute_note = coalesce(nullif(btrim(p_note), ''), dispute_note), updated_at = now()
     where id = r.id;
    perform public.mivo_return_log(r.id, 'customer', 'rejected_offer', p_note, null);
  elsif p_action = 'ship_back' and r.status = 'approved_return' then
    if coalesce(btrim(p_courier), '') = '' or coalesce(btrim(p_tracking), '') = '' then
      raise exception 'Courier and tracking number are required';
    end if;
    update public.return_requests
       set status = 'returning', return_courier = btrim(p_courier), return_tracking = btrim(p_tracking), updated_at = now()
     where id = r.id;
    perform public.mivo_return_log(r.id, 'customer', 'shipped_back', btrim(p_courier) || ' ' || btrim(p_tracking), null);
  elsif p_action = 'cancel' and r.status in ('requested','seller_offer','mivo_review','approved_return') then
    update public.return_requests set status = 'cancelled', updated_at = now() where id = r.id;
    perform public.mivo_return_log(r.id, 'customer', 'cancelled', p_note, null);
  else
    raise exception 'This action is not available now';
  end if;
end;
$$;

-- Seller: item came back. OK → refund; otherwise propose a lower amount for MIVO to verify.
create or replace function public.return_request_seller_received(p_id uuid, p_ok boolean, p_amount numeric, p_note text)
returns void language plpgsql security definer set search_path = public as $$
declare r public.return_requests%rowtype;
begin
  select * into r from public.return_requests where id = p_id for update;
  if not found then raise exception 'Request not found'; end if;
  if not public.mivo_can_manage_shop(r.seller_id) then raise exception 'Not allowed'; end if;
  if r.status not in ('returning','approved_return') then raise exception 'This request is already %', r.status; end if;

  if p_ok then
    update public.return_requests set status = 'refunding', final_amount = requested_amount,
           seller_note = coalesce(nullif(btrim(p_note), ''), seller_note), updated_at = now()
     where id = r.id;
    perform public.mivo_return_log(r.id, 'seller', 'received_ok', p_note, r.requested_amount);
  else
    if p_amount is null or p_amount < 0 or p_amount >= r.requested_amount then
      raise exception 'Enter the amount you think should be refunded (less than RM%)', r.requested_amount;
    end if;
    if coalesce(btrim(p_note), '') = '' then raise exception 'Explain what is wrong with the returned item'; end if;
    update public.return_requests set status = 'mivo_review', seller_amount = round(p_amount, 2),
           dispute_note = btrim(p_note), updated_at = now()
     where id = r.id;
    perform public.mivo_return_log(r.id, 'seller', 'received_issue', p_note, round(p_amount, 2));
  end if;
end;
$$;

-- MIVO: final decision on a disputed request.
create or replace function public.return_request_mivo_decide(
  p_id uuid, p_approve boolean, p_amount numeric, p_require_return boolean, p_note text)
returns void language plpgsql security definer set search_path = public as $$
declare r public.return_requests%rowtype; v_quote jsonb;
begin
  if not public.is_admin() then raise exception 'Only MIVO can decide disputes'; end if;
  select * into r from public.return_requests where id = p_id for update;
  if not found then raise exception 'Request not found'; end if;
  if r.status in ('refunded','cancelled','closed') then raise exception 'This request is already %', r.status; end if;

  if not p_approve then
    update public.return_requests set status = 'rejected', mivo_note = nullif(btrim(coalesce(p_note, '')), ''), updated_at = now()
     where id = r.id;
    perform public.mivo_return_log(r.id, 'mivo', 'rejected', p_note, null);
    return;
  end if;

  v_quote := public.mivo_return_quote(r.order_id, r.items, r.reason);
  if p_amount is null or p_amount <= 0 or p_amount > (v_quote->>'max_refund')::numeric + coalesce(r.final_amount, 0) then
    raise exception 'Amount must be between RM0 and RM%', (v_quote->>'max_refund')::numeric;
  end if;

  if coalesce(p_require_return, false) and r.status not in ('returning','received') and r.return_tracking is null then
    update public.return_requests set status = 'approved_return', needs_return = true, final_amount = round(p_amount, 2),
           ship_back_by = now() + interval '7 days', mivo_note = nullif(btrim(coalesce(p_note, '')), ''), updated_at = now()
     where id = r.id;
  else
    update public.return_requests set status = 'refunding', final_amount = round(p_amount, 2),
           mivo_note = nullif(btrim(coalesce(p_note, '')), ''), updated_at = now()
     where id = r.id;
  end if;
  perform public.mivo_return_log(r.id, 'mivo', 'approved', p_note, round(p_amount, 2));
end;
$$;

-- Daily housekeeping (called by the cron with the service role).
create or replace function public.return_requests_auto()
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_accepted int := 0; v_closed int := 0; r record;
begin
  for r in select id, requested_amount, needs_return from public.return_requests
            where status = 'requested' and respond_by < now() loop
    update public.return_requests
       set status = case when r.needs_return then 'approved_return' else 'refunding' end,
           final_amount = case when r.needs_return then null else r.requested_amount end,
           ship_back_by = case when r.needs_return then now() + interval '7 days' end, updated_at = now()
     where id = r.id;
    perform public.mivo_return_log(r.id, 'system', 'auto_accepted', 'Seller did not respond within 2 days', r.requested_amount);
    v_accepted := v_accepted + 1;
  end loop;

  for r in select id from public.return_requests
            where status = 'approved_return' and ship_back_by < now() and return_tracking is null loop
    update public.return_requests set status = 'closed', updated_at = now() where id = r.id;
    perform public.mivo_return_log(r.id, 'system', 'auto_closed', 'Item was not sent back within 7 days', null);
    v_closed := v_closed + 1;
  end loop;

  return jsonb_build_object('auto_accepted', v_accepted, 'auto_closed', v_closed);
end;
$$;

-- When "requested" with needs_return accepted, final amount is set at receipt; for
-- convenience the amount to refund is coalesce(final_amount, requested_amount).

revoke all on function public.mivo_return_quote(uuid, jsonb, text) from public, anon, authenticated;
revoke all on function public.mivo_return_log(uuid, text, text, text, numeric) from public, anon, authenticated;
revoke all on function public.return_requests_auto() from public, anon, authenticated;
revoke all on function public.mivo_order_delivered_at(uuid) from public, anon;
grant execute on function public.return_request_preview(text, jsonb, text) to authenticated;
grant execute on function public.return_request_create(text, jsonb, text, text, text, text[]) to authenticated;
grant execute on function public.return_request_seller_respond(uuid, text, numeric, text) to authenticated;
grant execute on function public.return_request_customer_action(uuid, text, text, text, text) to authenticated;
grant execute on function public.return_request_seller_received(uuid, boolean, numeric, text) to authenticated;
grant execute on function public.return_request_mivo_decide(uuid, boolean, numeric, boolean, text) to authenticated;
grant execute on function public.mivo_can_manage_shop(uuid) to authenticated;
revoke all on function public.return_request_preview(text, jsonb, text) from public, anon;
revoke all on function public.return_request_create(text, jsonb, text, text, text, text[]) from public, anon;
revoke all on function public.return_request_seller_respond(uuid, text, numeric, text) from public, anon;
revoke all on function public.return_request_customer_action(uuid, text, text, text, text) from public, anon;
revoke all on function public.return_request_seller_received(uuid, boolean, numeric, text) from public, anon;
revoke all on function public.return_request_mivo_decide(uuid, boolean, numeric, boolean, text) from public, anon;

-- Evidence photos: private bucket, customers write to their own folder.
insert into storage.buckets (id, name, public) values ('return-evidence', 'return-evidence', false)
on conflict (id) do nothing;

drop policy if exists "MIVO return evidence upload" on storage.objects;
create policy "MIVO return evidence upload" on storage.objects for insert to authenticated
  with check (bucket_id = 'return-evidence' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "MIVO return evidence read" on storage.objects;
create policy "MIVO return evidence read" on storage.objects for select to authenticated
  using (bucket_id = 'return-evidence' and ((storage.foldername(name))[1] = auth.uid()::text or public.is_admin()));

commit;

-- Make new functions available to the website immediately.
notify pgrst, 'reload schema';
