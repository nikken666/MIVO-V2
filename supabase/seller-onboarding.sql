-- =====================================================================
-- MIVO seller onboarding (marketplace style): business details, bank
-- account and documents (IC, SSM, bank statement) for review.
-- Run once in Supabase → SQL Editor, AFTER seller-centre.sql. Safe to re-run.
--
-- Documents go to a PRIVATE storage bucket; only the applicant and MIVO
-- admins can open them. MIVO approves, rejects or asks for more info.
-- =====================================================================

begin;

create table if not exists public.seller_applications (
  id uuid primary key default gen_random_uuid(),
  seller_id uuid not null references public.sellers(id) on delete cascade,
  owner_id uuid not null references auth.users(id) on delete cascade,
  seller_type text not null check (seller_type in ('individual', 'business')),
  legal_name text not null,
  ic_number text,
  business_reg_no text,
  tin text,
  sst_no text,
  phone text not null,
  email text,
  business_address text not null,
  pickup_address jsonb not null,
  bank_name text not null,
  bank_account_name text not null,
  bank_account_no text not null,
  documents jsonb not null default '{}'::jsonb,   -- {ic_front, ic_back, ssm, bank_statement, other[]} storage paths
  categories text,
  status text not null default 'submitted' check (status in ('submitted', 'more_info', 'approved', 'rejected')),
  admin_note text,
  reviewed_by uuid references auth.users(id) on delete set null,
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (seller_id)
);
alter table public.seller_applications enable row level security;
revoke all on public.seller_applications from anon, authenticated;

drop policy if exists "applications: owner or admin read" on public.seller_applications;
create policy "applications: owner or admin read" on public.seller_applications for select to authenticated
  using (owner_id = auth.uid() or public.is_admin());
grant select on public.seller_applications to authenticated;

-- Submit (or resubmit after "more info") an application.
create or replace function public.seller_submit_application(p jsonb)
returns uuid language plpgsql security definer set search_path = public as $$
declare
  v_seller uuid;
  v_app public.seller_applications%rowtype;
  v_type text := p->>'seller_type';
  v_docs jsonb := coalesce(p->'documents', '{}'::jsonb);
begin
  if auth.uid() is null then raise exception 'Please sign in'; end if;
  if v_type not in ('individual', 'business') then raise exception 'Choose individual or business seller'; end if;
  if coalesce(btrim(p->>'shop_name'), '') = '' then raise exception 'Shop name is required'; end if;
  if coalesce(btrim(p->>'legal_name'), '') = '' then raise exception 'Legal name is required'; end if;
  if coalesce(btrim(p->>'phone'), '') = '' then raise exception 'Phone number is required'; end if;
  if coalesce(btrim(p->>'business_address'), '') = '' then raise exception 'Address is required'; end if;
  if coalesce(btrim(p->>'bank_name'), '') = '' or coalesce(btrim(p->>'bank_account_name'), '') = ''
     or coalesce(btrim(p->>'bank_account_no'), '') = '' then
    raise exception 'Bank details are required';
  end if;
  if v_type = 'individual' and (coalesce(btrim(p->>'ic_number'), '') = '' or v_docs->>'ic_front' is null or v_docs->>'ic_back' is null) then
    raise exception 'IC number and both sides of your IC are required';
  end if;
  if v_type = 'business' and (coalesce(btrim(p->>'business_reg_no'), '') = '' or v_docs->>'ssm' is null) then
    raise exception 'SSM registration number and SSM certificate are required';
  end if;
  if v_docs->>'bank_statement' is null then raise exception 'Upload a bank statement header showing the account name'; end if;
  -- Documents must be the applicant's own uploads.
  if exists (select 1 from jsonb_each_text(v_docs - 'other') d where split_part(d.value, '/', 1) <> auth.uid()::text) then
    raise exception 'Invalid document';
  end if;

  -- Resubmission of an existing application?
  select * into v_app from public.seller_applications
   where owner_id = auth.uid() and (p->>'application_id') is not null and id = (p->>'application_id')::uuid;

  if found then
    if v_app.status not in ('more_info', 'rejected') then raise exception 'This application is already %', v_app.status; end if;
    v_seller := v_app.seller_id;
    update public.sellers set shop_name = btrim(p->>'shop_name'), status = 'pending', updated_at = now() where id = v_seller;
  else
    v_seller := public.seller_apply(p->>'shop_name', p->>'phone', p->>'categories');
  end if;

  insert into public.seller_applications as a (
    seller_id, owner_id, seller_type, legal_name, ic_number, business_reg_no, tin, sst_no, phone, email,
    business_address, pickup_address, bank_name, bank_account_name, bank_account_no, documents, categories, status)
  values (
    v_seller, auth.uid(), v_type, btrim(p->>'legal_name'), nullif(btrim(p->>'ic_number'), ''),
    nullif(btrim(p->>'business_reg_no'), ''), nullif(btrim(p->>'tin'), ''), nullif(btrim(p->>'sst_no'), ''),
    btrim(p->>'phone'), (select email from auth.users where id = auth.uid()),
    btrim(p->>'business_address'), coalesce(p->'pickup_address', '{}'::jsonb),
    btrim(p->>'bank_name'), btrim(p->>'bank_account_name'), regexp_replace(p->>'bank_account_no', '\s', '', 'g'),
    v_docs, nullif(btrim(p->>'categories'), ''), 'submitted')
  on conflict (seller_id) do update set
    seller_type = excluded.seller_type, legal_name = excluded.legal_name, ic_number = excluded.ic_number,
    business_reg_no = excluded.business_reg_no, tin = excluded.tin, sst_no = excluded.sst_no, phone = excluded.phone,
    business_address = excluded.business_address, pickup_address = excluded.pickup_address,
    bank_name = excluded.bank_name, bank_account_name = excluded.bank_account_name,
    bank_account_no = excluded.bank_account_no, documents = excluded.documents, categories = excluded.categories,
    status = 'submitted', updated_at = now();

  return v_seller;
