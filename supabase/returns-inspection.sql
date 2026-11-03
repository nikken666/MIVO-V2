-- =====================================================================
-- MIVO returns: 3-day seller inspection, then automatic refund
-- Run once in Supabase → SQL Editor, AFTER returns.sql. Safe to re-run.
--
--   1. The customer sends the item back (status "returning").
--   2. The seller marks the parcel arrived → status "received" and a 3-day
--      inspection window starts. If the seller never marks it, it counts as
--      arrived 7 days after the customer sent it.
--   3. Within those 3 days the seller can confirm it's fine (refund now) or
--      report a problem (MIVO reviews). With no reply, the refund goes out
--      automatically when the window ends (daily job).
-- =====================================================================

begin;

alter table public.return_requests add column if not exists shipped_back_at timestamptz;
alter table public.return_requests add column if not exists received_at timestamptz;
alter table public.return_requests add column if not exists inspect_by timestamptz;

-- Remember when the customer sent the item back.
create or replace function public.mivo_return_shipped_back()
returns trigger language plpgsql as $$
begin
  if new.status = 'returning' and (tg_op = 'INSERT' or old.status is distinct from 'returning') then
    new.shipped_back_at := coalesce(new.shipped_back_at, now());
  end if;
  return new;
end;
$$;
drop trigger if exists mivo_return_shipped_back on public.return_requests;
create trigger mivo_return_shipped_back before insert or update of status on public.return_requests
for each row execute function public.mivo_return_shipped_back();

-- Seller: the returned parcel has arrived; start the 3-day inspection.
create or replace function public.return_request_seller_arrived(p_id uuid)
returns void language plpgsql security definer set search_path = public as $$
declare r public.return_requests%rowtype;
begin
  select * into r from public.return_requests where id = p_id for update;
  if not found then raise exception 'Request not found'; end if;
  if not public.mivo_can_manage_shop(r.seller_id) then raise exception 'Not allowed'; end if;
  if r.status not in ('returning', 'approved_return') then raise exception 'This request is already %', r.status; end if;
  update public.return_requests
     set status = 'received', received_at = now(), inspect_by = now() + interval '3 days', updated_at = now()
   where id = r.id;
  perform public.mivo_return_log(r.id, 'seller', 'arrived', 'Parcel arrived; 3-day inspection started', null);
end;
$$;

-- Seller: item is fine (refund) or has a problem (MIVO review). Also allowed
-- during the inspection window ("received").
create or replace function public.return_request_seller_received(p_id uuid, p_ok boolean, p_amount numeric, p_note text)
returns void language plpgsql security definer set search_path = public as $$
declare r public.return_requests%rowtype;
begin
  select * into r from public.return_requests where id = p_id for update;
  if not found then raise exception 'Request not found'; end if;
  if not public.mivo_can_manage_shop(r.seller_id) then raise exception 'Not allowed'; end if;
  if r.status not in ('returning', 'approved_return', 'received') then raise exception 'This request is already %', r.status; end if;

  if p_ok then
    update public.return_requests set status = 'refunding', final_amount = requested_amount,
           received_at = coalesce(received_at, now()),
           seller_note = coalesce(nullif(btrim(p_note), ''), seller_note), updated_at = now()
     where id = r.id;
    perform public.mivo_return_log(r.id, 'seller', 'received_ok', p_note, r.requested_amount);
  else
    if p_amount is null or p_amount < 0 or p_amount >= r.requested_amount then
      raise exception 'Enter the amount you think should be refunded (less than RM%)', r.requested_amount;
    end if;
    if coalesce(btrim(p_note), '') = '' then raise exception 'Explain what is wrong with the returned item'; end if;
    update public.return_requests set status = 'mivo_review', seller_amount = round(p_amount, 2),
           received_at = coalesce(received_at, now()),
           dispute_note = btrim(p_note), updated_at = now()
     where id = r.id;
    perform public.mivo_return_log(r.id, 'seller', 'received_issue', p_note, round(p_amount, 2));
  end if;
end;
$$;

-- Daily job (called by /api/cron/capture-holds).
create or replace function public.return_requests_auto()
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_accepted int := 0; v_closed int := 0; v_arrived int := 0; v_refund int := 0; r record;
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

  -- Sent back 7+ days ago and the seller never marked it arrived: start the inspection.
  for r in select id from public.return_requests
            where status = 'returning' and coalesce(shipped_back_at, updated_at) < now() - interval '7 days' loop
    update public.return_requests
       set status = 'received', received_at = now(), inspect_by = now() + interval '3 days', updated_at = now()
     where id = r.id;
    perform public.mivo_return_log(r.id, 'system', 'arrived', 'Treated as arrived 7 days after it was sent back; 3-day inspection started', null);
    v_arrived := v_arrived + 1;
  end loop;

  -- Inspection over without a dispute: approve the refund (paid out by the same job).
  for r in select id, requested_amount from public.return_requests
            where status = 'received' and inspect_by < now() loop
    update public.return_requests
       set status = 'refunding', final_amount = requested_amount, updated_at = now()
     where id = r.id;
    perform public.mivo_return_log(r.id, 'system', 'auto_refund', 'No problem reported within 3 days of arrival', r.requested_amount);
    v_refund := v_refund + 1;
  end loop;

  return jsonb_build_object('auto_accepted', v_accepted, 'auto_closed', v_closed,
                            'auto_arrived', v_arrived, 'auto_refund', v_refund);
end;
$$;

revoke all on function public.return_requests_auto() from public, anon, authenticated;
revoke all on function public.return_request_seller_arrived(uuid) from public, anon;
grant execute on function public.return_request_seller_arrived(uuid) to authenticated;
grant execute on function public.return_request_seller_received(uuid, boolean, numeric, text) to authenticated;

commit;

-- Make new functions available to the website immediately.
notify pgrst, 'reload schema';
