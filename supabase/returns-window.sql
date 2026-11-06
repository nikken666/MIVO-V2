-- =====================================================================
-- Return window and automatic completion
--   * 7 days after delivery (EasyParcel tracking or "Mark delivered") the
--     order is completed automatically, unless a return is open.
--   * Returns can be requested up to 15 days after delivery. Within 7 days
--     a return MIVO accepts as its fault gets a free EasyParcel return;
--     from day 8 the customer posts it back to MIVO HUB at their own cost.
-- Safe to re-run.
-- =====================================================================

begin;

alter table public.return_requests add column if not exists free_return boolean not null default true;

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
  v_free boolean;
begin
  select * into o from public.orders where order_number = p_order_number and user_id = auth.uid() for update;
  if not found then raise exception 'Order not found'; end if;
  if o.status not in ('shipped','delivered','completed') then
    raise exception 'Returns open once the order has shipped';
  end if;
  if o.status = 'shipped' and p_reason <> 'not_received' and p_reason <> 'damaged' then
    raise exception 'Please confirm you received the order first, or choose "not received"';
  end if;
  v_delivered := public.mivo_order_delivered_at(o.id);
  if o.status in ('delivered','completed') and coalesce(v_delivered, o.updated_at) < now() - interval '15 days' then
    raise exception 'The 15-day return window for this order has passed. Please use a warranty claim instead.';
  end if;
  -- Within 7 days of delivery a return MIVO accepts as its fault is booked for free;
  -- after that (days 8-15) the customer posts it back at their own cost.
  v_free := o.status = 'shipped' or coalesce(v_delivered, o.updated_at) >= now() - interval '7 days';
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
    requested_amount, needs_return, respond_by, free_return)
  values (
    v_number, o.id, v_seller_order, v_seller, auth.uid(), p_items, p_reason, p_solution,
    nullif(btrim(coalesce(p_description, '')), ''), coalesce(p_evidence, '{}'),
    (v_quote->>'seller_fault')::boolean, (v_quote->>'items_amount')::numeric,
    (v_quote->>'shipping_refund')::numeric, (v_quote->>'fee_deduction')::numeric,
    (v_quote->>'refund_amount')::numeric, p_solution = 'return_refund', now() + interval '2 days', v_free)
  returning id into v_id;

  perform public.mivo_return_log(v_id, 'customer', 'requested', p_description, (v_quote->>'refund_amount')::numeric);
  return v_id;
end;
$$;

create or replace function public.mivo_auto_complete_orders()
returns integer language plpgsql security definer set search_path = public as $$
declare r record; v_count integer := 0;
begin
  for r in
    select o.id from public.orders o
     where o.status = 'delivered'
       and coalesce(public.mivo_order_delivered_at(o.id), o.updated_at) < now() - interval '7 days'
       and not exists (select 1 from public.return_requests q where q.order_id = o.id
                        and q.status not in ('rejected','cancelled','closed','refunded'))
     for update skip locked
  loop
    update public.orders set status = 'completed', updated_at = now() where id = r.id;
    update public.seller_orders set status = 'completed' where order_id = r.id and status = 'delivered';
    insert into public.order_status_history (order_id, old_status, new_status, note)
    values (r.id, 'delivered', 'completed', 'Completed automatically 7 days after delivery');
    v_count := v_count + 1;
  end loop;
  return v_count;
end;
$$;
revoke all on function public.mivo_auto_complete_orders() from public, anon, authenticated;

commit;
notify pgrst, 'reload schema';
