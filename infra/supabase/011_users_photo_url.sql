begin;

alter table public.users
  add column if not exists photo_url text;

commit;
