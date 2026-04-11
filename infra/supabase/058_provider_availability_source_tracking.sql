begin;

-- Track who set each availability slot and whether an admin has locked it
-- against provider overrides.
alter table public.provider_availability
  add column if not exists set_by text not null default 'provider'
    constraint provider_availability_set_by_check check (set_by in ('provider', 'admin')),
  add column if not exists admin_locked boolean not null default false;

comment on column public.provider_availability.set_by is
  'Indicates who last set this slot: ''provider'' (self-managed) or ''admin'' (platform-managed).';

comment on column public.provider_availability.admin_locked is
  'When true, provider PUT calls will not overwrite or delete this slot.';

commit;