end;
$$;

-- MIVO: review an application.
create or replace function public.admin_review_application(p_id uuid, p_decision text, p_note text)
returns void language plpgsql security definer set search_path = public as $$
declare a public.seller_applications%rowtype;
begin
  if not public.is_admin() then raise exception 'Only MIVO can review applications'; end if;
  if p_decision not in ('approved', 'rejected', 'more_info') then raise exception 'Unknown decision'; end if;
  if p_decision <> 'approved' and coalesce(btrim(p_note), '') = '' then
    raise exception 'Tell the seller why (shown to them)';
  end if;
  select * into a from public.seller_applications where id = p_id for update;
  if not found then raise exception 'Application not found'; end if;

  update public.seller_applications
     set status = p_decision, admin_note = nullif(btrim(coalesce(p_note, '')), ''),
         reviewed_by = auth.uid(), reviewed_at = now(), updated_at = now()
   where id = p_id;

  if p_decision = 'approved' then
    update public.sellers set status = 'approved', approved_at = coalesce(approved_at, now()), updated_at = now()
     where id = a.seller_id;
    -- Copy contact/bank details onto the shop record where those columns exist.
    begin
      execute 'update public.sellers set phone = $1 where id = $2' using a.phone, a.seller_id;
    exception when undefined_column then null; end;
    begin
      execute 'update public.sellers set bank_name = $1, bank_account_name = $2, bank_account_number = $3 where id = $4'
        using a.bank_name, a.bank_account_name, a.bank_account_no, a.seller_id;
    exception when undefined_column then null; end;
  elsif p_decision = 'rejected' then
    update public.sellers set status = 'rejected', updated_at = now() where id = a.seller_id;
  end if;
exception when check_violation then
  raise exception 'The sellers table does not allow status %', p_decision;
end;
$$;

revoke all on function public.seller_submit_application(jsonb) from public, anon;
revoke all on function public.admin_review_application(uuid, text, text) from public, anon;
grant execute on function public.seller_submit_application(jsonb) to authenticated;
grant execute on function public.admin_review_application(uuid, text, text) to authenticated;

-- Private documents bucket: applicants write to their own folder.
insert into storage.buckets (id, name, public) values ('seller-documents', 'seller-documents', false)
on conflict (id) do nothing;

drop policy if exists "MIVO seller documents upload" on storage.objects;
create policy "MIVO seller documents upload" on storage.objects for insert to authenticated
  with check (bucket_id = 'seller-documents' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "MIVO seller documents read" on storage.objects;
create policy "MIVO seller documents read" on storage.objects for select to authenticated
  using (bucket_id = 'seller-documents' and ((storage.foldername(name))[1] = auth.uid()::text or public.is_admin()));

commit;

-- Make new functions available to the website immediately.
notify pgrst, 'reload schema';
