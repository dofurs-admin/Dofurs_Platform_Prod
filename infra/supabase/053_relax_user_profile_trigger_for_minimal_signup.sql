begin;

create or replace function public.enforce_user_profile_requirements_by_role()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  resolved_role_name text;
begin
  select r.name into resolved_role_name
  from public.roles r
  where r.id = new.role_id;

  if resolved_role_name is null then
    raise exception 'Invalid role_id on users row: %', new.role_id;
  end if;

  if resolved_role_name = 'user' then
    if new.name is null or length(trim(new.name)) < 2 then
      raise exception 'name is required for user role and must be at least 2 characters';
    end if;

    if new.phone is null or not (trim(new.phone) ~ '^\\+[1-9][0-9]{6,14}$') then
      raise exception 'phone is required for user role and must be in E.164 format';
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists trg_users_enforce_profile_requirements_by_role on public.users;

create trigger trg_users_enforce_profile_requirements_by_role
before insert or update of role_id, name, phone
on public.users
for each row
execute function public.enforce_user_profile_requirements_by_role();

commit;
