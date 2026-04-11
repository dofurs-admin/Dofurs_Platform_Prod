begin;

create extension if not exists pgcrypto;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade on update cascade,
  full_name text not null,
  phone_number text not null,
  profile_photo_url text,
  date_of_birth date,
  gender text,
  total_pets integer not null default 0,
  first_pet_owner boolean not null default false,
  years_of_pet_experience integer,
  cancellation_rate numeric not null default 0,
  late_cancellation_count integer not null default 0,
  no_show_count integer not null default 0,
  average_rating numeric not null default 0,
  total_bookings integer not null default 0,
  flagged_count integer not null default 0,
  is_suspended boolean not null default false,
  is_phone_verified boolean not null default false,
  is_email_verified boolean not null default false,
  kyc_status text not null default 'not_submitted',
  government_id_type text,
  id_document_url text,
  lives_in text,
  has_other_pets boolean not null default false,
  number_of_people_in_house integer,
  has_children boolean not null default false,
  account_status text not null default 'active',
  risk_score numeric not null default 0,
  last_login_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint profiles_kyc_status_check check (kyc_status in ('not_submitted', 'pending', 'verified', 'rejected')),
  constraint profiles_account_status_check check (account_status in ('active', 'flagged', 'banned')),
  constraint profiles_total_pets_check check (total_pets >= 0),
  constraint profiles_years_of_pet_experience_check check (years_of_pet_experience is null or years_of_pet_experience >= 0),
  constraint profiles_cancellation_rate_check check (cancellation_rate >= 0),
  constraint profiles_late_cancellation_count_check check (late_cancellation_count >= 0),
  constraint profiles_no_show_count_check check (no_show_count >= 0),
  constraint profiles_average_rating_check check (average_rating >= 0),
  constraint profiles_total_bookings_check check (total_bookings >= 0),
  constraint profiles_flagged_count_check check (flagged_count >= 0),
  constraint profiles_risk_score_check check (risk_score >= 0),
  constraint profiles_number_of_people_in_house_check check (
    number_of_people_in_house is null or number_of_people_in_house >= 1
  )
);

create index if not exists idx_profiles_account_status on public.profiles(account_status);
create index if not exists idx_profiles_kyc_status on public.profiles(kyc_status);
create index if not exists idx_profiles_updated_at on public.profiles(updated_at desc);

insert into public.profiles (
  id,
  full_name,
  phone_number,
  profile_photo_url,
  gender,
  created_at,
  updated_at
)
select
  u.id,
  coalesce(nullif(trim(u.name), ''), nullif(split_part(coalesce(u.email, ''), '@', 1), ''), 'Pet Owner') as full_name,
  u.phone as phone_number,
  u.photo_url as profile_photo_url,
  case when u.gender in ('male', 'female', 'other') then u.gender else null end as gender,
  coalesce(u.created_at, now()) as created_at,
  coalesce(u.updated_at, now()) as updated_at
from public.users u
on conflict (id) do nothing;

create table if not exists public.user_addresses (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade on update cascade,
  label text,
  address_line_1 text not null,
  address_line_2 text,
  city text not null,
  state text not null,
  pincode text not null,
  country text not null,
  latitude numeric,
  longitude numeric,
  is_default boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint user_addresses_label_check check (label is null or label in ('Home', 'Office', 'Other'))
);

create index if not exists idx_user_addresses_user_id on public.user_addresses(user_id);

create table if not exists public.user_emergency_contacts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade on update cascade,
  contact_name text not null,
  relationship text,
  phone_number text not null,
  is_primary boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_user_emergency_contacts_user_id on public.user_emergency_contacts(user_id);

create table if not exists public.user_preferences (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references public.profiles(id) on delete cascade on update cascade,
  preferred_service_time text,
  preferred_groomer_gender text,
  communication_preference text,
  special_instructions text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint user_preferences_communication_preference_check check (
    communication_preference is null
    or communication_preference in ('call', 'whatsapp', 'app')
  )
);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_profiles_set_updated_at on public.profiles;
create trigger trg_profiles_set_updated_at
before update on public.profiles
for each row
execute function public.set_updated_at();

drop trigger if exists trg_user_addresses_set_updated_at on public.user_addresses;
create trigger trg_user_addresses_set_updated_at
before update on public.user_addresses
for each row
execute function public.set_updated_at();

drop trigger if exists trg_user_emergency_contacts_set_updated_at on public.user_emergency_contacts;
create trigger trg_user_emergency_contacts_set_updated_at
before update on public.user_emergency_contacts
for each row
execute function public.set_updated_at();

drop trigger if exists trg_user_preferences_set_updated_at on public.user_preferences;
create trigger trg_user_preferences_set_updated_at
before update on public.user_preferences
for each row
execute function public.set_updated_at();

alter table public.profiles enable row level security;
alter table public.user_addresses enable row level security;
alter table public.user_emergency_contacts enable row level security;
alter table public.user_preferences enable row level security;

drop policy if exists profiles_owner_manage on public.profiles;
create policy profiles_owner_manage
on public.profiles
for all
to authenticated
using (id = auth.uid())
with check (id = auth.uid());

drop policy if exists user_addresses_owner_manage on public.user_addresses;
create policy user_addresses_owner_manage
on public.user_addresses
for all
to authenticated
using (user_id = auth.uid())
with check (user_id = auth.uid());

drop policy if exists user_emergency_contacts_owner_manage on public.user_emergency_contacts;
create policy user_emergency_contacts_owner_manage
on public.user_emergency_contacts
for all
to authenticated
using (user_id = auth.uid())
with check (user_id = auth.uid());

drop policy if exists user_preferences_owner_manage on public.user_preferences;
create policy user_preferences_owner_manage
on public.user_preferences
for all
to authenticated
using (user_id = auth.uid())
with check (user_id = auth.uid());

commit;
