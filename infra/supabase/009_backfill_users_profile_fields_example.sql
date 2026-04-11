-- Optional helper script: backfill missing profile fields before enforcing NOT NULL.
-- Review/edit values before running in production.

begin;

update public.users
set address = 'Address pending update'
where address is null or length(trim(address)) < 5;

update public.users
set age = 18
where age is null or age < 13 or age > 120;

update public.users
set gender = 'other'
where gender is null or gender not in ('male', 'female', 'other');

commit;
