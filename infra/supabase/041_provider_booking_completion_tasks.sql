begin;

create table if not exists public.provider_booking_completion_tasks (
  id uuid primary key default gen_random_uuid(),
  booking_id bigint not null unique references public.bookings(id) on delete cascade,
  provider_id bigint not null references public.providers(id) on delete cascade,
  due_at timestamptz not null,
  task_status text not null default 'pending' check (task_status in ('pending', 'completed')),
  prompted_at timestamptz,
  completed_at timestamptz,
  feedback_text text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_provider_booking_completion_tasks_provider_status_due
  on public.provider_booking_completion_tasks(provider_id, task_status, due_at desc);

create index if not exists idx_provider_booking_completion_tasks_booking_id
  on public.provider_booking_completion_tasks(booking_id);

create or replace function public.touch_provider_booking_completion_tasks_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists trg_provider_booking_completion_tasks_updated_at on public.provider_booking_completion_tasks;
create trigger trg_provider_booking_completion_tasks_updated_at
before update on public.provider_booking_completion_tasks
for each row
execute function public.touch_provider_booking_completion_tasks_updated_at();

alter table public.provider_booking_completion_tasks enable row level security;

drop policy if exists provider_booking_completion_tasks_select on public.provider_booking_completion_tasks;
create policy provider_booking_completion_tasks_select
on public.provider_booking_completion_tasks
for select
using (public.is_admin() or public.is_provider_owner(provider_id));

drop policy if exists provider_booking_completion_tasks_insert on public.provider_booking_completion_tasks;
create policy provider_booking_completion_tasks_insert
on public.provider_booking_completion_tasks
for insert
with check (public.is_admin() or public.is_provider_owner(provider_id));

drop policy if exists provider_booking_completion_tasks_update on public.provider_booking_completion_tasks;
create policy provider_booking_completion_tasks_update
on public.provider_booking_completion_tasks
for update
using (public.is_admin() or public.is_provider_owner(provider_id))
with check (public.is_admin() or public.is_provider_owner(provider_id));

grant select, insert, update on public.provider_booking_completion_tasks to authenticated;

commit;
