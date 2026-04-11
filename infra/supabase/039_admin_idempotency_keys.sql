begin;

create table if not exists public.admin_idempotency_keys (
  id bigserial primary key,
  endpoint text not null,
  idempotency_key text not null,
  actor_user_id uuid references auth.users(id) on delete set null,
  request_payload jsonb,
  status_code integer not null check (status_code between 100 and 599),
  response_body jsonb not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint admin_idempotency_keys_unique_endpoint_key unique (endpoint, idempotency_key)
);

create index if not exists idx_admin_idempotency_keys_actor
on public.admin_idempotency_keys(actor_user_id, created_at desc);

drop trigger if exists trg_admin_idempotency_keys_set_updated_at on public.admin_idempotency_keys;
create trigger trg_admin_idempotency_keys_set_updated_at
before update on public.admin_idempotency_keys
for each row
execute function public.set_updated_at();

alter table public.admin_idempotency_keys enable row level security;

drop policy if exists admin_idempotency_admin_all on public.admin_idempotency_keys;
create policy admin_idempotency_admin_all
on public.admin_idempotency_keys
for all
to authenticated
using (public.is_admin())
with check (public.is_admin());

commit;
