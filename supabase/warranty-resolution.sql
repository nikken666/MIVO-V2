-- =====================================================================
-- MIVO warranty: what happens after a claim is approved
-- Run once in Supabase → SQL Editor. Safe to re-run.
--
-- MIVO picks how to resolve an approved claim:
--   replace  – send a new part      repair – fix and send it back
--   refund   – refund through Stripe (up to what was paid for the item)
-- and whether the customer must send the faulty part back first.
--
-- Stages (warranty_claims.resolution_stage):
--   awaiting_return → returning → (MIVO receives it) →
--     to_ship → shipped → done          (replace / repair)
--     refund_pending → refunded         (refund)
-- Every step is logged in warranty_claim_events and shown to both sides.
-- =====================================================================

begin;

alter table public.warranty_claims add column if not exists resolution_type text;
alter table public.warranty_claims add column if not exists resolution_stage text;
alter table public.warranty_claims add column if not exists needs_return boolean not null default false;
alter table public.warranty_claims add column if not exists return_courier text;
alter table public.warranty_claims add column if not exists return_tracking text;
alter table public.warranty_claims add column if not exists returned_at timestamptz;
alter table public.warranty_claims add column if not exists item_received_at timestamptz;
alter table public.warranty_claims add column if not exists replacement_courier text;
alter table public.warranty_claims add column if not exists replacement_tracking text;
alter table public.warranty_claims add column if not exists replacement_shipped_at timestamptz;
alter table public.warranty_claims add column if not exists refund_amount numeric(12,2);
alter table public.warranty_claims add column if not exists stripe_refund_id text;
alter table public.warranty_claims add column if not exists refunded_at timestamptz;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'warranty_claims_resolution_type_check') then
    alter table public.warranty_claims add constraint warranty_claims_resolution_type_check
      check (resolution_type is null or resolution_type in ('replace', 'repair', 'refund'));
  end if;
  if not exists (select 1 from pg_constraint where conname = 'warranty_claims_resolution_stage_check') then
    alter table public.warranty_claims add constraint warranty_claims_resolution_stage_check
      check (resolution_stage is null or resolution_stage in
        ('awaiting_return', 'returning', 'to_ship', 'shipped', 'refund_pending', 'refunded', 'done'));
  end if;
end;
$$;

create table if not exists public.warranty_claim_events (
  id uuid primary key default gen_random_uuid(),
  claim_id uuid not null references public.warranty_claims(id) on delete cascade,
  actor text not null,            -- customer | mivo | system
  action text not null,
  note text,
  created_at timestamptz not null default now()
);
create index if not exists warranty_claim_events_claim on public.warranty_claim_events (claim_id, created_at);
alter table public.warranty_claim_events enable row level security;
revoke all on public.warranty_claim_events from anon, authenticated;
grant select on public.warranty_claim_events to authenticated;
drop policy if exists "warranty events: owner or admin" on public.warranty_claim_events;
create policy "warranty events: owner or admin" on public.warranty_claim_events for select to authenticated
  using (public.is_admin() or exists (select 1 from public.warranty_claims c where c.id = claim_id and c.user_id = auth.uid()));

create or replace function public.mivo_warranty_log(p_claim uuid, p_actor text, p_action text, p_note text)
returns void language sql security definer set search_path = public as $$
  insert into public.warranty_claim_events (claim_id, actor, action, note)
  values (p_claim, p_actor, p_action, nullif(btrim(coalesce(p_note, '')), ''));
$$;

-- MIVO: choose how an approved claim is resolved.
create or replace function public.admin_warranty_set_resolution(
  p_claim_id uuid, p_type text, p_needs_return boolean, p_refund_amount numeric, p_note text
)
returns void language plpgsql security definer set search_path = public as $$
declare c public.warranty_claims%rowtype; v_paid numeric;
begin
  if not public.is_admin() then raise exception 'Only MIVO can resolve warranty claims'; end if;
  select * into c from public.warranty_claims where id = p_claim_id for update;
  if not found then raise exception 'Claim not found'; end if;
  if c.status not in ('approved', 'reviewing', 'new') then raise exception 'This claim is already %', c.status; end if;
  if p_type not in ('replace', 'repair', 'refund') then raise exception 'Choose replace, repair or refund'; end if;
  if c.resolution_stage in ('shipped', 'refunded', 'done') then raise exception 'This claim is already resolved'; end if;

  if p_type = 'refund' then
    select coalesce(line_subtotal, unit_price * quantity) into v_paid from public.order_items where id = c.order_item_id;
    if p_refund_amount is null or p_refund_amount <= 0 then raise exception 'Enter the refund amount'; end if;
    if v_paid is not null and p_refund_amount > v_paid then
      raise exception 'The refund can''t be more than the customer paid for this item (RM%)', v_paid;
    end if;
  end if;

  update public.warranty_claims
     set status = 'approved',
         resolution_type = p_type,
         needs_return = coalesce(p_needs_return, false),
         refund_amount = case when p_type = 'refund' then round(p_refund_amount, 2) end,
         resolution_stage = case
           when coalesce(p_needs_return, false) then 'awaiting_return'
           when p_type = 'refund' then 'refund_pending'
           else 'to_ship' end,
         resolution_note = coalesce(nullif(btrim(coalesce(p_note, '')), ''), resolution_note),
         reviewed_by = auth.uid(), reviewed_at = now(), updated_at = now()
   where id = c.id;
  perform public.mivo_warranty_log(c.id, 'mivo', 'resolution_' || p_type, p_note);
