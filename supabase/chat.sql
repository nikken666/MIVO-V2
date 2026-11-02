-- =====================================================================
-- MIVO chat: customers chat with a shop; MIVO admins (and a shop's own
-- owner) reply as the shop. Run once in Supabase → SQL Editor. Safe to
-- re-run. Also adds a profile picture column for "Me" pages.
-- =====================================================================

begin;

alter table public.profiles add column if not exists avatar_url text;
alter table public.profiles add column if not exists username text;
alter table public.profiles add column if not exists preferred_language text;

create table if not exists public.chat_conversations (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references auth.users(id) on delete cascade,
  seller_id uuid not null references public.sellers(id) on delete cascade,
  last_message_at timestamptz not null default now(),
  last_message_preview text,
  customer_unread integer not null default 0,
  seller_unread integer not null default 0,
  created_at timestamptz not null default now(),
  unique (customer_id, seller_id)
);

create table if not exists public.chat_messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.chat_conversations(id) on delete cascade,
  sender_role text not null check (sender_role in ('customer', 'seller')),
  sender_id uuid references auth.users(id) on delete set null,
  body text,
  product_id uuid references public.products(id) on delete set null,
  order_number text,
  created_at timestamptz not null default now(),
  check (coalesce(btrim(body), '') <> '' or product_id is not null or order_number is not null)
);

create index if not exists chat_messages_conversation_idx
  on public.chat_messages (conversation_id, created_at);
create index if not exists chat_conversations_seller_idx
  on public.chat_conversations (seller_id, last_message_at desc);
create index if not exists chat_conversations_customer_idx
  on public.chat_conversations (customer_id, last_message_at desc);

