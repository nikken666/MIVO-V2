-- =====================================================================
-- Every return / refund request is decided by MIVO.
--   * A shop can only give its view (agree, suggest a partial refund, or
--     disagree). The request keeps waiting for MIVO's decision.
--   * No more automatic approval when a shop doesn't answer within 2 days.
--   * A parcel sent back counts as arrived only when MIVO (or the shop)
--     marks it received. If nobody does within 14 days, it goes to MIVO's
--     review list instead of being refunded automatically.
--   * After it is marked received, the 3-day inspection and automatic
--     refund work as before, for the amount MIVO approved.
-- Safe to re-run.
-- =====================================================================

begin;

create or replace function public.return_request_seller_respond(p_id uuid, p_action text, p_amount numeric, p_note text)
returns void language plpgsql security definer set search_path = public as $$
declare r public.return_requests%rowtype;
begin
  select * into r from public.return_requests where id = p_id for update;
  if not found then raise exception 'Request not found'; end if;
  if not public.mivo_can_manage_shop(r.seller_id) then raise exception 'Not allowed'; end if;
  if r.status <> 'requested' then raise exception 'This request is already %', r.status; end if;

  if p_action = 'accept' then
    -- The shop agrees; MIVO still decides.
    update public.return_requests
       set seller_note = coalesce(nullif(btrim(coalesce(p_note, '')), ''), 'Shop agrees with this request.'),
           seller_amount = null, updated_at = now()
     where id = r.id;
    perform public.mivo_return_log(r.id, 'seller', 'seller_agreed', p_note, r.requested_amount);
  elsif p_action = 'offer' then
    -- A suggestion for MIVO (customer keeps the item); the customer isn't asked.
    if p_amount is null or p_amount <= 0 or p_amount >= r.requested_amount then
      raise exception 'Suggest an amount between RM0 and RM%', r.requested_amount;
    end if;
    update public.return_requests
       set seller_amount = round(p_amount, 2),
           seller_note = nullif(btrim(coalesce(p_note, '')), ''), updated_at = now()
     where id = r.id;
    perform public.mivo_return_log(r.id, 'seller', 'seller_suggested', p_note, round(p_amount, 2));
  elsif p_action = 'dispute' then
    if coalesce(btrim(p_note), '') = '' then raise exception 'Explain why you disagree'; end if;
    update public.return_requests
       set status = 'mivo_review', dispute_note = btrim(p_note), updated_at = now()
     where id = r.id;
    perform public.mivo_return_log(r.id, 'seller', 'disputed', p_note, null);
  else
    raise exception 'Unknown action';
  end if;
end;
$$;

create or replace function public.return_requests_auto()
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_closed int := 0; v_overdue int := 0; v_refund int := 0; r record;
begin
  -- Approved, but the item wasn't sent back in time.
  for r in select id from public.return_requests
            where status = 'approved_return' and ship_back_by < now() and return_tracking is null loop
    update public.return_requests set status = 'closed', updated_at = now() where id = r.id;
    perform public.mivo_return_log(r.id, 'system', 'auto_closed', 'Item was not sent back within 7 days', null);
    v_closed := v_closed + 1;
  end loop;

  -- Sent back 14+ days ago and nobody marked it received: MIVO checks it.
  for r in select id from public.return_requests
            where status = 'returning' and coalesce(shipped_back_at, updated_at) < now() - interval '14 days' loop
    update public.return_requests
       set status = 'mivo_review',
           dispute_note = coalesce(dispute_note, 'Parcel not marked received 14 days after it was sent back'),
           updated_at = now()
     where id = r.id;
    perform public.mivo_return_log(r.id, 'system', 'review_overdue', 'Parcel not marked received 14 days after it was sent back', null);
    v_overdue := v_overdue + 1;
  end loop;

  -- Marked received and no problem reported within 3 days: refund the approved amount.
  for r in select id, coalesce(final_amount, requested_amount) as amount from public.return_requests
            where status = 'received' and inspect_by < now() loop
    update public.return_requests
       set status = 'refunding', final_amount = r.amount, updated_at = now()
     where id = r.id;
    perform public.mivo_return_log(r.id, 'system', 'auto_refund', 'No problem reported within 3 days of arrival', r.amount);
    v_refund := v_refund + 1;
  end loop;

  return jsonb_build_object('auto_accepted', 0, 'auto_closed', v_closed,
                            'sent_to_review', v_overdue, 'auto_refund', v_refund);
end;
$$;
revoke all on function public.return_requests_auto() from public, anon, authenticated;

commit;

notify pgrst, 'reload schema';
