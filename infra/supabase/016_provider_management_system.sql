begin;

create extension if not exists pgcrypto;

-- 1) Provider type enum
DO $$
begin
  if not exists (
    select 1
    from pg_type t
    join pg_namespace n on n.oid = t.typnamespace
    where t.typname = 'provider_type_enum'
      and n.nspname = 'public'
  ) then
    create type public.provider_type_enum as enum (
      'groomer',
      'veterinarian',
      'clinic',
      'trainer',
      'walker',
      'sitter',
      'boarding_center',
      'ambulance',
      'retailer'
    );
  end if;
end
$$;

-- 2) Extend existing providers table safely (legacy bigint PK retained for compatibility)
alter table public.providers
  add column if not exists user_id uuid references auth.users(id) on delete set null,
  add column if not exists provider_type public.provider_type_enum not null default 'groomer',
  add column if not exists is_individual boolean not null default true,
  add column if not exists business_name text,
  add column if not exists profile_photo_url text,
  add column if not exists bio text,
  add column if not exists years_of_experience integer,
  add column if not exists phone_number text,
  add column if not exists email text,
  add column if not exists is_verified boolean not null default false,
  add column if not exists verification_status text not null default 'pending',
  add column if not exists background_verified boolean not null default false,
  add column if not exists admin_approval_status text not null default 'pending',
  add column if not exists account_status text not null default 'active',
  add column if not exists average_rating numeric not null default 0,
  add column if not exists total_bookings integer not null default 0,
  add column if not exists performance_score numeric not null default 0,
  add column if not exists cancellation_rate numeric not null default 0,
  add column if not exists no_show_count integer not null default 0,
  add column if not exists ranking_score numeric not null default 0,
  add column if not exists accepts_platform_payment boolean not null default false,
  add column if not exists payout_method_type text,
  add column if not exists payout_details jsonb,
  add column if not exists updated_at timestamptz not null default now();

update public.providers
set provider_type = case
  when type = 'clinic' then 'clinic'::public.provider_type_enum
  when type = 'grooming' then 'groomer'::public.provider_type_enum
  when type = 'home' then 'veterinarian'::public.provider_type_enum
  else 'groomer'::public.provider_type_enum
end
where provider_type is null;

update public.providers
set is_individual = case
  when provider_type = 'clinic' then false
  else true
end
where is_individual is null;

update public.providers
set business_name = coalesce(nullif(trim(business_name), ''), nullif(trim(name), ''))
where business_name is null;

DO $$
begin
  if not exists (select 1 from pg_constraint where conname = 'providers_verification_status_check_v2') then
    alter table public.providers
      add constraint providers_verification_status_check_v2
      check (verification_status in ('pending', 'approved', 'rejected'));
  end if;

  if not exists (select 1 from pg_constraint where conname = 'providers_admin_approval_status_check_v2') then
    alter table public.providers
      add constraint providers_admin_approval_status_check_v2
      check (admin_approval_status in ('pending', 'approved', 'rejected'));
  end if;

  if not exists (select 1 from pg_constraint where conname = 'providers_account_status_check_v2') then
    alter table public.providers
      add constraint providers_account_status_check_v2
      check (account_status in ('active', 'suspended', 'banned'));
  end if;

  if not exists (select 1 from pg_constraint where conname = 'providers_years_of_experience_check_v2') then
    alter table public.providers
      add constraint providers_years_of_experience_check_v2
      check (years_of_experience is null or years_of_experience >= 0);
  end if;

  if not exists (select 1 from pg_constraint where conname = 'providers_service_radius_km_check_v2') then
    alter table public.providers
      add constraint providers_service_radius_km_check_v2
      check (service_radius_km is null or service_radius_km >= 0);
  end if;

  if not exists (select 1 from pg_constraint where conname = 'providers_metrics_non_negative_check_v2') then
    alter table public.providers
      add constraint providers_metrics_non_negative_check_v2
      check (
        average_rating >= 0
        and total_bookings >= 0
        and performance_score >= 0
        and cancellation_rate >= 0
        and no_show_count >= 0
        and ranking_score >= 0
      );
  end if;
end
$$;