-- Who may act for a shop: MIVO admins and the shop's owner.
create or replace function public.mivo_can_manage_shop(p_seller_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.is_admin()
      or exists (select 1 from public.sellers s where s.id = p_seller_id and s.owner_id = auth.uid());
$$;

alter table public.chat_conversations enable row level security;
alter table public.chat_messages enable row level security;

drop policy if exists "chat conversations: participants read" on public.chat_conversations;
create policy "chat conversations: participants read"
  on public.chat_conversations for select to authenticated
  using (customer_id = auth.uid() or public.mivo_can_manage_shop(seller_id));

drop policy if exists "chat messages: participants read" on public.chat_messages;
create policy "chat messages: participants read"
  on public.chat_messages for select to authenticated
  using (exists (
    select 1 from public.chat_conversations c
     where c.id = conversation_id
       and (c.customer_id = auth.uid() or public.mivo_can_manage_shop(c.seller_id))
  ));

-- Writes only go through the functions below.
revoke insert, update, delete on public.chat_conversations from anon, authenticated;
revoke insert, update, delete on public.chat_messages from anon, authenticated;
grant select on public.chat_conversations, public.chat_messages to authenticated;

-- Customer opens (or reopens) a chat with a shop.
create or replace function public.chat_start(p_seller_id uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
begin
  if auth.uid() is null then
    raise exception 'Please sign in to chat';
  end if;
  if not exists (select 1 from public.sellers where id = p_seller_id and status = 'approved') then
    raise exception 'Shop not found';
  end if;

  insert into public.chat_conversations (customer_id, seller_id)
  values (auth.uid(), p_seller_id)
  on conflict (customer_id, seller_id) do update set customer_id = excluded.customer_id
  returning id into v_id;
  return v_id;
end;
$$;

-- Send a message. The role is decided here, never by the client.
create or replace function public.chat_send(
  p_conversation_id uuid,
  p_body text,
  p_product_id uuid default null,
  p_order_number text default null
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
  if p_order_number is not null and not exists (
    select 1 from public.orders o
     where o.order_number = p_order_number and o.user_id = v_conv.customer_id
  ) then
    raise exception 'Order not found';
  end if;

  insert into public.chat_messages
    (conversation_id, sender_role, sender_id, body, product_id, order_number)
  values
    (v_conv.id, v_role, auth.uid(), v_body, p_product_id, nullif(btrim(p_order_number), ''))
  returning id into v_id;

  update public.chat_conversations
     set last_message_at = now(),
         last_message_preview = left(coalesce(v_body,
           case when p_product_id is not null then '[Product]' else '[Order]' end), 140),
         customer_unread = case when v_role = 'seller' then customer_unread + 1 else customer_unread end,
         seller_unread = case when v_role = 'customer' then seller_unread + 1 else seller_unread end
   where id = v_conv.id;

  return v_id;
end;
$$;

create or replace function public.chat_mark_read(p_conversation_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_conv public.chat_conversations%rowtype;
begin
  select * into v_conv from public.chat_conversations where id = p_conversation_id;
  if not found then return; end if;
  if v_conv.customer_id = auth.uid() then
    update public.chat_conversations set customer_unread = 0 where id = v_conv.id;
  elsif public.mivo_can_manage_shop(v_conv.seller_id) then
    update public.chat_conversations set seller_unread = 0 where id = v_conv.id;
  end if;
end;
$$;

revoke all on function public.chat_start(uuid) from public, anon;
revoke all on function public.chat_send(uuid, text, uuid, text) from public, anon;
revoke all on function public.chat_mark_read(uuid) from public, anon;
revoke all on function public.mivo_can_manage_shop(uuid) from public, anon;
grant execute on function public.chat_start(uuid) to authenticated;
grant execute on function public.chat_send(uuid, text, uuid, text) to authenticated;
grant execute on function public.chat_mark_read(uuid) to authenticated;
grant execute on function public.mivo_can_manage_shop(uuid) to authenticated;

-- Profiles: a user edits their own name, username, picture, phone, language.
create or replace function public.profile_update(
  p_full_name text,
  p_username text,
  p_avatar_url text,
  p_phone text,
  p_language text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_username text := nullif(lower(btrim(coalesce(p_username, ''))), '');
begin
  if auth.uid() is null then
    raise exception 'Please sign in';
  end if;
  if v_username is not null and v_username !~ '^[a-z0-9._]{3,30}$' then
    raise exception 'Username: 3-30 letters, numbers, dots or underscores';
  end if;
  if v_username is not null and exists (
    select 1 from public.profiles where lower(username) = v_username and id <> auth.uid()
  ) then
    raise exception 'That username is taken';
  end if;
  if p_language is not null and p_language not in ('en', 'ms', 'zh') then
    raise exception 'Unknown language';
  end if;

  update public.profiles
     set full_name = coalesce(nullif(btrim(p_full_name), ''), full_name),
         -- null = leave as is; '' = clear.
         username = case when p_username is null then username else v_username end,
         avatar_url = case when p_avatar_url is null then avatar_url
                           else nullif(btrim(p_avatar_url), '') end,
         phone = coalesce(nullif(btrim(p_phone), ''), phone),
         preferred_language = coalesce(p_language, preferred_language)
   where id = auth.uid();
end;
$$;

revoke all on function public.profile_update(text, text, text, text, text) from public, anon;
grant execute on function public.profile_update(text, text, text, text, text) to authenticated;

create unique index if not exists profiles_username_unique_idx
  on public.profiles (lower(username)) where username is not null;

-- Profile pictures: public "avatars" bucket, each user writes only avatars/<own id>/...
insert into storage.buckets (id, name, public)
values ('avatars', 'avatars', true)
on conflict (id) do nothing;

drop policy if exists "MIVO users upload own avatar" on storage.objects;
create policy "MIVO users upload own avatar"
  on storage.objects for insert to authenticated
  with check (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "MIVO users replace own avatar" on storage.objects;
create policy "MIVO users replace own avatar"
  on storage.objects for update to authenticated
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "MIVO users delete own avatar" on storage.objects;
create policy "MIVO users delete own avatar"
  on storage.objects for delete to authenticated
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);

-- Live updates.
do $$
begin
  alter publication supabase_realtime add table public.chat_messages;
exception when duplicate_object or undefined_object then null;
end $$;
do $$
begin
  alter publication supabase_realtime add table public.chat_conversations;
exception when duplicate_object or undefined_object then null;
end $$;

commit;


-- Make new functions available to the website immediately.
notify pgrst, 'reload schema';