end;
$$;

-- Customer: the faulty part is on its way back.
create or replace function public.warranty_customer_ship_back(p_claim_id uuid, p_courier text, p_tracking text)
returns void language plpgsql security definer set search_path = public as $$
declare c public.warranty_claims%rowtype;
begin
  select * into c from public.warranty_claims where id = p_claim_id for update;
  if not found or c.user_id <> auth.uid() then raise exception 'Claim not found'; end if;
  if c.resolution_stage is distinct from 'awaiting_return' then raise exception 'Nothing to send back for this claim'; end if;
  if coalesce(btrim(p_courier), '') = '' or coalesce(btrim(p_tracking), '') = '' then
    raise exception 'Enter the courier and tracking number';
  end if;
  update public.warranty_claims
     set resolution_stage = 'returning', return_courier = btrim(p_courier), return_tracking = btrim(p_tracking),
         returned_at = now(), updated_at = now()
   where id = c.id;
  perform public.mivo_warranty_log(c.id, 'customer', 'shipped_back', btrim(p_courier) || ' ' || btrim(p_tracking));
end;
$$;

-- MIVO: the faulty part has arrived.
create or replace function public.admin_warranty_item_received(p_claim_id uuid, p_note text)
returns void language plpgsql security definer set search_path = public as $$
declare c public.warranty_claims%rowtype;
begin
  if not public.is_admin() then raise exception 'Only MIVO can update warranty claims'; end if;
  select * into c from public.warranty_claims where id = p_claim_id for update;
  if not found then raise exception 'Claim not found'; end if;
  if c.resolution_stage not in ('awaiting_return', 'returning') then raise exception 'This claim is not waiting for the item'; end if;
  update public.warranty_claims
     set resolution_stage = case when c.resolution_type = 'refund' then 'refund_pending' else 'to_ship' end,
         item_received_at = now(), updated_at = now()
   where id = c.id;
  perform public.mivo_warranty_log(c.id, 'mivo', 'item_received', p_note);
end;
$$;

-- MIVO: the replacement (or repaired part) is on its way to the customer.
create or replace function public.admin_warranty_ship_replacement(p_claim_id uuid, p_courier text, p_tracking text)
returns void language plpgsql security definer set search_path = public as $$
declare c public.warranty_claims%rowtype;
begin
  if not public.is_admin() then raise exception 'Only MIVO can update warranty claims'; end if;
  select * into c from public.warranty_claims where id = p_claim_id for update;
  if not found then raise exception 'Claim not found'; end if;
  if c.resolution_stage is distinct from 'to_ship' then raise exception 'This claim has nothing to ship yet'; end if;
  if coalesce(btrim(p_courier), '') = '' or coalesce(btrim(p_tracking), '') = '' then
    raise exception 'Enter the courier and tracking number';
  end if;
  update public.warranty_claims
     set resolution_stage = 'shipped', replacement_courier = btrim(p_courier),
         replacement_tracking = btrim(p_tracking), replacement_shipped_at = now(), updated_at = now()
   where id = c.id;
  perform public.mivo_warranty_log(c.id, 'mivo', 'replacement_shipped', btrim(p_courier) || ' ' || btrim(p_tracking));
end;
$$;

-- Customer: the replacement / repaired part arrived. Claim complete.
create or replace function public.warranty_customer_confirm(p_claim_id uuid)
returns void language plpgsql security definer set search_path = public as $$
declare c public.warranty_claims%rowtype;
begin
  select * into c from public.warranty_claims where id = p_claim_id for update;
  if not found or c.user_id <> auth.uid() then raise exception 'Claim not found'; end if;
  if c.resolution_stage is distinct from 'shipped' then raise exception 'Nothing to confirm yet'; end if;
  update public.warranty_claims
     set resolution_stage = 'done', status = 'completed', updated_at = now()
   where id = c.id;
  perform public.mivo_warranty_log(c.id, 'customer', 'received', null);
end;
$$;

revoke all on function public.mivo_warranty_log(uuid, text, text, text) from public, anon, authenticated;
revoke all on function public.admin_warranty_set_resolution(uuid, text, boolean, numeric, text) from public, anon;
revoke all on function public.warranty_customer_ship_back(uuid, text, text) from public, anon;
revoke all on function public.admin_warranty_item_received(uuid, text) from public, anon;
revoke all on function public.admin_warranty_ship_replacement(uuid, text, text) from public, anon;
revoke all on function public.warranty_customer_confirm(uuid) from public, anon;
grant execute on function public.admin_warranty_set_resolution(uuid, text, boolean, numeric, text) to authenticated;
grant execute on function public.warranty_customer_ship_back(uuid, text, text) to authenticated;
grant execute on function public.admin_warranty_item_received(uuid, text) to authenticated;
grant execute on function public.admin_warranty_ship_replacement(uuid, text, text) to authenticated;
grant execute on function public.warranty_customer_confirm(uuid) to authenticated;

commit;

-- Make new functions available to the website immediately.
notify pgrst, 'reload schema';
