begin;

create extension if not exists pgcrypto;

create table if not exists public.roles (
  id smallint generated always as identity primary key,
  name text not null unique,
  constraint roles_name_check check (name in ('user', 'provider', 'admin'))
);

create table if not exists public.users (
  id uuid primary key references auth.users(id) on delete cascade on update cascade,
  phone text not null unique,
  name text,
  email text,
  role_id smallint not null references public.roles(id) on delete restrict on update cascade,
  created_at timestamptz not null default now()
);

create table if not exists public.pets (
  id bigserial primary key,
  user_id uuid not null references public.users(id) on delete cascade on update cascade,
  name text not null,
  breed text,
  age integer,
  weight numeric(6,2),
  gender text,
  vaccination_status text,
  allergies text,
  behavior_notes text,
  photo_url text,
  created_at timestamptz not null default now(),
  constraint pets_age_check check (age is null or age >= 0),
  constraint pets_weight_check check (weight is null or weight >= 0)
);

create table if not exists public.providers (
  id bigserial primary key,
  name text not null,
  type text not null,
  address text not null,
  lat numeric(10,7),
  lng numeric(10,7),
  service_radius_km numeric(6,2),
  working_days text[] not null default '{}',
  start_time time not null,
  end_time time not null,
  created_at timestamptz not null default now(),
  constraint providers_type_check check (type in ('clinic', 'grooming', 'home')),
  constraint providers_radius_check check (service_radius_km is null or service_radius_km >= 0),
  constraint providers_working_hours_check check (start_time < end_time)
);

create table if not exists public.services (
  id bigserial primary key,
  provider_id bigint not null references public.providers(id) on delete cascade on update cascade,
  name text not null,
  duration_minutes integer not null,
  buffer_minutes integer not null default 0,
  price numeric(10,2) not null,
  constraint services_duration_check check (duration_minutes > 0),
  constraint services_buffer_check check (buffer_minutes >= 0),
  constraint services_price_check check (price >= 0)
);

do $$
begin
  if not exists (
    select 1
    from pg_type t
    join pg_namespace n on n.oid = t.typnamespace
    where t.typname = 'booking_status'
      and n.nspname = 'public'
  ) then
    create type public.booking_status as enum ('pending', 'confirmed', 'completed', 'cancelled');
  end if;
end
$$;

create table if not exists public.bookings (
  id bigserial primary key,
  user_id uuid not null references public.users(id) on delete cascade on update cascade,
  pet_id bigint not null references public.pets(id) on delete cascade on update cascade,
  provider_id bigint not null references public.providers(id) on delete restrict on update cascade,
  service_id bigint not null references public.services(id) on delete restrict on update cascade,
  booking_start timestamptz not null,
  booking_end timestamptz not null,
  status public.booking_status not null default 'pending',
  payment_mode text,
  amount numeric(10,2) not null,
  created_at timestamptz not null default now(),
  constraint bookings_time_range_check check (booking_end > booking_start),
  constraint bookings_amount_check check (amount >= 0)
);

create index if not exists idx_bookings_provider_id on public.bookings(provider_id);
create index if not exists idx_bookings_booking_start on public.bookings(booking_start);
create index if not exists idx_bookings_booking_end on public.bookings(booking_end);
create index if not exists idx_services_provider_id on public.services(provider_id);
create index if not exists idx_pets_user_id on public.pets(user_id);

insert into public.roles (name)
values ('user'), ('provider'), ('admin')
on conflict (name) do nothing;

commit;
