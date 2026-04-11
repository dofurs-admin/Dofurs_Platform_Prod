begin;

alter table public.users
  add column if not exists address text,
  add column if not exists age integer,
  add column if not exists gender text;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'users_age_check'
      and conrelid = 'public.users'::regclass
  ) then
    alter table public.users
      add constraint users_age_check check (age is null or (age >= 13 and age <= 120));
  end if;
end $$;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'users_gender_check'
      and conrelid = 'public.users'::regclass
  ) then
    alter table public.users
      add constraint users_gender_check check (gender is null or gender in ('male', 'female', 'other'));
  end if;
end $$;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'users_address_check'
      and conrelid = 'public.users'::regclass
  ) then
    alter table public.users
      add constraint users_address_check check (address is null or length(trim(address)) >= 5);
  end if;
end $$;

commit;
