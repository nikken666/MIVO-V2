-- =====================================================================
-- MIVO: let sellers see who they are dealing with.
-- Run once in Supabase → SQL Editor, AFTER seller-centre.sql, chat.sql
-- and returns.sql. Safe to re-run.
--
-- Sellers can't read the profiles or orders tables directly, so their
-- returns and chat screens showed "Customer" and "—". This returns only
-- the name and avatar of customers who bought from, chatted with or asked
-- for a return from the caller's own shops, and the order numbers of
-- those shops' orders. Emails and phone numbers are not included.
-- =====================================================================

begin;

create or replace function public.seller_customer_info(p_customer_ids uuid[], p_order_ids uuid[])
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare
  v_people jsonb;
  v_orders jsonb;
begin
  if auth.uid() is null then return jsonb_build_object('people', '[]'::jsonb, 'orders', '[]'::jsonb); end if;

  select coalesce(jsonb_agg(jsonb_build_object('id', p.id, 'full_name', p.full_name, 'avatar_url', to_jsonb(p) ->> 'avatar_url')), '[]'::jsonb)
    into v_people
    from public.profiles p
   where p.id = any(coalesce(p_customer_ids, '{}'))
     and (
       public.is_admin()
       or exists (select 1 from public.chat_conversations c where c.customer_id = p.id and c.seller_id in (select public.my_shop_ids()))
       or exists (select 1 from public.return_requests r where r.customer_id = p.id and r.seller_id in (select public.my_shop_ids()))
       or exists (select 1 from public.seller_orders so join public.orders o on o.id = so.order_id
                   where o.user_id = p.id and so.seller_id in (select public.my_shop_ids()))
     );

  select coalesce(jsonb_agg(jsonb_build_object('id', o.id, 'order_number', o.order_number)), '[]'::jsonb)
    into v_orders
    from public.orders o
   where o.id = any(coalesce(p_order_ids, '{}'))
     and (
       public.is_admin()
       or exists (select 1 from public.seller_orders so where so.order_id = o.id and so.seller_id in (select public.my_shop_ids()))
     );

  return jsonb_build_object('people', v_people, 'orders', v_orders);
end;
$$;

revoke all on function public.seller_customer_info(uuid[], uuid[]) from public, anon;
grant execute on function public.seller_customer_info(uuid[], uuid[]) to authenticated;

commit;

-- Make new functions available to the website immediately.
notify pgrst, 'reload schema';
