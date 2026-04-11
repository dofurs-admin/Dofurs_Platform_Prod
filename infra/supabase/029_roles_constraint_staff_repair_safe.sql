begin;

alter table public.roles
  drop constraint if exists roles_name_check;

alter table public.roles
  add constraint roles_name_check
  check (name in ('user', 'provider', 'admin', 'staff'));

insert into public.roles (name)
values ('staff')
on conflict (name) do nothing;

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(public.current_role_name() in ('admin', 'staff'), false);
$$;

grant execute on function public.is_admin() to authenticated, service_role;

commit;
