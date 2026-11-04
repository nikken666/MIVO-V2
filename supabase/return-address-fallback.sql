-- =====================================================================
-- Returns: where the customer sends the item back. Safe to re-run.
-- Uses the shop's return address; when that is empty, the shop's pickup
-- address (usually the same warehouse), so the customer always sees one.
-- =====================================================================

begin;

create or replace function public.return_request_return_address(p_request_id uuid)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare
  v jsonb;
  s record;
  pickup jsonb;
  line text;
begin
  select sl.shop_name, sl.return_name, sl.return_phone, sl.return_address,
         to_jsonb(sl) -> 'pickup_address' as pickup_address, to_jsonb(sl) ->> 'phone' as shop_phone
    into s
    from public.return_requests r join public.sellers sl on sl.id = r.seller_id
   where r.id = p_request_id and r.customer_id = auth.uid()
     and r.status in ('approved_return', 'returning');
  if not found then return null; end if;

  if coalesce(btrim(s.return_address), '') <> '' then
    return jsonb_build_object('shop', s.shop_name, 'name', s.return_name, 'phone', s.return_phone, 'address', s.return_address);
  end if;

  pickup := case when jsonb_typeof(s.pickup_address) = 'object' then s.pickup_address else '{}'::jsonb end;
  line := concat_ws(', ',
    nullif(btrim(coalesce(pickup ->> 'line', pickup ->> 'address_line_1', pickup ->> 'address', '')), ''),
    nullif(btrim(coalesce(pickup ->> 'line2', pickup ->> 'address_line_2', '')), ''),
    nullif(btrim(concat_ws(' ', pickup ->> 'postcode', pickup ->> 'city')), ''),
    nullif(btrim(coalesce(pickup ->> 'state', '')), ''));
  if coalesce(line, '') = '' then
    return jsonb_build_object('shop', s.shop_name, 'name', s.return_name, 'phone', s.return_phone, 'address', null);
  end if;
  v := jsonb_build_object(
    'shop', s.shop_name,
    'name', coalesce(nullif(btrim(s.return_name), ''), pickup ->> 'name', s.shop_name),
    'phone', coalesce(nullif(btrim(s.return_phone), ''), pickup ->> 'phone', s.shop_phone),
    'address', line);
  return v;
end;
$$;
revoke all on function public.return_request_return_address(uuid) from public, anon;
grant execute on function public.return_request_return_address(uuid) to authenticated;

commit;

notify pgrst, 'reload schema';
