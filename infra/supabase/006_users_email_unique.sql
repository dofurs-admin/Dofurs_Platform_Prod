begin;

create unique index if not exists users_email_unique_ci_idx
  on public.users (lower(email))
  where email is not null;

commit;
