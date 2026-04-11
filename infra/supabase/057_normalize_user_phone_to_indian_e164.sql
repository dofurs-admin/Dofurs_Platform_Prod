begin;

-- Normalize user phone values at DB boundary so backend writes are always stored as +91XXXXXXXXXX.
create or replace function public.enforce_user_profile_requirements_by_role()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  resolved_role_name text;
  trimmed_name text;
  trimmed_phone text;
  compact_phone text;
  digits_only text;
  normalized_phone text;
begin
  select r.name into resolved_role_name
  from public.roles r
  where r.id = new.role_id;

  if resolved_role_name is null then
    raise exception 'Invalid role_id on users row: %', new.role_id;
  end if;

  if resolved_role_name = 'user' then
    trimmed_name := nullif(trim(coalesce(new.name, '')), '');
    trimmed_phone := nullif(trim(coalesce(new.phone, '')), '');

    if trimmed_name is not null and length(trimmed_name) < 2 then
      raise exception 'name is required for user role and must be at least 2 characters';
    end if;

    if trimmed_phone is not null then
      compact_phone := regexp_replace(trimmed_phone, '[\s()-]+', '', 'g');
      digits_only := regexp_replace(compact_phone, '\\D+', '', 'g');

      normalized_phone := null;

      if compact_phone ~ '^\+[1-9][0-9]{6,14}$' then
        normalized_phone := compact_phone;
      elsif digits_only ~ '^[0-9]{10}$' then
        normalized_phone := '+91' || digits_only;
      elsif digits_only ~ '^91[0-9]{10}$' then
        normalized_phone := '+' || digits_only;
      end if;

      if normalized_phone is null then
        raise exception 'phone is required for user role and must be in E.164 format';
      end if;

      -- Product currently operates in India; enforce canonical +91 storage.
      if normalized_phone !~ '^\+91[0-9]{10}$' then
        raise exception 'phone is required for user role and must be in E.164 format';
      end if;

      new.phone := normalized_phone;
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
