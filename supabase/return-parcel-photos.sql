-- =====================================================================
-- Returns: the customer adds photos of the packed parcel / drop-off
-- receipt when sending the item back. "I've dropped it off" needs at
-- least one. Safe to re-run.
-- =====================================================================

begin;

alter table public.return_requests add column if not exists return_parcel_photos text[] not null default '{}';

create or replace function public.return_request_add_parcel_photos(p_id uuid, p_paths text[])
returns void language plpgsql security definer set search_path = public as $$
declare r public.return_requests%rowtype;
begin
  select * into r from public.return_requests where id = p_id for update;
  if not found or r.customer_id <> auth.uid() then raise exception 'Request not found'; end if;
  if r.status not in ('approved_return', 'returning') then raise exception 'Photos can be added while sending the item back'; end if;
  if exists (select 1 from unnest(coalesce(p_paths, '{}')) p where split_part(p, '/', 1) <> auth.uid()::text) then
    raise exception 'Invalid photo';
  end if;
  update public.return_requests
     set return_parcel_photos = (array(select distinct x from unnest(coalesce(return_parcel_photos, '{}') || coalesce(p_paths, '{}')) x))[1:6],
         updated_at = now()
   where id = r.id;
end;
$$;
revoke all on function public.return_request_add_parcel_photos(uuid, text[]) from public, anon;
grant execute on function public.return_request_add_parcel_photos(uuid, text[]) to authenticated;

-- Dropping off a booked return needs a parcel photo.
create or replace function public.return_request_customer_dropped(p_id uuid)
returns void language plpgsql security definer set search_path = public as $$
declare r public.return_requests%rowtype;
begin
  select * into r from public.return_requests where id = p_id for update;
  if not found or r.customer_id <> auth.uid() then raise exception 'Request not found'; end if;
  if r.status <> 'approved_return' or r.return_tracking is null then raise exception 'This action is not available now'; end if;
  if cardinality(coalesce(r.return_parcel_photos, '{}')) = 0 then raise exception 'Add a photo of the parcel first'; end if;
  update public.return_requests set status = 'returning', shipped_back_at = now(), updated_at = now() where id = r.id;
  perform public.mivo_return_log(r.id, 'customer', 'shipped_back', coalesce(r.return_courier, '') || ' ' || r.return_tracking, null);
end;
$$;
revoke all on function public.return_request_customer_dropped(uuid) from public, anon;
grant execute on function public.return_request_customer_dropped(uuid) to authenticated;

commit;
notify pgrst, 'reload schema';
