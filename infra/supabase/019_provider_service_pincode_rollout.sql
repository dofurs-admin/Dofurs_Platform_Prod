begin;

create table if not exists public.provider_service_pincodes (
  id uuid primary key default gen_random_uuid(),
  provider_service_id uuid not null references public.provider_services(id) on delete cascade,
  pincode text not null,
  is_enabled boolean not null default true,
  created_at timestamptz not null default now(),
  constraint provider_service_pincodes_pincode_format_check
    check (pincode ~ '^[1-9][0-9]{5}$'),
  constraint provider_service_pincodes_unique
    unique (provider_service_id, pincode)
);

create index if not exists idx_provider_service_pincodes_service
  on public.provider_service_pincodes(provider_service_id);
create index if not exists idx_provider_service_pincodes_pincode
  on public.provider_service_pincodes(pincode, is_enabled);

alter table public.provider_service_pincodes enable row level security;

drop policy if exists provider_service_pincodes_select_v1 on public.provider_service_pincodes;
create policy provider_service_pincodes_select_v1
on public.provider_service_pincodes
for select
to authenticated, anon
using (
  public.is_admin()
  or exists (
    select 1
    from public.provider_services ps
    where ps.id = provider_service_pincodes.provider_service_id
      and public.is_provider_owner(ps.provider_id)
  )
  or exists (
    select 1
    from public.provider_services ps
    join public.providers p on p.id = ps.provider_id
    where ps.id = provider_service_pincodes.provider_service_id
      and ps.is_active = true
      and p.admin_approval_status = 'approved'
      and p.account_status = 'active'
      and provider_service_pincodes.is_enabled = true
  )
);

drop policy if exists provider_service_pincodes_manage_v1 on public.provider_service_pincodes;
create policy provider_service_pincodes_manage_v1
on public.provider_service_pincodes
for all
to authenticated
using (
  public.is_admin()
  or exists (
    select 1
    from public.provider_services ps
    where ps.id = provider_service_pincodes.provider_service_id
      and public.is_provider_owner(ps.provider_id)
  )
)
with check (
  public.is_admin()
  or exists (
    select 1
    from public.provider_services ps
    where ps.id = provider_service_pincodes.provider_service_id
      and public.is_provider_owner(ps.provider_id)
  )
);

commit;
