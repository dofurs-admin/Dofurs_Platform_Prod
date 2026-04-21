begin;

-- ============================================================================
-- 080_normalize_addon_catalog_and_booking_events.sql
-- Purpose: Normalize add-on management for reusable templates, service mappings,
-- and booking-time snapshots/events that support admin/provider/user actions.
-- ============================================================================

create table if not exists public.addon_templates (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  description text,
  icon_url text,
  default_duration_minutes integer,
  default_price numeric not null default 0,
  is_active boolean not null default true,
  moderation_status text not null default 'approved',
  created_by uuid references auth.users(id),
  approved_by uuid references auth.users(id),
  approved_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint addon_templates_name_not_empty check (length(trim(name)) > 0),
  constraint addon_templates_slug_not_empty check (length(trim(slug)) > 0),
  constraint addon_templates_default_duration_check check (
    default_duration_minutes is null or default_duration_minutes > 0
  ),
  constraint addon_templates_default_price_check check (default_price >= 0),
  constraint addon_templates_moderation_status_check check (
    moderation_status in ('draft', 'pending_review', 'approved', 'paused', 'retired')
  )
);

create index if not exists idx_addon_templates_is_active
on public.addon_templates(is_active);

create index if not exists idx_addon_templates_moderation_status
on public.addon_templates(moderation_status);

create index if not exists idx_addon_templates_created_by
on public.addon_templates(created_by);

create table if not exists public.provider_service_addon_mappings (
  id uuid primary key default gen_random_uuid(),
  provider_service_id uuid not null references public.provider_services(id) on delete cascade,
  addon_template_id uuid not null references public.addon_templates(id) on delete restrict,
  price_override numeric,
  min_quantity integer not null default 0,
  max_quantity integer not null default 10,
  default_quantity integer not null default 0,
  is_required boolean not null default false,
  is_active boolean not null default true,
  display_order integer not null default 0,
  moderation_status text not null default 'approved',
  source_role text not null default 'admin',
  created_by uuid references auth.users(id),
  approved_by uuid references auth.users(id),
  approved_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint provider_service_addon_mappings_price_override_check check (
    price_override is null or price_override >= 0
  ),
  constraint provider_service_addon_mappings_min_quantity_check check (min_quantity >= 0),
  constraint provider_service_addon_mappings_max_quantity_check check (max_quantity >= 1),
  constraint provider_service_addon_mappings_default_quantity_check check (default_quantity >= 0),
  constraint provider_service_addon_mappings_quantity_order_check check (
    max_quantity >= min_quantity and default_quantity between min_quantity and max_quantity
  ),
  constraint provider_service_addon_mappings_moderation_status_check check (
    moderation_status in ('draft', 'pending_review', 'approved', 'paused', 'retired')
  ),
  constraint provider_service_addon_mappings_source_role_check check (
    source_role in ('admin', 'staff', 'provider', 'system')
  ),
  constraint provider_service_addon_mappings_unique unique (provider_service_id, addon_template_id)
);

create index if not exists idx_provider_service_addon_mappings_provider_service
on public.provider_service_addon_mappings(provider_service_id);

create index if not exists idx_provider_service_addon_mappings_addon_template
on public.provider_service_addon_mappings(addon_template_id);

create index if not exists idx_provider_service_addon_mappings_is_active
on public.provider_service_addon_mappings(is_active);
 
create table if not exists public.booking_addon_items (
  id uuid primary key default gen_random_uuid(),
  booking_id bigint not null references public.bookings(id) on delete cascade,
  addon_template_id uuid references public.addon_templates(id) on delete restrict,
  provider_service_addon_mapping_id uuid references public.provider_service_addon_mappings(id) on delete set null,
  name_snapshot text not null,
  unit_price_snapshot numeric not null,
  quantity integer not null,
  total_price_snapshot numeric not null,
  status text not null default 'selected',
  added_by_user_id uuid references auth.users(id),
  added_by_role text not null,
  source text not null default 'booking_flow',
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint booking_addon_items_name_snapshot_not_empty check (length(trim(name_snapshot)) > 0),
  constraint booking_addon_items_unit_price_snapshot_check check (unit_price_snapshot >= 0),
  constraint booking_addon_items_quantity_check check (quantity > 0),
  constraint booking_addon_items_total_price_snapshot_check check (total_price_snapshot >= 0),
  constraint booking_addon_items_status_check check (
    status in ('selected', 'confirmed', 'fulfilled', 'cancelled', 'refunded')
  ),
  constraint booking_addon_items_added_by_role_check check (
    added_by_role in ('admin', 'staff', 'provider', 'user', 'system')
  ),
  constraint booking_addon_items_source_check check (
    source in ('booking_flow', 'pre_service', 'in_service', 'admin_adjustment')
  )
);

