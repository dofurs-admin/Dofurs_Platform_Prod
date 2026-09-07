-- Migration: Provider SOP Checklists
-- Admin-managed SOP catalog + per-booking submissions (snapshot semantics) +
-- photo evidence rows + booking-level SOP waiver + sop-photos storage bucket.

begin;

-- ── 1. SOP catalog (admin managed) ────────────────────────────────────────────

create table if not exists public.provider_sops (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  title text not null check (char_length(title) between 1 and 120),
  instructions text check (instructions is null or char_length(instructions) <= 2000),
  requires_photo boolean not null default false,
  min_photo_count int not null default 1 check (min_photo_count between 0 and 10),
  max_photo_count int not null default 6 check (max_photo_count between 1 and 20),
  mandatory boolean not null default true,
  service_type text,
  sort_order int not null default 0,
  status text not null default 'active' check (status in ('active', 'inactive')),
  version int not null default 1,
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_provider_sops_status_sort
  on public.provider_sops(status, sort_order);

create or replace function public.touch_provider_sops_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists trg_provider_sops_updated_at on public.provider_sops;
create trigger trg_provider_sops_updated_at
  before update on public.provider_sops
  for each row
  execute function public.touch_provider_sops_updated_at();

alter table public.provider_sops enable row level security;

drop policy if exists provider_sops_select on public.provider_sops;
create policy provider_sops_select
  on public.provider_sops
  for select
  to authenticated
  using (true);

drop policy if exists provider_sops_insert on public.provider_sops;
create policy provider_sops_insert
  on public.provider_sops
  for insert
  to authenticated
  with check (public.is_admin());

drop policy if exists provider_sops_update on public.provider_sops;
create policy provider_sops_update
  on public.provider_sops
  for update
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

drop policy if exists provider_sops_delete on public.provider_sops;
create policy provider_sops_delete
  on public.provider_sops
  for delete
  to authenticated
  using (public.is_admin());

grant select, insert, update, delete on public.provider_sops to authenticated;

-- ── 2. Per-booking SOP submissions (snapshots protect in-flight orders) ───────

create table if not exists public.booking_sop_submissions (
  id uuid primary key default gen_random_uuid(),
  booking_id bigint not null references public.bookings(id) on delete cascade,
  provider_id bigint not null references public.providers(id) on delete cascade,
  sop_id uuid not null references public.provider_sops(id),
  title_snapshot text not null,
  instructions_snapshot text,
  requires_photo_snapshot boolean not null default false,
  min_photo_count_snapshot int not null default 1,
  max_photo_count_snapshot int not null default 6,
  mandatory_snapshot boolean not null default true,
  sort_order_snapshot int not null default 0,
  sop_version int not null default 1,
  status text not null default 'pending'
    check (status in ('pending', 'submitted', 'approved', 'rejected', 'waived')),
  submitted_at timestamptz,
  reviewed_by uuid references auth.users(id),
  reviewed_at timestamptz,
  review_note text,
  waived_by uuid references auth.users(id),
  waived_at timestamptz,
  waive_reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (booking_id, sop_id)
);

create index if not exists idx_booking_sop_submissions_provider_status
  on public.booking_sop_submissions(provider_id, status);

create or replace function public.touch_booking_sop_submissions_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists trg_booking_sop_submissions_updated_at on public.booking_sop_submissions;
create trigger trg_booking_sop_submissions_updated_at
  before update on public.booking_sop_submissions
  for each row
  execute function public.touch_booking_sop_submissions_updated_at();

alter table public.booking_sop_submissions enable row level security;

drop policy if exists booking_sop_submissions_select on public.booking_sop_submissions;
create policy booking_sop_submissions_select
  on public.booking_sop_submissions
  for select
  to authenticated
  using (public.is_admin() or public.is_provider_owner(provider_id));

drop policy if exists booking_sop_submissions_insert on public.booking_sop_submissions;
create policy booking_sop_submissions_insert
  on public.booking_sop_submissions
  for insert
  to authenticated
  with check (public.is_admin() or public.is_provider_owner(provider_id));

drop policy if exists booking_sop_submissions_update on public.booking_sop_submissions;
create policy booking_sop_submissions_update
  on public.booking_sop_submissions
  for update
  to authenticated
  using (public.is_admin() or public.is_provider_owner(provider_id))
  with check (public.is_admin() or public.is_provider_owner(provider_id));

grant select, insert, update on public.booking_sop_submissions to authenticated;

-- ── 3. Photo evidence rows (paths inside the sop-photos bucket) ───────────────

create table if not exists public.booking_sop_photos (
  id uuid primary key default gen_random_uuid(),
  submission_id uuid not null references public.booking_sop_submissions(id) on delete cascade,
  storage_path text not null check (char_length(storage_path) between 1 and 512),
  uploaded_by uuid references auth.users(id),
  created_at timestamptz not null default now()
);

create index if not exists idx_booking_sop_photos_submission
  on public.booking_sop_photos(submission_id);

alter table public.booking_sop_photos enable row level security;

drop policy if exists booking_sop_photos_select on public.booking_sop_photos;
create policy booking_sop_photos_select
  on public.booking_sop_photos
  for select
  to authenticated
  using (
    public.is_admin()
    or exists (
      select 1 from public.booking_sop_submissions s
      where s.id = submission_id and public.is_provider_owner(s.provider_id)
    )
  );

drop policy if exists booking_sop_photos_insert on public.booking_sop_photos;
create policy booking_sop_photos_insert
  on public.booking_sop_photos
  for insert
  to authenticated
  with check (
    public.is_admin()
    or exists (
      select 1 from public.booking_sop_submissions s
      where s.id = submission_id and public.is_provider_owner(s.provider_id)
    )
  );

grant select, insert on public.booking_sop_photos to authenticated;

-- ── 4. Booking-level SOP waiver (admin bypass control) ────────────────────────

alter table public.bookings
  add column if not exists sop_completion_waived boolean not null default false;
alter table public.bookings
  add column if not exists sop_waiver_reason text;
alter table public.bookings
  add column if not exists sop_waived_by uuid;
alter table public.bookings
  add column if not exists sop_waived_at timestamptz;

-- ── 5. Private storage bucket for SOP photo evidence ──────────────────────────

insert into storage.buckets (id, name, public)
values ('sop-photos', 'sop-photos', false)
on conflict (id) do nothing;

drop policy if exists "sop photos insert own" on storage.objects;
create policy "sop photos insert own"
  on storage.objects
  for insert
  to authenticated
  with check (
    bucket_id = 'sop-photos'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "sop photos read own" on storage.objects;
create policy "sop photos read own"
  on storage.objects
  for select
  to authenticated
  using (
    bucket_id = 'sop-photos'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

-- ── 6. Seed the three starter SOPs (idempotent on slug) ──────────────────────

insert into public.provider_sops (
  slug, title, instructions, requires_photo, min_photo_count, max_photo_count,
  mandatory, service_type, sort_order, status, version
)
values
  (
    'groomer-in-uniform', 'Groomer in Uniform',
    'Upload a clear photo showing you in your Dofurs uniform before starting the service.',
    true, 1, 2, true, null, 10, 'active', 1
  ),
  (
    'service-before-pictures', 'Service Before Pictures',
    'Upload photos of the pet before the service starts so its condition is documented.',
    true, 1, 6, true, null, 20, 'active', 1
  ),
  (
    'service-after-pictures', 'Service After Pictures',
    'Upload photos of the pet after the service is finished to document the result.',
    true, 1, 6, true, null, 30, 'active', 1
  )
on conflict (slug) do nothing;

commit;
