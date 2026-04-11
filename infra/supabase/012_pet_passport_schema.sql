begin;

create extension if not exists pgcrypto;

do $$
begin
  if not exists (
    select 1
    from pg_type t
    join pg_namespace n on n.oid = t.typnamespace
    where t.typname = 'aggression_enum'
      and n.nspname = 'public'
  ) then
    create type public.aggression_enum as enum (
      'friendly',
      'docile',
      'mild_aggression',
      'aggressive',
      'sometimes_nervous',
      'nervous_but_manageable',
      'not_sure',
      'other'
    );
  end if;
end
$$;

alter type public.aggression_enum add value if not exists 'friendly';
alter type public.aggression_enum add value if not exists 'docile';
alter type public.aggression_enum add value if not exists 'mild_aggression';
alter type public.aggression_enum add value if not exists 'aggressive';
alter type public.aggression_enum add value if not exists 'sometimes_nervous';
alter type public.aggression_enum add value if not exists 'nervous_but_manageable';
alter type public.aggression_enum add value if not exists 'not_sure';
alter type public.aggression_enum add value if not exists 'other';

alter table public.pets
  drop column if exists vaccination_status,
  drop column if exists behavior_notes,
  add column if not exists date_of_birth date,
  add column if not exists microchip_number text,
  add column if not exists neutered_spayed boolean not null default false,
  add column if not exists color text,
  add column if not exists size_category text,
  add column if not exists energy_level text,
  add column if not exists aggression_level public.aggression_enum,
  add column if not exists is_bite_history boolean not null default false,
  add column if not exists bite_incidents_count integer not null default 0,
  add column if not exists house_trained boolean not null default false,
  add column if not exists leash_trained boolean not null default false,
  add column if not exists crate_trained boolean not null default false,
  add column if not exists social_with_dogs text,
  add column if not exists social_with_cats text,
  add column if not exists social_with_children text,
  add column if not exists separation_anxiety boolean not null default false,
  add column if not exists updated_at timestamptz not null default now();

alter table public.pets
  drop constraint if exists pets_bite_incidents_count_check;

alter table public.pets
  add constraint pets_bite_incidents_count_check
  check (bite_incidents_count >= 0);

create index if not exists idx_pets_updated_at on public.pets(updated_at desc);
create index if not exists idx_pets_aggression_level on public.pets(aggression_level);

create table if not exists public.pet_vaccinations (
  id uuid primary key default gen_random_uuid(),
  pet_id bigint not null references public.pets(id) on delete cascade,
  vaccine_name text not null,
  brand_name text,
  batch_number text,
  dose_number integer,
  administered_date date not null,
  next_due_date date,
  veterinarian_name text,
  clinic_name text,
  certificate_url text,
  reminder_enabled boolean not null default true,
  created_at timestamptz not null default now(),
  constraint pet_vaccinations_dose_number_check check (dose_number is null or dose_number > 0)
);

create index if not exists idx_pet_vaccinations_pet_id on public.pet_vaccinations(pet_id);
create index if not exists idx_pet_vaccinations_next_due_date on public.pet_vaccinations(next_due_date);
create index if not exists idx_pet_vaccinations_due_reminders on public.pet_vaccinations(next_due_date)
where reminder_enabled = true and next_due_date is not null;

create table if not exists public.pet_medical_records (
  id uuid primary key default gen_random_uuid(),
  pet_id bigint not null references public.pets(id) on delete cascade,
  condition_name text not null,
  diagnosis_date date,
  ongoing boolean not null default false,
  medications text,
  special_care_instructions text,
  vet_name text,
  document_url text,
  created_at timestamptz not null default now()
);

create index if not exists idx_pet_medical_records_pet_id on public.pet_medical_records(pet_id);

