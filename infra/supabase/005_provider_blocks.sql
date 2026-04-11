begin;

create table if not exists public.provider_blocks (
  id bigserial primary key,
  provider_id bigint not null references public.providers(id) on delete cascade on update cascade,
  block_start timestamptz not null,
  block_end timestamptz not null,
  note text,
  created_at timestamptz not null default now(),
  constraint provider_blocks_time_check check (block_end > block_start)
);

create index if not exists idx_provider_blocks_provider_id on public.provider_blocks(provider_id);
create index if not exists idx_provider_blocks_start on public.provider_blocks(block_start);
create index if not exists idx_provider_blocks_end on public.provider_blocks(block_end);

alter table public.provider_blocks enable row level security;

drop policy if exists provider_blocks_provider_manage on public.provider_blocks;
create policy provider_blocks_provider_manage
on public.provider_blocks
for all
to authenticated
using (
  public.is_admin()
  or (public.is_provider() and provider_id = public.current_provider_id())
)
with check (
  public.is_admin()
  or (public.is_provider() and provider_id = public.current_provider_id())
);

commit;
