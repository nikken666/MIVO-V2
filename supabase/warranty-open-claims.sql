-- =====================================================================
-- Warranty claims for every delivered item. Items whose shop hasn't set a
-- warranty period can still be claimed; MIVO approves or rejects each claim.
-- A rejected claim must carry a reason for the customer. Safe to re-run.
-- =====================================================================

begin;

create or replace function public.create_warranty_claim(
  p_order_number text,
  p_order_item_id uuid,
  p_issue_type text,
  p_description text,
  p_image_urls text[] default '{}'
)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  o public.orders%rowtype;
  oi public.order_items%rowtype;
  v_start timestamptz;
  v_expires timestamptz;
  v_number text;
  c public.warranty_claims%rowtype;
begin
  if auth.uid() is null then raise exception 'Please sign in'; end if;
  select * into o from public.orders where order_number = p_order_number and user_id = auth.uid();
  if not found then raise exception 'Order not found'; end if;
  if o.status not in ('delivered', 'completed') then
    raise exception 'Warranty claims open once the order is delivered';
  end if;
  select * into oi from public.order_items where id = p_order_item_id and order_id = o.id;
  if not found then raise exception 'Item not found in this order'; end if;
  if p_issue_type not in ('defect','noise','leakage','fitment','damage','performance','other') then
    raise exception 'Choose an issue type';
  end if;
  if length(btrim(coalesce(p_description, ''))) < 10 then
    raise exception 'Describe the problem (at least 10 characters)';
  end if;
  if cardinality(coalesce(p_image_urls, '{}')) > 6 then raise exception 'Up to 6 photos per claim'; end if;

  v_start := coalesce(
    (select max(h.created_at) from public.order_status_history h where h.order_id = o.id and h.new_status = 'delivered'),
    o.paid_at, o.created_at);
  -- No set warranty: no fixed end date, MIVO decides.
  v_expires := v_start + make_interval(months => greatest(coalesce(oi.warranty_months, 0), 0));
  if coalesce(oi.warranty_months, 0) > 0 and now() > v_expires then
    raise exception 'The warranty for this item has expired';
  end if;

  if exists (select 1 from public.warranty_claims w where w.order_item_id = oi.id and w.user_id = auth.uid()
               and w.status in ('new', 'reviewing', 'approved')) then
    raise exception 'There is already an active warranty claim for this item';
  end if;

  v_number := 'WC' || to_char(now() at time zone 'Asia/Kuala_Lumpur', 'YYMMDD') || '-'
              || upper(substr(md5(gen_random_uuid()::text), 1, 6));

  insert into public.warranty_claims (
    claim_number, user_id, order_id, order_number, order_item_id, product_id, product_name, variant_name,
    warranty_months, warranty_start_at, warranty_expires_at, issue_type, description, image_urls)
  values (
    v_number, auth.uid(), o.id, o.order_number, oi.id, oi.product_id, oi.product_name, oi.variant_name,
    coalesce(oi.warranty_months, 0), v_start, v_expires, p_issue_type, btrim(p_description), coalesce(p_image_urls, '{}'))
  returning * into c;

  return jsonb_build_object('id', c.id, 'claim_number', c.claim_number, 'status', c.status, 'created_at', c.created_at);
end;
$$;
revoke all on function public.create_warranty_claim(text, uuid, text, text, text[]) from public, anon;
grant execute on function public.create_warranty_claim(text, uuid, text, text, text[]) to authenticated;

create or replace function public.admin_update_warranty_claim(
  p_claim_id uuid, p_status text, p_admin_note text default null, p_resolution_note text default null)
returns jsonb language plpgsql security definer set search_path = public as $$
declare c public.warranty_claims%rowtype;
begin
  if not public.is_admin() then raise exception 'Only MIVO admins can update warranty claims'; end if;
  if p_status not in ('new','reviewing','approved','rejected','completed') then
    raise exception 'Unknown claim status %', p_status;
  end if;
  if p_status = 'rejected' and length(btrim(coalesce(p_admin_note, ''))) < 5 then
    raise exception 'Write the reason for the customer in "Customer update" before rejecting';
  end if;
  update public.warranty_claims
     set status = p_status,
         admin_note = nullif(btrim(coalesce(p_admin_note, '')), ''),
         resolution_note = nullif(btrim(coalesce(p_resolution_note, '')), ''),
         reviewed_by = auth.uid(), reviewed_at = now(), updated_at = now()
   where id = p_claim_id
  returning * into c;
  if not found then raise exception 'Claim not found'; end if;
  return jsonb_build_object('id', c.id, 'claim_number', c.claim_number, 'status', c.status);
end;
$$;
revoke all on function public.admin_update_warranty_claim(uuid, text, text, text) from public, anon;
grant execute on function public.admin_update_warranty_claim(uuid, text, text, text) to authenticated;

commit;
notify pgrst, 'reload schema';