create index if not exists idx_providers_user_id on public.providers(user_id);
create unique index if not exists uq_providers_user_id_not_null on public.providers(user_id) where user_id is not null;
create index if not exists idx_providers_provider_type on public.providers(provider_type);
create index if not exists idx_providers_approval_status on public.providers(admin_approval_status, account_status);
create index if not exists idx_providers_updated_at on public.providers(updated_at desc);

-- 3) Professional details (individual providers)
create table if not exists public.provider_professional_details (
  id uuid primary key default gen_random_uuid(),
  provider_id bigint not null unique references public.providers(id) on delete cascade,
  license_number text,
  specialization text,
  teleconsult_enabled boolean not null default false,
  emergency_service_enabled boolean not null default false,
  equipment_details text,
  insurance_document_url text,
  license_verified boolean not null default false,
  created_at timestamptz not null default now()
);

create index if not exists idx_provider_professional_details_provider_id
on public.provider_professional_details(provider_id);

-- 4) Clinic details (facility providers)
create table if not exists public.provider_clinic_details (
  id uuid primary key default gen_random_uuid(),
  provider_id bigint not null unique references public.providers(id) on delete cascade,
  registration_number text,
  gst_number text,
  address text,
  city text,
  state text,
  pincode text,
  latitude numeric,
  longitude numeric,
  operating_hours jsonb,
  number_of_doctors integer,
  hospitalization_available boolean not null default false,
  emergency_services_available boolean not null default false,
  registration_verified boolean not null default false,
  created_at timestamptz not null default now(),
  constraint provider_clinic_details_number_of_doctors_check
    check (number_of_doctors is null or number_of_doctors >= 0)
);

create index if not exists idx_provider_clinic_details_provider_id
on public.provider_clinic_details(provider_id);
create index if not exists idx_provider_clinic_details_city_state
on public.provider_clinic_details(city, state);

-- 5) Provider services (pricing admin-controlled)
create table if not exists public.provider_services (
  id uuid primary key default gen_random_uuid(),
  provider_id bigint not null references public.providers(id) on delete cascade,
  service_type text not null,
  base_price numeric not null,
  surge_price numeric,
  commission_percentage numeric,
  service_duration_minutes integer,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  constraint provider_services_base_price_check check (base_price >= 0),
  constraint provider_services_surge_price_check check (surge_price is null or surge_price >= 0),
  constraint provider_services_commission_percentage_check check (
    commission_percentage is null or (commission_percentage >= 0 and commission_percentage <= 100)
  ),
  constraint provider_services_duration_check check (
    service_duration_minutes is null or service_duration_minutes > 0
  )
);

create index if not exists idx_provider_services_provider_id
on public.provider_services(provider_id);
create index if not exists idx_provider_services_service_type
on public.provider_services(service_type);

-- 6) Provider availability
create table if not exists public.provider_availability (
  id uuid primary key default gen_random_uuid(),
  provider_id bigint not null references public.providers(id) on delete cascade,
  day_of_week integer not null,
  start_time time not null,
  end_time time not null,
  is_available boolean not null default true,
  created_at timestamptz not null default now(),
  constraint provider_availability_day_of_week_check check (day_of_week between 0 and 6),
  constraint provider_availability_time_check check (end_time > start_time)
);

create index if not exists idx_provider_availability_provider_id
on public.provider_availability(provider_id);
create index if not exists idx_provider_availability_provider_day
on public.provider_availability(provider_id, day_of_week);

-- 7) Provider documents
create table if not exists public.provider_documents (
  id uuid primary key default gen_random_uuid(),
  provider_id bigint not null references public.providers(id) on delete cascade,
  document_type text,
  document_url text,
  verification_status text not null default 'pending',
  verified_at timestamptz,
  created_at timestamptz not null default now(),
  constraint provider_documents_verification_status_check
    check (verification_status in ('pending', 'approved', 'rejected'))
);

create index if not exists idx_provider_documents_provider_id
on public.provider_documents(provider_id);
create index if not exists idx_provider_documents_type_status
on public.provider_documents(document_type, verification_status);

-- 8) Provider reviews (system managed)
create table if not exists public.provider_reviews (
  id uuid primary key default gen_random_uuid(),
  provider_id bigint not null references public.providers(id) on delete cascade,
  booking_id bigint references public.bookings(id) on delete set null,
  user_id uuid references public.users(id) on delete set null,
  rating integer not null,
  review_text text,
  provider_response text,
  created_at timestamptz not null default now(),
  constraint provider_reviews_rating_check check (rating >= 1 and rating <= 5)
);

