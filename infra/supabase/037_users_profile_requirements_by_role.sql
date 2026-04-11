begin;

alter table public.users
  alter column address drop not null,
  alter column age drop not null,
  alter column gender drop not null;

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
    if new.address is null or length(trim(new.address)) < 5 then
      raise exception 'address is required for user role and must be at least 5 characters';
    end if;

    if new.age is null or new.age < 13 or new.age > 120 then
      raise exception 'age is required for user role and must be between 13 and 120';
    end if;

    if new.gender is null or new.gender not in ('male', 'female', 'other') then
      raise exception 'gender is required for user role and must be one of: male, female, other';
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists trg_users_enforce_profile_requirements_by_role on public.users;

create trigger trg_users_enforce_profile_requirements_by_role
before insert or update of role_id, address, age, gender
on public.users
for each row
execute function public.enforce_user_profile_requirements_by_role();

commit;
