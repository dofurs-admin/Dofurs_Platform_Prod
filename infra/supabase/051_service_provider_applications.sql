begin;

create table if not exists public.service_provider_applications (
  id uuid primary key default gen_random_uuid(),
  submitted_by_user_id uuid references auth.users(id) on delete set null,
  full_name text not null,
  email text not null,
  phone_number text not null,
  city text not null,
  state text not null,
  provider_type text not null,
  years_of_experience integer not null default 0,
  service_modes text[] not null default '{}',
  service_areas text not null,
  portfolio_url text,
  motivation text,
  status text not null default 'pending' check (status in ('pending', 'under_review', 'approved', 'rejected')),
  admin_notes text,
  reviewed_by uuid references auth.users(id) on delete set null,
  reviewed_at timestamptz,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint service_provider_applications_email_check check (position('@' in email) > 1),
  constraint service_provider_applications_phone_check check (length(trim(phone_number)) between 10 and 20)
);

create index if not exists idx_service_provider_applications_status_created_at
  on public.service_provider_applications(status, created_at desc);

create index if not exists idx_service_provider_applications_created_at
  on public.service_provider_applications(created_at desc);

create or replace function public.touch_service_provider_applications_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := timezone('utc', now());
  return new;
end;
$$;

drop trigger if exists trg_touch_service_provider_applications on public.service_provider_applications;
create trigger trg_touch_service_provider_applications
before update on public.service_provider_applications
for each row
execute function public.touch_service_provider_applications_updated_at();

alter table public.service_provider_applications enable row level security;

drop policy if exists service_provider_applications_public_insert on public.service_provider_applications;
create policy service_provider_applications_public_insert
on public.service_provider_applications
for insert
to anon, authenticated
with check (true);

drop policy if exists service_provider_applications_admin_select on public.service_provider_applications;
create policy service_provider_applications_admin_select
on public.service_provider_applications
for select
to authenticated
using (public.is_admin());

drop policy if exists service_provider_applications_admin_update on public.service_provider_applications;
create policy service_provider_applications_admin_update
on public.service_provider_applications
for update
to authenticated
using (public.is_admin())
with check (public.is_admin());

commit;