create index if not exists idx_booking_addon_items_booking_id
on public.booking_addon_items(booking_id);

create index if not exists idx_booking_addon_items_status
on public.booking_addon_items(status);

create index if not exists idx_booking_addon_items_addon_template_id
on public.booking_addon_items(addon_template_id);

create table if not exists public.booking_addon_events (
  id uuid primary key default gen_random_uuid(),
  booking_addon_item_id uuid not null references public.booking_addon_items(id) on delete cascade,
  booking_id bigint not null references public.bookings(id) on delete cascade,
  event_type text not null,
  actor_user_id uuid references auth.users(id),
  actor_role text not null,
  previous_payload jsonb,
  next_payload jsonb,
  created_at timestamptz not null default now(),
  constraint booking_addon_events_event_type_check check (
    event_type in ('added', 'quantity_updated', 'status_updated', 'removed', 'refunded', 'approved', 'rejected')
  ),
  constraint booking_addon_events_actor_role_check check (
    actor_role in ('admin', 'staff', 'provider', 'user', 'system')
  )
);

create index if not exists idx_booking_addon_events_booking_id
on public.booking_addon_events(booking_id);

create index if not exists idx_booking_addon_events_item_id
on public.booking_addon_events(booking_addon_item_id);

create or replace function public.touch_updated_at_generic()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists trg_addon_templates_updated_at on public.addon_templates;
create trigger trg_addon_templates_updated_at
before update on public.addon_templates
for each row
execute function public.touch_updated_at_generic();

drop trigger if exists trg_provider_service_addon_mappings_updated_at on public.provider_service_addon_mappings;
create trigger trg_provider_service_addon_mappings_updated_at
before update on public.provider_service_addon_mappings
for each row
execute function public.touch_updated_at_generic();

drop trigger if exists trg_booking_addon_items_updated_at on public.booking_addon_items;
create trigger trg_booking_addon_items_updated_at
before update on public.booking_addon_items
for each row
execute function public.touch_updated_at_generic();

-- --------------------------------------------------------------------------
-- Backfill from legacy service_addons so rollout starts with existing data.
-- --------------------------------------------------------------------------
with normalized as (
  select
    sa.id,
    sa.provider_service_id,
    trim(sa.name) as name,
    nullif(trim(sa.description), '') as description,
    sa.icon_url,
    sa.duration_minutes,
    coalesce(sa.price, 0) as price,
    coalesce(sa.display_order, 0) as display_order,
    coalesce(sa.is_active, true) as is_active,
    lower(trim(sa.name)) as normalized_name,
    regexp_replace(lower(trim(sa.name)), '[^a-z0-9]+', '-', 'g') as base_slug
  from public.service_addons sa
),
slugs as (
  select
    g.*, 
    row_number() over (partition by g.clean_slug order by g.normalized_name) as slug_rank
  from (
    select
      normalized_name,
      min(name) as canonical_name,
      min(description) as description,
      min(icon_url) as icon_url,
      min(duration_minutes) as duration_minutes,
      min(price) as default_price,
      case
        when coalesce(min(base_slug), '') = '' then 'addon'
        else trim(both '-' from min(base_slug))
      end as clean_slug
    from normalized
    group by normalized_name
  ) g
),
inserted_templates as (
  insert into public.addon_templates (
    name,
    slug,
    description,
    icon_url,
    default_duration_minutes,
    default_price,
    is_active,
    moderation_status,
    created_by,
    approved_by,
    approved_at
  )
  select
    s.canonical_name,
    case when s.slug_rank = 1 then s.clean_slug else s.clean_slug || '-' || s.slug_rank::text end,
    s.description,
    s.icon_url,
    s.duration_minutes,
    s.default_price,
    true,
    'approved',
    null,
    null,
    now()
  from slugs s
  where not exists (
    select 1
    from public.addon_templates t
    where lower(trim(t.name)) = s.normalized_name
  )
  returning id, lower(trim(name)) as normalized_name
)
insert into public.provider_service_addon_mappings (
  provider_service_id,
  addon_template_id,
  price_override,
  min_quantity,
  max_quantity,
  default_quantity,
  is_required,
  is_active,
  display_order,
  moderation_status,
  source_role,
  created_by,
  approved_by,
  approved_at
)
select
  n.provider_service_id,
  coalesce(it.id, at.id) as addon_template_id,
  n.price,
  0,
  10,
  0,
  false,
  n.is_active,
  n.display_order,
  'approved',
  'system',
  null,
  null,
  now()
