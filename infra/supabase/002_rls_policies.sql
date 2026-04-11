begin;

create or replace function public.current_role_name()
returns text
language sql
stable
security definer
set search_path = public
as $$
  select r.name
  from public.users u
  join public.roles r on r.id = u.role_id
  where u.id = auth.uid()
  limit 1;
$$;

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(public.current_role_name() = 'admin', false);
$$;

create or replace function public.is_provider()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(public.current_role_name() = 'provider', false);
$$;

create or replace function public.current_provider_id()
returns bigint
language sql
stable
as $$
  select nullif(auth.jwt() ->> 'provider_id', '')::bigint;
$$;

grant execute on function public.current_role_name() to authenticated, service_role;
grant execute on function public.is_admin() to authenticated, service_role;
grant execute on function public.is_provider() to authenticated, service_role;
grant execute on function public.current_provider_id() to authenticated, service_role;

alter table public.roles enable row level security;
alter table public.users enable row level security;
alter table public.pets enable row level security;
alter table public.providers enable row level security;
alter table public.services enable row level security;
alter table public.bookings enable row level security;

drop policy if exists roles_select_authenticated on public.roles;
create policy roles_select_authenticated
on public.roles
for select
to authenticated
using (true);

drop policy if exists roles_admin_all on public.roles;
create policy roles_admin_all
on public.roles
for all
to authenticated
using (public.is_admin())
with check (public.is_admin());

drop policy if exists users_select_own_or_admin on public.users;
create policy users_select_own_or_admin
on public.users
for select
to authenticated
using (id = auth.uid() or public.is_admin());

drop policy if exists users_insert_own_or_admin on public.users;
create policy users_insert_own_or_admin
on public.users
for insert
to authenticated
with check (id = auth.uid() or public.is_admin());

drop policy if exists users_update_own_or_admin on public.users;
create policy users_update_own_or_admin
on public.users
for update
to authenticated
using (id = auth.uid() or public.is_admin())
with check (id = auth.uid() or public.is_admin());

drop policy if exists users_admin_delete on public.users;
create policy users_admin_delete
on public.users
for delete
to authenticated
using (public.is_admin());

drop policy if exists pets_owner_manage on public.pets;
create policy pets_owner_manage
on public.pets
for all
to authenticated
using (user_id = auth.uid() or public.is_admin())
with check (user_id = auth.uid() or public.is_admin());

drop policy if exists providers_read_authenticated on public.providers;
create policy providers_read_authenticated
on public.providers
for select
to authenticated
using (true);

drop policy if exists providers_owner_update on public.providers;
create policy providers_owner_update
on public.providers
for update
to authenticated
using (
  public.is_admin()
  or (public.is_provider() and id = public.current_provider_id())
)
with check (
  public.is_admin()
  or (public.is_provider() and id = public.current_provider_id())
);

drop policy if exists providers_admin_manage on public.providers;
create policy providers_admin_manage
on public.providers
for all
to authenticated
using (public.is_admin())
with check (public.is_admin());

drop policy if exists services_provider_manage on public.services;
create policy services_provider_manage
on public.services
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

drop policy if exists bookings_user_view on public.bookings;
create policy bookings_user_view
on public.bookings
for select
to authenticated
using (
  public.is_admin()
  or user_id = auth.uid()
  or (public.is_provider() and provider_id = public.current_provider_id())
);

drop policy if exists bookings_user_insert on public.bookings;
create policy bookings_user_insert
on public.bookings
for insert
to authenticated
with check (
  public.is_admin()
  or (
    user_id = auth.uid()
    and exists (
      select 1
      from public.pets p
      where p.id = pet_id
        and p.user_id = auth.uid()
    )
  )
);

drop policy if exists bookings_user_cancel_or_admin on public.bookings;
create policy bookings_user_cancel_or_admin
on public.bookings
for update
to authenticated
using (
  public.is_admin()
  or user_id = auth.uid()
  or (public.is_provider() and provider_id = public.current_provider_id())
)
with check (
  public.is_admin()
  or user_id = auth.uid()
  or (public.is_provider() and provider_id = public.current_provider_id())
);

drop policy if exists bookings_admin_delete on public.bookings;
create policy bookings_admin_delete
on public.bookings
for delete
to authenticated
using (public.is_admin());

create or replace function public.enforce_provider_booking_status_update()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if public.is_provider() and not public.is_admin() then
    if old.user_id is distinct from new.user_id
      or old.pet_id is distinct from new.pet_id
      or old.provider_id is distinct from new.provider_id
      or old.service_id is distinct from new.service_id
      or old.booking_start is distinct from new.booking_start
      or old.booking_end is distinct from new.booking_end
      or old.payment_mode is distinct from new.payment_mode
      or old.amount is distinct from new.amount
      or old.created_at is distinct from new.created_at then
      raise exception 'Providers can only update booking status';
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists trg_enforce_provider_booking_status_update on public.bookings;
create trigger trg_enforce_provider_booking_status_update
before update on public.bookings
for each row
execute function public.enforce_provider_booking_status_update();

commit;
