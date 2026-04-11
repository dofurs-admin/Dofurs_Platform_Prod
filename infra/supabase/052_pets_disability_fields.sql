begin;

alter table public.pets
  add column if not exists has_disability boolean not null default false,
  add column if not exists disability_details text;

create index if not exists idx_pets_has_disability on public.pets(has_disability);

commit;
