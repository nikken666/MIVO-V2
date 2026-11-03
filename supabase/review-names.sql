-- =====================================================================
-- MIVO reviews: anonymous (masked name) or public (real name)
-- Run once in Supabase → SQL Editor. Safe to re-run.
--
-- The customer chooses when rating an order. Anonymous reviews show a
-- masked name like "A****r"; public ones show the customer's name.
-- Reviews written before this show masked names.
-- =====================================================================

begin;

alter table public.product_reviews add column if not exists is_anonymous boolean not null default true;

create or replace function public.mivo_mask_name(p_name text)
returns text language sql immutable as $$
  select case
    when p_name is null or btrim(p_name) = '' then null
    when char_length(btrim(p_name)) <= 2 then left(btrim(p_name), 1) || '*'
    else left(btrim(p_name), 1) || repeat('*', least(char_length(btrim(p_name)) - 2, 4)) || right(btrim(p_name), 1)
  end;
$$;

-- Display names for published reviews. Never returns emails.
create or replace function public.product_review_names(p_ids uuid[])
returns table (id uuid, display_name text, is_anonymous boolean)
language sql stable security definer set search_path = public as $$
  select r.id,
         case when r.is_anonymous
              then coalesce(public.mivo_mask_name(coalesce(nullif(btrim(p.full_name), ''), split_part(u.email, '@', 1))), 'MIVO customer')
              else coalesce(nullif(btrim(p.full_name), ''), public.mivo_mask_name(split_part(u.email, '@', 1)), 'MIVO customer')
         end,
         r.is_anonymous
    from public.product_reviews r
    left join public.profiles p on p.id = r.user_id
    left join auth.users u on u.id = r.user_id
   where r.id = any(coalesce(p_ids, '{}'));
  -- Only maps the ids the product page already got from get_product_public_reviews,
  -- which decides which reviews are visible.
$$;

revoke all on function public.product_review_names(uuid[]) from public;
grant execute on function public.product_review_names(uuid[]) to anon, authenticated;

commit;

-- Make new functions available to the website immediately.
notify pgrst, 'reload schema';
