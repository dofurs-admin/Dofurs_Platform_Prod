-- Migration: Customer service feedback by provider/admin
-- Purpose: Allow providers and admins to rate a customer and add service notes after booking completion.

begin;

create table if not exists public.customer_service_feedback (
  id uuid primary key default gen_random_uuid(),
  booking_id bigint not null references public.bookings(id) on delete cascade,
  user_id uuid not null references public.users(id) on delete cascade,
  provider_id bigint not null references public.providers(id) on delete cascade,
  rating integer not null check (rating between 1 and 5),
  notes text,
  created_by_user_id uuid not null references public.users(id) on delete cascade,
  created_by_role text not null check (created_by_role in ('provider', 'admin', 'staff')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint customer_service_feedback_notes_len_check check (notes is null or char_length(notes) <= 4000),
  constraint customer_service_feedback_actor_per_booking_unique unique (booking_id, created_by_user_id, created_by_role)
);

create index if not exists idx_customer_service_feedback_booking
  on public.customer_service_feedback(booking_id, created_at desc);

create index if not exists idx_customer_service_feedback_provider
  on public.customer_service_feedback(provider_id, created_at desc);

create index if not exists idx_customer_service_feedback_user
  on public.customer_service_feedback(user_id, created_at desc);

create or replace function public.touch_customer_service_feedback_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists trg_customer_service_feedback_updated_at on public.customer_service_feedback;
create trigger trg_customer_service_feedback_updated_at
before update on public.customer_service_feedback
for each row
execute function public.touch_customer_service_feedback_updated_at();

alter table public.customer_service_feedback enable row level security;

drop policy if exists customer_service_feedback_select_v1 on public.customer_service_feedback;
create policy customer_service_feedback_select_v1
on public.customer_service_feedback
for select
to authenticated
using (public.is_admin() or public.is_provider_owner(provider_id));

drop policy if exists customer_service_feedback_insert_v1 on public.customer_service_feedback;
create policy customer_service_feedback_insert_v1
on public.customer_service_feedback
for insert
to authenticated
with check (
  (
    public.is_admin()
    and created_by_role in ('admin', 'staff')
  )
  or (
    public.is_provider_owner(provider_id)
    and created_by_role = 'provider'
    and created_by_user_id = auth.uid()
  )
);

drop policy if exists customer_service_feedback_update_v1 on public.customer_service_feedback;
create policy customer_service_feedback_update_v1
on public.customer_service_feedback
for update
to authenticated
using (
  public.is_admin()
  or (
    public.is_provider_owner(provider_id)
    and created_by_role = 'provider'
    and created_by_user_id = auth.uid()
  )
)
with check (
  (
    public.is_admin()
    and created_by_role in ('admin', 'staff')
  )
  or (
    public.is_provider_owner(provider_id)
    and created_by_role = 'provider'
    and created_by_user_id = auth.uid()
  )
);

commit;