create index if not exists idx_provider_reviews_provider_id
on public.provider_reviews(provider_id);
create index if not exists idx_provider_reviews_booking_id
on public.provider_reviews(booking_id);
create index if not exists idx_provider_reviews_created_at
on public.provider_reviews(created_at desc);

-- Shared helper (already used in repository; safe to keep current definition)
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_providers_set_updated_at on public.providers;
create trigger trg_providers_set_updated_at
before update on public.providers
for each row
execute function public.set_updated_at();

create or replace function public.is_provider_owner(p_provider_id bigint)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.providers p
    where p.id = p_provider_id
      and (
        p.user_id = auth.uid()
        or (public.is_provider() and p.id = public.current_provider_id())
      )
  );
$$;

grant execute on function public.is_provider_owner(bigint) to authenticated, service_role;

-- Restrict provider updates to allowed fields only
create or replace function public.enforce_provider_editable_fields()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.role() = 'service_role' or public.is_admin() then
    return new;
  end if;

  if public.is_provider_owner(old.id) then
    if old.bio is distinct from new.bio
      or old.profile_photo_url is distinct from new.profile_photo_url
      or old.years_of_experience is distinct from new.years_of_experience
      or old.phone_number is distinct from new.phone_number
      or old.email is distinct from new.email
      or old.service_radius_km is distinct from new.service_radius_km then
      -- Allowed changes; now verify nothing else changed.
      null;
    end if;

    if old.user_id is distinct from new.user_id
      or old.provider_type is distinct from new.provider_type
      or old.is_individual is distinct from new.is_individual
      or old.business_name is distinct from new.business_name
      or old.is_verified is distinct from new.is_verified
      or old.verification_status is distinct from new.verification_status
      or old.background_verified is distinct from new.background_verified
      or old.admin_approval_status is distinct from new.admin_approval_status
      or old.account_status is distinct from new.account_status
      or old.average_rating is distinct from new.average_rating
      or old.total_bookings is distinct from new.total_bookings
      or old.performance_score is distinct from new.performance_score
      or old.cancellation_rate is distinct from new.cancellation_rate
      or old.no_show_count is distinct from new.no_show_count
      or old.ranking_score is distinct from new.ranking_score
      or old.accepts_platform_payment is distinct from new.accepts_platform_payment
      or old.payout_method_type is distinct from new.payout_method_type
      or old.payout_details is distinct from new.payout_details
      or old.name is distinct from new.name
      or old.type is distinct from new.type
      or old.address is distinct from new.address
      or old.lat is distinct from new.lat
      or old.lng is distinct from new.lng
      or old.working_days is distinct from new.working_days
      or old.start_time is distinct from new.start_time
      or old.end_time is distinct from new.end_time
      or old.created_at is distinct from new.created_at then
      raise exception 'Providers can only edit: bio, profile_photo_url, years_of_experience, phone_number, email, service_radius_km';
    end if;

    return new;
  end if;

  raise exception 'Not authorized to update provider profile';
end;
$$;

drop trigger if exists trg_providers_enforce_editable_fields on public.providers;
create trigger trg_providers_enforce_editable_fields
before update on public.providers
for each row
execute function public.enforce_provider_editable_fields();

create or replace function public.enforce_provider_document_update_rules()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.role() = 'service_role' or public.is_admin() then
    return new;
  end if;

  if public.is_provider_owner(old.provider_id) then
    if old.verification_status is distinct from new.verification_status
      or old.verified_at is distinct from new.verified_at then
      raise exception 'Providers cannot modify document verification fields';
    end if;
    return new;
  end if;

  raise exception 'Not authorized to update provider document';
end;
$$;

drop trigger if exists trg_provider_documents_update_rules on public.provider_documents;
create trigger trg_provider_documents_update_rules
before update on public.provider_documents
for each row
execute function public.enforce_provider_document_update_rules();

create or replace function public.enforce_provider_review_response_rules()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.role() = 'service_role' or public.is_admin() then
    return new;
  end if;

  if public.is_provider_owner(old.provider_id) then
    if old.provider_id is distinct from new.provider_id
      or old.booking_id is distinct from new.booking_id
      or old.user_id is distinct from new.user_id
      or old.rating is distinct from new.rating
      or old.review_text is distinct from new.review_text
      or old.created_at is distinct from new.created_at then
      raise exception 'Providers can only update provider_response on reviews';
    end if;
    return new;
  end if;

  raise exception 'Not authorized to update provider review';
