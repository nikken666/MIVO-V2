-- =====================================================================
-- Returns: MIVO decides whose fault it is, and books the return parcel.
--   * The customer's reason is only their claim. When accepting, MIVO
--     (admin) chooses "our fault" (item + its delivery share refunded,
--     return parcel booked and paid by MIVO via EasyParcel) or "not our
--     fault" (change-of-mind rules: no delivery refund, payment fee
--     deducted, customer sends it back at their own cost).
--   * A return booked with EasyParcel stores its AWB / label on the
--     request; the customer drops it off at a courier point and taps
--     "I've dropped it off".
-- Safe to re-run.
-- =====================================================================

begin;

alter table public.return_requests add column if not exists fault_decided_by text;
alter table public.return_requests add column if not exists return_awb_url text;
alter table public.return_requests add column if not exists return_ep_shipment text;
alter table public.return_requests add column if not exists return_label_cost numeric(12,2);
alter table public.return_requests add column if not exists return_booked_at timestamptz;

-- MIVO accepts a request and decides fault. Amounts are recalculated with
-- the same quote rules (faulty vs change of mind).
create or replace function public.return_request_mivo_accept(p_id uuid, p_our_fault boolean, p_note text default null)
returns jsonb language plpgsql security definer set search_path = public as $$
declare r public.return_requests%rowtype; v_quote jsonb; v_amount numeric;
begin
  if not public.is_admin() then raise exception 'Only MIVO can decide this'; end if;
  select * into r from public.return_requests where id = p_id for update;
  if not found then raise exception 'Request not found'; end if;
  if r.status not in ('requested', 'mivo_review', 'seller_offer') then raise exception 'This request is already %', r.status; end if;

  v_quote := public.mivo_return_quote(r.order_id, r.items, case when p_our_fault then 'defective' else 'changed_mind' end);
  v_amount := (v_quote->>'refund_amount')::numeric;

  update public.return_requests
     set seller_fault = p_our_fault,
         fault_decided_by = 'mivo',
         items_amount = (v_quote->>'items_amount')::numeric,
         shipping_refund = (v_quote->>'shipping_refund')::numeric,
         fee_deduction = (v_quote->>'fee_deduction')::numeric,
         requested_amount = v_amount,
         status = case when needs_return then 'approved_return' else 'refunding' end,
         final_amount = case when needs_return then null else v_amount end,
         ship_back_by = case when needs_return then now() + interval '7 days' end,
         mivo_note = coalesce(nullif(btrim(coalesce(p_note, '')), ''), mivo_note),
         updated_at = now()
   where id = r.id;
  perform public.mivo_return_log(r.id, 'mivo', case when p_our_fault then 'accepted_our_fault' else 'accepted_not_our_fault' end, p_note, v_amount);
  return jsonb_build_object('refund_amount', v_amount, 'needs_return', r.needs_return, 'our_fault', p_our_fault);
end;
$$;
revoke all on function public.return_request_mivo_accept(uuid, boolean, text) from public, anon;
grant execute on function public.return_request_mivo_accept(uuid, boolean, text) to authenticated;

-- Customer: dropped the pre-booked return parcel off at the courier.
create or replace function public.return_request_customer_dropped(p_id uuid)
returns void language plpgsql security definer set search_path = public as $$
declare r public.return_requests%rowtype;
begin
  select * into r from public.return_requests where id = p_id for update;
  if not found or r.customer_id <> auth.uid() then raise exception 'Request not found'; end if;
  if r.status <> 'approved_return' or r.return_tracking is null then raise exception 'This action is not available now'; end if;
  update public.return_requests set status = 'returning', shipped_back_at = now(), updated_at = now() where id = r.id;
  perform public.mivo_return_log(r.id, 'customer', 'shipped_back', coalesce(r.return_courier, '') || ' ' || r.return_tracking, null);
end;
$$;
revoke all on function public.return_request_customer_dropped(uuid) from public, anon;
grant execute on function public.return_request_customer_dropped(uuid) to authenticated;

commit;
notify pgrst, 'reload schema';
