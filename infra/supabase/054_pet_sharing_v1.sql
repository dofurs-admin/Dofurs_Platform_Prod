begin;

create table if not exists public.pet_shares (
  id uuid primary key default gen_random_uuid(),
  pet_id bigint not null references public.pets(id) on delete cascade,
  owner_user_id uuid not null references auth.users(id) on delete cascade,
  invited_email text not null,
  shared_with_user_id uuid references auth.users(id) on delete set null,
  role text not null default 'viewer' check (role in ('manager', 'viewer')),
  status text not null default 'pending' check (status in ('pending', 'active', 'revoked')),
  invited_by_user_id uuid not null references auth.users(id) on delete cascade,
  accepted_at timestamptz,
  revoked_at timestamptz,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint pet_shares_active_requires_shared_user check (status <> 'active' or shared_with_user_id is not null)
);

update public.pet_shares
set invited_email = lower(trim(invited_email))
where invited_email <> lower(trim(invited_email));

-- Keep newest row per (pet_id, invited_email) so unique index creation is deterministic.
with ranked_email_duplicates as (
  select
    id,
    row_number() over (
      partition by pet_id, invited_email
      order by created_at desc, id desc
    ) as rn
  from public.pet_shares
)
delete from public.pet_shares ps
using ranked_email_duplicates red
where ps.id = red.id
  and red.rn > 1;

-- Keep only one active row per (pet_id, shared_with_user_id); revoke older duplicates.
with ranked_active_duplicates as (
  select
    id,
    row_number() over (
      partition by pet_id, shared_with_user_id
      order by created_at desc, id desc
    ) as rn
  from public.pet_shares
  where status = 'active'
    and shared_with_user_id is not null
)
update public.pet_shares ps
set
  status = 'revoked',
  revoked_at = coalesce(ps.revoked_at, timezone('utc', now()))
from ranked_active_duplicates rad
where ps.id = rad.id
  and rad.rn > 1;

drop index if exists public.pet_shares_pet_email_unique_idx;
create unique index if not exists pet_shares_pet_email_unique_idx
  on public.pet_shares (pet_id, invited_email);

create unique index if not exists pet_shares_active_user_unique_idx
  on public.pet_shares (pet_id, shared_with_user_id)
  where status = 'active' and shared_with_user_id is not null;

create index if not exists pet_shares_shared_with_user_idx
  on public.pet_shares (shared_with_user_id, status);

create index if not exists pet_shares_owner_status_idx
  on public.pet_shares (owner_user_id, status);

create or replace function public.normalize_and_validate_pet_share()
returns trigger
language plpgsql
as $$
declare
  pet_owner uuid;
begin
  new.invited_email := lower(trim(new.invited_email));

  select p.user_id
  into pet_owner
  from public.pets p
  where p.id = new.pet_id;

  if pet_owner is null then
    raise exception 'Pet not found for share';
  end if;

  if new.owner_user_id <> pet_owner then
    raise exception 'owner_user_id must match pets.user_id';
  end if;

  return new;
end;
$$;

drop trigger if exists trg_pet_shares_normalize_validate on public.pet_shares;
create trigger trg_pet_shares_normalize_validate
before insert or update on public.pet_shares
for each row
execute function public.normalize_and_validate_pet_share();

drop trigger if exists trg_pet_shares_set_updated_at on public.pet_shares;
create trigger trg_pet_shares_set_updated_at
before update on public.pet_shares
for each row
execute function public.set_updated_at();

alter table public.pet_shares enable row level security;

drop policy if exists pet_shares_owner_manage on public.pet_shares;
create policy pet_shares_owner_manage
on public.pet_shares
for all
to authenticated
using (owner_user_id = auth.uid())
with check (owner_user_id = auth.uid());

drop policy if exists pet_shares_shared_user_read on public.pet_shares;
create policy pet_shares_shared_user_read
on public.pet_shares
for select
to authenticated
using (shared_with_user_id = auth.uid() and status = 'active');

commit;