create table if not exists public.pet_feeding_info (
  id uuid primary key default gen_random_uuid(),
  pet_id bigint not null unique references public.pets(id) on delete cascade,
  food_type text,
  brand_name text,
  feeding_schedule text,
  food_allergies text,
  special_diet_notes text,
  treats_allowed boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.pet_grooming_info (
  id uuid primary key default gen_random_uuid(),
  pet_id bigint not null unique references public.pets(id) on delete cascade,
  coat_type text,
  matting_prone boolean not null default false,
  grooming_frequency text,
  last_grooming_date date,
  nail_trim_frequency text,
  created_at timestamptz not null default now()
);

create table if not exists public.pet_emergency_info (
  id uuid primary key default gen_random_uuid(),
  pet_id bigint not null unique references public.pets(id) on delete cascade,
  emergency_contact_name text,
  emergency_contact_phone text,
  preferred_vet_clinic text,
  preferred_vet_phone text,
  created_at timestamptz not null default now()
);

create index if not exists idx_pet_feeding_info_pet_id on public.pet_feeding_info(pet_id);
create index if not exists idx_pet_grooming_info_pet_id on public.pet_grooming_info(pet_id);
create index if not exists idx_pet_emergency_info_pet_id on public.pet_emergency_info(pet_id);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_pets_set_updated_at on public.pets;
create trigger trg_pets_set_updated_at
before update on public.pets
for each row
execute function public.set_updated_at();

alter table public.pet_vaccinations enable row level security;
alter table public.pet_medical_records enable row level security;
alter table public.pet_feeding_info enable row level security;
alter table public.pet_grooming_info enable row level security;
alter table public.pet_emergency_info enable row level security;

drop policy if exists pets_owner_manage on public.pets;
create policy pets_owner_manage
on public.pets
for all
to authenticated
using (user_id = auth.uid())
with check (user_id = auth.uid());

drop policy if exists pet_vaccinations_owner_manage on public.pet_vaccinations;
create policy pet_vaccinations_owner_manage
on public.pet_vaccinations
for all
to authenticated
using (
  exists (
    select 1
    from public.pets p
    where p.id = pet_vaccinations.pet_id
      and p.user_id = auth.uid()
  )
)
with check (
  exists (
    select 1
    from public.pets p
    where p.id = pet_vaccinations.pet_id
      and p.user_id = auth.uid()
  )
);

drop policy if exists pet_medical_records_owner_manage on public.pet_medical_records;
create policy pet_medical_records_owner_manage
on public.pet_medical_records
for all
to authenticated
using (
  exists (
    select 1
    from public.pets p
    where p.id = pet_medical_records.pet_id
      and p.user_id = auth.uid()
  )
)
with check (
  exists (
    select 1
    from public.pets p
    where p.id = pet_medical_records.pet_id
      and p.user_id = auth.uid()
  )
);

drop policy if exists pet_feeding_info_owner_manage on public.pet_feeding_info;
create policy pet_feeding_info_owner_manage
on public.pet_feeding_info
for all
to authenticated
using (
  exists (
    select 1
    from public.pets p
    where p.id = pet_feeding_info.pet_id
      and p.user_id = auth.uid()
  )
)
with check (
  exists (
    select 1
    from public.pets p
    where p.id = pet_feeding_info.pet_id
      and p.user_id = auth.uid()
  )
);

drop policy if exists pet_grooming_info_owner_manage on public.pet_grooming_info;
create policy pet_grooming_info_owner_manage
on public.pet_grooming_info
for all
to authenticated
using (
  exists (
    select 1
    from public.pets p
    where p.id = pet_grooming_info.pet_id
      and p.user_id = auth.uid()
  )
)
with check (
  exists (
    select 1
    from public.pets p
    where p.id = pet_grooming_info.pet_id
      and p.user_id = auth.uid()
  )
);

drop policy if exists pet_emergency_info_owner_manage on public.pet_emergency_info;
create policy pet_emergency_info_owner_manage
on public.pet_emergency_info
for all
to authenticated
using (
  exists (
    select 1
    from public.pets p
    where p.id = pet_emergency_info.pet_id
      and p.user_id = auth.uid()
  )
)
with check (
  exists (
    select 1
    from public.pets p
    where p.id = pet_emergency_info.pet_id
      and p.user_id = auth.uid()
  )
);

commit;
