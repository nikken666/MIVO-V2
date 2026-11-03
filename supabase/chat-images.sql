-- =====================================================================
-- MIVO chat: photos in chat (both sides). Run after chat.sql. Safe to re-run.
-- Photos go to a PRIVATE bucket, in a folder per conversation; only the
-- customer and the shop in that chat (and MIVO admins) can see them.
-- =====================================================================

begin;

alter table public.chat_messages add column if not exists image_path text;

-- A message may now be just a photo.
do $$
declare c text;
begin
  for c in
    select conname from pg_constraint
     where conrelid = 'public.chat_messages'::regclass and contype = 'c'
       and pg_get_constraintdef(oid) ilike '%product_id is not null%'
  loop
    execute format('alter table public.chat_messages drop constraint %I', c);
  end loop;
end;
$$;
alter table public.chat_messages drop constraint if exists chat_messages_has_content;
alter table public.chat_messages add constraint chat_messages_has_content
  check (coalesce(btrim(body), '') <> '' or product_id is not null or order_number is not null or image_path is not null);

create or replace function public.chat_is_participant(p_conversation_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.chat_conversations c
     where c.id = p_conversation_id
       and (c.customer_id = auth.uid() or public.mivo_can_manage_shop(c.seller_id))
  );
$$;
revoke all on function public.chat_is_participant(uuid) from public, anon;
grant execute on function public.chat_is_participant(uuid) to authenticated;

create or replace function public.chat_send(
  p_conversation_id uuid,
  p_body text,
  p_product_id uuid default null,
  p_order_number text default null,
  p_image_path text default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_conv public.chat_conversations%rowtype;
  v_role text;
  v_body text := nullif(btrim(coalesce(p_body, '')), '');
  v_image text := nullif(btrim(coalesce(p_image_path, '')), '');
  v_id uuid;
begin
  select * into v_conv from public.chat_conversations where id = p_conversation_id for update;
  if not found then
    raise exception 'Chat not found';
  end if;

  if v_conv.customer_id = auth.uid() then
    v_role := 'customer';
  elsif public.mivo_can_manage_shop(v_conv.seller_id) then
    v_role := 'seller';
  else
    raise exception 'Not allowed';
  end if;

  if v_body is not null and length(v_body) > 2000 then
    raise exception 'Message is too long';
  end if;
  if v_image is not null and split_part(v_image, '/', 1) <> v_conv.id::text then
    raise exception 'Photo not found';
  end if;
  if p_order_number is not null and not exists (
    select 1 from public.orders o
     where o.order_number = p_order_number and o.user_id = v_conv.customer_id
  ) then
    raise exception 'Order not found';
  end if;

  insert into public.chat_messages
    (conversation_id, sender_role, sender_id, body, product_id, order_number, image_path)
  values
    (v_conv.id, v_role, auth.uid(), v_body, p_product_id, nullif(btrim(p_order_number), ''), v_image)
  returning id into v_id;

  update public.chat_conversations
     set last_message_at = now(),
         last_message_preview = left(coalesce(v_body,
           case when v_image is not null then '[Photo]'
                when p_product_id is not null then '[Product]' else '[Order]' end), 140),
         customer_unread = case when v_role = 'seller' then customer_unread + 1 else customer_unread end,
         seller_unread = case when v_role = 'customer' then seller_unread + 1 else seller_unread end
   where id = v_conv.id;

  return v_id;
end;
$$;
revoke all on function public.chat_send(uuid, text, uuid, text, text) from public, anon;
grant execute on function public.chat_send(uuid, text, uuid, text, text) to authenticated;
-- The old 4-argument version would make calls ambiguous.
drop function if exists public.chat_send(uuid, text, uuid, text);

insert into storage.buckets (id, name, public, file_size_limit)
values ('chat-images', 'chat-images', false, 5242880)
on conflict (id) do nothing;

drop policy if exists "MIVO chat photos upload" on storage.objects;
create policy "MIVO chat photos upload" on storage.objects for insert to authenticated
  with check (bucket_id = 'chat-images' and public.chat_is_participant(((storage.foldername(name))[1])::uuid));
drop policy if exists "MIVO chat photos read" on storage.objects;
create policy "MIVO chat photos read" on storage.objects for select to authenticated
  using (bucket_id = 'chat-images' and public.chat_is_participant(((storage.foldername(name))[1])::uuid));

commit;

notify pgrst, 'reload schema';
