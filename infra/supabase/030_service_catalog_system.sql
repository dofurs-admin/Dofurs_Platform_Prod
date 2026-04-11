begin;

-- ============================================================================
-- SERVICE CATALOG SYSTEM UPGRADE
-- ============================================================================
-- This migration extends the existing service management to support:
-- - Service categories
-- - Service metadata (icons, descriptions, modes)
-- - Service packages (bundled services)
-- - Service add-ons
-- - Package-based booking with dynamic pricing
--
-- IMPORTANT: This is an extension. Existing provider_services pricing remains
-- unchanged. Packages calculate prices dynamically from provider_services.
-- ============================================================================

-- 1) SERVICE CATEGORIES
create table if not exists public.service_categories (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null,
  description text,
  icon_url text,
  banner_image_url text,
  display_order integer not null default 0,
  is_featured boolean not null default false,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint service_categories_name_not_empty check (length(trim(name)) > 0),
  constraint service_categories_slug_not_empty check (length(trim(slug)) > 0),
  unique(slug)
);

create index if not exists idx_service_categories_is_active
on public.service_categories(is_active);
create index if not exists idx_service_categories_slug
on public.service_categories(slug);
create index if not exists idx_service_categories_display_order
on public.service_categories(display_order);

-- 2) EXTEND SERVICES TABLE (global catalog)
-- Add missing columns for the new service system
alter table if exists public.provider_services
  add column if not exists category_id uuid references public.service_categories(id) on delete set null;
alter table if exists public.provider_services
  add column if not exists slug text;
alter table if exists public.provider_services
  add column if not exists short_description text;
alter table if exists public.provider_services
  add column if not exists full_description text;
alter table if exists public.provider_services
  add column if not exists service_mode text default 'home_visit';
alter table if exists public.provider_services
  add column if not exists icon_url text;
alter table if exists public.provider_services
  add column if not exists banner_image_url text;
alter table if exists public.provider_services
  add column if not exists display_order integer not null default 0;
alter table if exists public.provider_services
  add column if not exists is_featured boolean not null default false;
alter table if exists public.provider_services
  add column if not exists requires_pet_details boolean not null default true;
alter table if exists public.provider_services
  add column if not exists requires_location boolean not null default true;
alter table if exists public.provider_services
  add column if not exists updated_at timestamptz not null default now();

-- Add constraints
alter table if exists public.provider_services
  drop constraint if exists provider_services_service_mode_check;
alter table if exists public.provider_services
  add constraint provider_services_service_mode_check check (
    service_mode in ('home_visit', 'clinic_visit', 'teleconsult')
  );

-- Add indexes for new fields
create index if not exists idx_provider_services_category_id
on public.provider_services(category_id);
create index if not exists idx_provider_services_is_active
on public.provider_services(is_active);
create index if not exists idx_provider_services_slug
on public.provider_services(slug);

-- 3) SERVICE PACKAGES (bundled services with optional discount)
create table if not exists public.service_packages (
  id uuid primary key default gen_random_uuid(),
  category_id uuid references public.service_categories(id) on delete set null,
  name text not null,
  slug text not null,
  short_description text,
  full_description text,
  banner_image_url text,
  icon_url text,
  discount_type text,
  discount_value numeric,
  display_order integer not null default 0,
  is_featured boolean not null default false,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint service_packages_name_not_empty check (length(trim(name)) > 0),
  constraint service_packages_slug_not_empty check (length(trim(slug)) > 0),
  constraint service_packages_discount_type_check check (
    discount_type is null or discount_type in ('percentage', 'fixed')
  ),
  constraint service_packages_discount_value_check check (
    discount_value is null or discount_value > 0
  ),
  unique(slug)
);

create index if not exists idx_service_packages_category_id
on public.service_packages(category_id);
create index if not exists idx_service_packages_is_active
on public.service_packages(is_active);
create index if not exists idx_service_packages_slug
on public.service_packages(slug);
create index if not exists idx_service_packages_display_order
on public.service_packages(display_order);

-- 4) PACKAGE-SERVICE JUNCTION (composition mapping)
create table if not exists public.package_services (
  id uuid primary key default gen_random_uuid(),
  package_id uuid not null references public.service_packages(id) on delete cascade,
  provider_service_id uuid not null references public.provider_services(id) on delete cascade,
  sequence_order integer not null default 0,
  is_optional boolean not null default false,
  created_at timestamptz not null default now(),
  constraint package_services_sequence_order_check check (sequence_order >= 0)
);

create index if not exists idx_package_services_package_id
on public.package_services(package_id);
create index if not exists idx_package_services_provider_service_id
on public.package_services(provider_service_id);
create index if not exists idx_package_services_package_provider_service
on public.package_services(package_id, provider_service_id);

-- 5) SERVICE ADD-ONS
create table if not exists public.service_addons (
  id uuid primary key default gen_random_uuid(),
  provider_service_id uuid not null references public.provider_services(id) on delete cascade,
  name text not null,
  description text,
  price numeric not null,
  duration_minutes integer,
  icon_url text,
  display_order integer not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint service_addons_name_not_empty check (length(trim(name)) > 0),
  constraint service_addons_price_check check (price >= 0),
  constraint service_addons_duration_check check (
    duration_minutes is null or duration_minutes > 0
  )
);

create index if not exists idx_service_addons_provider_service_id
on public.service_addons(provider_service_id);
create index if not exists idx_service_addons_is_active
on public.service_addons(is_active);
create index if not exists idx_service_addons_display_order
on public.service_addons(display_order);

-- 6) EXTEND BOOKINGS TABLE FOR PACKAGE SUPPORT
alter table if exists public.bookings
  add column if not exists package_id uuid references public.service_packages(id) on delete set null;
alter table if exists public.bookings
  add column if not exists discount_amount numeric;
alter table if exists public.bookings
  add column if not exists final_price numeric;

-- Validate discount_amount and final_price if they exist
alter table if exists public.bookings
  drop constraint if exists bookings_discount_amount_check;
alter table if exists public.bookings
  add constraint bookings_discount_amount_check check (
    discount_amount is null or discount_amount >= 0
  );

alter table if exists public.bookings
  drop constraint if exists bookings_final_price_check;
alter table if exists public.bookings
  add constraint bookings_final_price_check check (
    final_price is null or final_price >= 0
  );

create index if not exists idx_bookings_package_id
on public.bookings(package_id);

-- 7) AUTO-UPDATE TRIGGERS
-- Update service_categories.updated_at
create or replace function update_service_categories_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists trigger_service_categories_updated_at on public.service_categories;
create trigger trigger_service_categories_updated_at
  before update on public.service_categories
  for each row
  execute function update_service_categories_updated_at();

-- Update provider_services.updated_at
create or replace function update_provider_services_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists trigger_provider_services_updated_at on public.provider_services;
create trigger trigger_provider_services_updated_at
  before update on public.provider_services
  for each row
  execute function update_provider_services_updated_at();

-- Update service_packages.updated_at
create or replace function update_service_packages_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists trigger_service_packages_updated_at on public.service_packages;
create trigger trigger_service_packages_updated_at
  before update on public.service_packages
  for each row
  execute function update_service_packages_updated_at();

-- Update service_addons.updated_at
create or replace function update_service_addons_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists trigger_service_addons_updated_at on public.service_addons;
create trigger trigger_service_addons_updated_at
  before update on public.service_addons
  for each row
  execute function update_service_addons_updated_at();

commit;