end;
$$;

drop trigger if exists trg_provider_reviews_response_rules on public.provider_reviews;
create trigger trg_provider_reviews_response_rules
before update on public.provider_reviews
for each row
execute function public.enforce_provider_review_response_rules();

-- Performance metrics recomputation
create or replace function public.recompute_provider_performance_scores(p_provider_id bigint default null)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  updated_rows integer;
begin
  with booking_metrics as (
    select
      b.provider_id,
      count(*)::integer as total_bookings,
      count(*) filter (where b.status = 'cancelled')::integer as cancelled_count,
      count(*) filter (where b.status = 'pending')::integer as pending_count
    from public.bookings b
    where p_provider_id is null or b.provider_id = p_provider_id
    group by b.provider_id
  ),
  review_metrics as (
    select
      r.provider_id,
      coalesce(avg(r.rating)::numeric, 0) as average_rating
    from public.provider_reviews r
    where p_provider_id is null or r.provider_id = p_provider_id
    group by r.provider_id
  )
  update public.providers p
  set
    total_bookings = coalesce(bm.total_bookings, 0),
    average_rating = coalesce(rm.average_rating, 0),
    cancellation_rate = case
      when coalesce(bm.total_bookings, 0) > 0
        then (coalesce(bm.cancelled_count, 0)::numeric / bm.total_bookings::numeric)
      else 0
    end,
    no_show_count = greatest(coalesce(bm.pending_count, 0) - 5, 0),
    performance_score = greatest(
      0,
      (coalesce(rm.average_rating, 0) * 20)
      - (coalesce(bm.cancelled_count, 0) * 2)
    ),
    ranking_score = greatest(
      0,
      (coalesce(rm.average_rating, 0) * 30)
      + (coalesce(bm.total_bookings, 0) * 0.25)
      - (coalesce(bm.cancelled_count, 0) * 3)
    ),
    updated_at = now()
  from booking_metrics bm
  full outer join review_metrics rm
    on bm.provider_id = rm.provider_id
  where p.id = coalesce(bm.provider_id, rm.provider_id)
    and (p_provider_id is null or p.id = p_provider_id);

  get diagnostics updated_rows = row_count;
  return updated_rows;
end;
$$;

grant execute on function public.recompute_provider_performance_scores(bigint)
to service_role;

-- RLS
alter table public.providers enable row level security;
alter table public.provider_professional_details enable row level security;
alter table public.provider_clinic_details enable row level security;
alter table public.provider_services enable row level security;
alter table public.provider_availability enable row level security;
alter table public.provider_documents enable row level security;
alter table public.provider_reviews enable row level security;

-- Providers policies
drop policy if exists providers_read_authenticated on public.providers;
drop policy if exists providers_owner_update on public.providers;
drop policy if exists providers_admin_manage on public.providers;

drop policy if exists providers_select_policy_v2 on public.providers;
create policy providers_select_policy_v2
on public.providers
for select
to authenticated, anon
using (
  public.is_admin()
  or public.is_provider_owner(id)
  or (admin_approval_status = 'approved' and account_status = 'active')
);

drop policy if exists providers_insert_policy_v2 on public.providers;
create policy providers_insert_policy_v2
on public.providers
for insert
to authenticated
with check (
  public.is_admin()
  or (public.is_provider() and user_id = auth.uid())
);

drop policy if exists providers_update_policy_v2 on public.providers;
create policy providers_update_policy_v2
on public.providers
for update
to authenticated
using (
  public.is_admin()
  or public.is_provider_owner(id)
)
with check (
  public.is_admin()
  or public.is_provider_owner(id)
);

drop policy if exists providers_delete_admin_v2 on public.providers;
create policy providers_delete_admin_v2
on public.providers
for delete
to authenticated
using (public.is_admin());

-- Professional details policies
drop policy if exists provider_professional_details_select_v2 on public.provider_professional_details;
create policy provider_professional_details_select_v2
on public.provider_professional_details
for select
to authenticated, anon
using (
  public.is_admin()
  or public.is_provider_owner(provider_id)
  or exists (
    select 1
    from public.providers p
    where p.id = provider_professional_details.provider_id
      and p.admin_approval_status = 'approved'
      and p.account_status = 'active'
  )
);

