begin;

do $$
declare
  missing_address_count integer;
  missing_age_count integer;
  missing_gender_count integer;
begin
  select count(*) into missing_address_count
  from public.users
  where address is null or length(trim(address)) < 5;

  select count(*) into missing_age_count
  from public.users
  where age is null or age < 13 or age > 120;

  select count(*) into missing_gender_count
  from public.users
  where gender is null or gender not in ('male', 'female', 'other');

  if missing_address_count > 0 or missing_age_count > 0 or missing_gender_count > 0 then
    raise exception using
      message = format(
        'Cannot enforce required profile fields. Missing/invalid rows => address: %s, age: %s, gender: %s. Backfill these values first in public.users.',
        missing_address_count,
        missing_age_count,
        missing_gender_count
      );
  end if;
end $$;

alter table public.users
  alter column address set not null,
  alter column age set not null,
  alter column gender set not null;

commit;
