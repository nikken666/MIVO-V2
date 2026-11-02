-- =====================================================================
-- Shop return address
-- Run once in Supabase → SQL Editor. Safe to re-run.
-- Customers only see a shop's return address on their own approved
-- return request (not public).
-- =====================================================================

begin;

alter table public.sellers add column if not exists return_name text;
alter table public.sellers add column if not exists return_phone text;
alter table public.sellers add column if not exists return_address text;

create or replace function public.admin_save_shop_return_address(p_id uuid, p_name text, p_phone text, p_address text)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not (public.is_admin() or exists (select 1 from public.sellers where id = p_id and owner_id = auth.uid())) then
    raise exception 'Not allowed';
  end if;
  update public.sellers
     set return_name = nullif(btrim(coalesce(p_name, '')), ''),
         return_phone = nullif(btrim(coalesce(p_phone, '')), ''),
         return_address = nullif(btrim(coalesce(p_address, '')), ''),
         updated_at = now()
   where id = p_id;
end;
$$;

create or replace function public.admin_get_shop_return_address(p_id uuid)
returns jsonb language plpgsql stable security definer set search_path = public as $$
begin
  if not (public.is_admin() or exists (select 1 from public.sellers where id = p_id and owner_id = auth.uid())) then
    raise exception 'Not allowed';
  end if;
  return (select jsonb_build_object('name', return_name, 'phone', return_phone, 'address', return_address)
            from public.sellers where id = p_id);
end;
$$;

-- Customer: where to send the item back, only for their approved request.
create or replace function public.return_request_return_address(p_request_id uuid)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare v jsonb;
begin
  select jsonb_build_object('shop', s.shop_name, 'name', s.return_name, 'phone', s.return_phone, 'address', s.return_address)
    into v
  from public.return_requests r join public.sellers s on s.id = r.seller_id
  where r.id = p_request_id and r.customer_id = auth.uid()
    and r.status in ('approved_return', 'returning');
  return v;
end;
$$;

revoke all on function public.admin_save_shop_return_address(uuid, text, text, text) from public, anon;
revoke all on function public.admin_get_shop_return_address(uuid) from public, anon;
revoke all on function public.return_request_return_address(uuid) from public, anon;
grant execute on function public.admin_save_shop_return_address(uuid, text, text, text) to authenticated;
grant execute on function public.admin_get_shop_return_address(uuid) to authenticated;
grant execute on function public.return_request_return_address(uuid) to authenticated;

commit;