drop policy if exists provider_professional_details_manage_v2 on public.provider_professional_details;
create policy provider_professional_details_manage_v2
on public.provider_professional_details
for all
to authenticated
using (public.is_admin() or public.is_provider_owner(provider_id))
with check (public.is_admin() or public.is_provider_owner(provider_id));

-- Clinic details policies
drop policy if exists provider_clinic_details_select_v2 on public.provider_clinic_details;
create policy provider_clinic_details_select_v2
on public.provider_clinic_details
for select
to authenticated, anon
using (
  public.is_admin()
  or public.is_provider_owner(provider_id)
  or exists (
    select 1
    from public.providers p
    where p.id = provider_clinic_details.provider_id
      and p.admin_approval_status = 'approved'
      and p.account_status = 'active'
  )
);

drop policy if exists provider_clinic_details_manage_v2 on public.provider_clinic_details;
create policy provider_clinic_details_manage_v2
on public.provider_clinic_details
for all
to authenticated
using (public.is_admin() or public.is_provider_owner(provider_id))
with check (public.is_admin() or public.is_provider_owner(provider_id));

-- Provider services policies (pricing admin-only)
drop policy if exists provider_services_select_v2 on public.provider_services;
create policy provider_services_select_v2
on public.provider_services
for select
to authenticated, anon
using (
  public.is_admin()
  or public.is_provider_owner(provider_id)
  or (
    is_active = true
    and exists (
      select 1
      from public.providers p
      where p.id = provider_services.provider_id
        and p.admin_approval_status = 'approved'
        and p.account_status = 'active'
    )
  )
);

drop policy if exists provider_services_admin_manage_v2 on public.provider_services;
create policy provider_services_admin_manage_v2
on public.provider_services
for all
to authenticated
using (public.is_admin())
with check (public.is_admin());

-- Availability policies
drop policy if exists provider_availability_select_v2 on public.provider_availability;
create policy provider_availability_select_v2
on public.provider_availability
for select
to authenticated, anon
using (
  public.is_admin()
  or public.is_provider_owner(provider_id)
  or exists (
    select 1
    from public.providers p
    where p.id = provider_availability.provider_id
      and p.admin_approval_status = 'approved'
      and p.account_status = 'active'
  )
);

drop policy if exists provider_availability_manage_v2 on public.provider_availability;
create policy provider_availability_manage_v2
on public.provider_availability
for all
to authenticated
using (public.is_admin() or public.is_provider_owner(provider_id))
with check (public.is_admin() or public.is_provider_owner(provider_id));

-- Documents policies
drop policy if exists provider_documents_select_v2 on public.provider_documents;
create policy provider_documents_select_v2
on public.provider_documents
for select
to authenticated
using (public.is_admin() or public.is_provider_owner(provider_id));

drop policy if exists provider_documents_manage_v2 on public.provider_documents;
create policy provider_documents_manage_v2
on public.provider_documents
for all
to authenticated
using (public.is_admin() or public.is_provider_owner(provider_id))
with check (public.is_admin() or public.is_provider_owner(provider_id));

-- Reviews policies
drop policy if exists provider_reviews_select_v2 on public.provider_reviews;
create policy provider_reviews_select_v2
on public.provider_reviews
for select
to authenticated, anon
using (true);

drop policy if exists provider_reviews_insert_v2 on public.provider_reviews;
create policy provider_reviews_insert_v2
on public.provider_reviews
for insert
to authenticated
with check (
  public.is_admin()
  or (
    user_id = auth.uid()
    and exists (
      select 1
      from public.bookings b
      where b.id = provider_reviews.booking_id
        and b.provider_id = provider_reviews.provider_id
        and b.user_id = auth.uid()
    )
  )
);

drop policy if exists provider_reviews_update_v2 on public.provider_reviews;
create policy provider_reviews_update_v2
on public.provider_reviews
for update
to authenticated
using (public.is_admin() or public.is_provider_owner(provider_id))
with check (public.is_admin() or public.is_provider_owner(provider_id));

drop policy if exists provider_reviews_delete_admin_v2 on public.provider_reviews;
create policy provider_reviews_delete_admin_v2
on public.provider_reviews
for delete
to authenticated
using (public.is_admin());

commit;