from normalized n
left join inserted_templates it
  on it.normalized_name = n.normalized_name
left join public.addon_templates at
  on lower(trim(at.name)) = n.normalized_name
on conflict (provider_service_id, addon_template_id)
do nothing;

alter table public.addon_templates enable row level security;
alter table public.provider_service_addon_mappings enable row level security;
alter table public.booking_addon_items enable row level security;
alter table public.booking_addon_events enable row level security;

-- service-role access for backend automation and admin APIs.
drop policy if exists addon_templates_service_role_all on public.addon_templates;
create policy addon_templates_service_role_all
on public.addon_templates
for all
to service_role
using (true)
with check (true);

drop policy if exists provider_service_addon_mappings_service_role_all on public.provider_service_addon_mappings;
create policy provider_service_addon_mappings_service_role_all
on public.provider_service_addon_mappings
for all
to service_role
using (true)
with check (true);

drop policy if exists booking_addon_items_service_role_all on public.booking_addon_items;
create policy booking_addon_items_service_role_all
on public.booking_addon_items
for all
to service_role
using (true)
with check (true);

drop policy if exists booking_addon_events_service_role_all on public.booking_addon_events;
create policy booking_addon_events_service_role_all
on public.booking_addon_events
for all
to service_role
using (true)
with check (true);

-- authenticated read access for active templates and active mappings.
drop policy if exists addon_templates_authenticated_read_active on public.addon_templates;
create policy addon_templates_authenticated_read_active
on public.addon_templates
for select
to authenticated
using (
  is_active = true
  and moderation_status = 'approved'
);

drop policy if exists provider_service_addon_mappings_authenticated_read_active on public.provider_service_addon_mappings;
create policy provider_service_addon_mappings_authenticated_read_active
on public.provider_service_addon_mappings
for select
to authenticated
using (
  is_active = true
  and moderation_status = 'approved'
);

-- booking addon item visibility by booking ownership or provider ownership.
drop policy if exists booking_addon_items_user_view_own on public.booking_addon_items;
create policy booking_addon_items_user_view_own
on public.booking_addon_items
for select
to authenticated
using (
  exists (
    select 1
    from public.bookings b
    where b.id = booking_id
      and b.user_id = auth.uid()
  )
);

drop policy if exists booking_addon_items_provider_view_own on public.booking_addon_items;
create policy booking_addon_items_provider_view_own
on public.booking_addon_items
for select
to authenticated
using (
  auth.jwt() ->> 'role' = 'provider'
  and exists (
    select 1
    from public.bookings b
    join public.providers p on p.id = b.provider_id
    where b.id = booking_id
      and p.user_id = auth.uid()
  )
);

drop policy if exists booking_addon_events_user_view_own on public.booking_addon_events;
create policy booking_addon_events_user_view_own
on public.booking_addon_events
for select
to authenticated
using (
  exists (
    select 1
    from public.bookings b
    where b.id = booking_id
      and b.user_id = auth.uid()
  )
);

drop policy if exists booking_addon_events_provider_view_own on public.booking_addon_events;
create policy booking_addon_events_provider_view_own
on public.booking_addon_events
for select
to authenticated
using (
  auth.jwt() ->> 'role' = 'provider'
  and exists (
    select 1
    from public.bookings b
    join public.providers p on p.id = b.provider_id
    where b.id = booking_id
      and p.user_id = auth.uid()
  )
);

commit;
