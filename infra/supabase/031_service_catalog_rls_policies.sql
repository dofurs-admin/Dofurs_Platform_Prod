/**
 * Service Catalog System - RLS Policies
 * This migration adds Row-Level Security policies for service catalog tables.
 *
 * Access Rules:
 * - ADMIN: Full CRUD on all catalog tables
 * - PROVIDER: Can read own services and all packages/categories; cannot modify packages
 * - USER: Read-only on categories, services, packages, and add-ons
 * - PUBLIC: No direct access
 */

begin;

-- ============================================================================
-- SERVICE CATEGORIES RLS
-- ============================================================================

alter table public.service_categories enable row level security;

drop policy if exists "service_categories_admin_all" on public.service_categories;
create policy "service_categories_admin_all"
  on public.service_categories
  as permissive
  for all
  to authenticated
  using (auth.jwt() ->> 'role' = 'admin')
  with check (auth.jwt() ->> 'role' = 'admin');

drop policy if exists "service_categories_users_read" on public.service_categories;
create policy "service_categories_users_read"
  on public.service_categories
  as permissive
  for select
  to authenticated
  using (true);

-- ============================================================================
-- PROVIDER_SERVICES (EXTENDED) RLS
-- ============================================================================

alter table public.provider_services enable row level security;

drop policy if exists "provider_services_admin_all" on public.provider_services;
create policy "provider_services_admin_all"
  on public.provider_services
  as permissive
  for all
  to authenticated
  using (auth.jwt() ->> 'role' = 'admin')
  with check (auth.jwt() ->> 'role' = 'admin');

drop policy if exists "provider_services_provider_own" on public.provider_services;
create policy "provider_services_provider_own"
  on public.provider_services
  as permissive
  for all
  to authenticated
  using (
    auth.jwt() ->> 'role' = 'provider'
    and provider_id = (
      select id from public.providers
      where user_id = auth.uid()
    )
  )
  with check (
    auth.jwt() ->> 'role' = 'provider'
    and provider_id = (
      select id from public.providers
      where user_id = auth.uid()
    )
  );

drop policy if exists "provider_services_users_read" on public.provider_services;
create policy "provider_services_users_read"
  on public.provider_services
  as permissive
  for select
  to authenticated
  using (is_active = true);

-- ============================================================================
-- SERVICE_PACKAGES RLS
-- ============================================================================

alter table public.service_packages enable row level security;

drop policy if exists "service_packages_admin_all" on public.service_packages;
create policy "service_packages_admin_all"
  on public.service_packages
  as permissive
  for all
  to authenticated
  using (auth.jwt() ->> 'role' = 'admin')
  with check (auth.jwt() ->> 'role' = 'admin');

drop policy if exists "service_packages_users_read" on public.service_packages;
create policy "service_packages_users_read"
  on public.service_packages
  as permissive
  for select
  to authenticated
  using (is_active = true);

-- ============================================================================
-- PACKAGE_SERVICES RLS
-- ============================================================================

alter table public.package_services enable row level security;

drop policy if exists "package_services_admin_all" on public.package_services;
create policy "package_services_admin_all"
  on public.package_services
  as permissive
  for all
  to authenticated
  using (auth.jwt() ->> 'role' = 'admin')
  with check (auth.jwt() ->> 'role' = 'admin');

drop policy if exists "package_services_users_read" on public.package_services;
create policy "package_services_users_read"
  on public.package_services
  as permissive
  for select
  to authenticated
  using (
    exists (
      select 1 from public.service_packages
      where service_packages.id = package_services.package_id
      and service_packages.is_active = true
    )
  );

-- ============================================================================
-- SERVICE_ADDONS RLS
-- ============================================================================

alter table public.service_addons enable row level security;

drop policy if exists "service_addons_admin_all" on public.service_addons;
create policy "service_addons_admin_all"
  on public.service_addons
  as permissive
  for all
  to authenticated
  using (auth.jwt() ->> 'role' = 'admin')
  with check (auth.jwt() ->> 'role' = 'admin');

drop policy if exists "service_addons_provider_own" on public.service_addons;
create policy "service_addons_provider_own"
  on public.service_addons
  as permissive
  for all
  to authenticated
  using (
    auth.jwt() ->> 'role' = 'provider'
    and exists (
      select 1 from public.provider_services ps
      join public.providers p on ps.provider_id = p.id
      where ps.id = provider_service_id
      and p.user_id = auth.uid()
    )
  )
  with check (
    auth.jwt() ->> 'role' = 'provider'
    and exists (
      select 1 from public.provider_services ps
      join public.providers p on ps.provider_id = p.id
      where ps.id = provider_service_id
      and p.user_id = auth.uid()
    )
  );

drop policy if exists "service_addons_users_read" on public.service_addons;
create policy "service_addons_users_read"
  on public.service_addons
  as permissive
  for select
  to authenticated
  using (is_active = true);

-- ============================================================================
-- BOOKINGS TABLE EXTENSION RLS
-- ============================================================================

-- Update existing bookings RLS to include package fields
-- (Policies should already exist; this ensures they cover new columns)

-- Admin can manage all bookings
drop policy if exists "bookings_admin_all" on public.bookings;
create policy "bookings_admin_all"
  on public.bookings
  as permissive
  for all
  to authenticated
  using (auth.jwt() ->> 'role' = 'admin')
  with check (auth.jwt() ->> 'role' = 'admin');

-- Providers can read their own bookings
drop policy if exists "bookings_provider_own" on public.bookings;
create policy "bookings_provider_own"
  on public.bookings
  as permissive
  for select
  to authenticated
  using (
    auth.jwt() ->> 'role' = 'provider'
    and provider_id = (
      select id from public.providers
      where user_id = auth.uid()
    )
  );

-- Providers can update their own booking status/notes only (not pricing)
drop policy if exists "bookings_provider_update_status" on public.bookings;
create policy "bookings_provider_update_status"
  on public.bookings
  as permissive
  for update
  to authenticated
  using (
    auth.jwt() ->> 'role' = 'provider'
    and provider_id = (
      select id from public.providers
      where user_id = auth.uid()
    )
  )
  with check (
    -- Providers cannot change pricing or package assignment
    package_id = (select package_id from public.bookings where id = bookings.id)
    and discount_amount = (select discount_amount from public.bookings where id = bookings.id)
    and final_price = (select final_price from public.bookings where id = bookings.id)
  );

-- Users can read their own bookings
drop policy if exists "bookings_user_own" on public.bookings;
create policy "bookings_user_own"
  on public.bookings
  as permissive
  for select
  to authenticated
  using (user_id = auth.uid());

-- Users can create bookings
drop policy if exists "bookings_user_create" on public.bookings;
create policy "bookings_user_create"
  on public.bookings
  as permissive
  for insert
  to authenticated
  with check (
    user_id = auth.uid()
    and (auth.jwt() ->> 'role' = 'user' or auth.jwt() ->> 'role' = 'provider')
  );

-- Users can update their own bookings (status only)
drop policy if exists "bookings_user_update" on public.bookings;
create policy "bookings_user_update"
  on public.bookings
  as permissive
  for update
  to authenticated
  using (user_id = auth.uid())
  with check (
    user_id = auth.uid()
    -- Prevent users from modifying pricing after creation
    and package_id is not distinct from (select package_id from public.bookings where id = bookings.id)
    and discount_amount is not distinct from (select discount_amount from public.bookings where id = bookings.id)
    and final_price is not distinct from (select final_price from public.bookings where id = bookings.id)
  );

commit;
