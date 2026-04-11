begin;

-- Ensure case-insensitive unique email enforcement exists for users.email.
do $$
begin
  if not exists (
    select 1
    from pg_index idx
    join pg_class tbl on tbl.oid = idx.indrelid
    join pg_namespace n on n.oid = tbl.relnamespace
    where n.nspname = 'public'
      and tbl.relname = 'users'
      and idx.indisunique
      and (
        coalesce(pg_get_expr(idx.indexprs, idx.indrelid), '') ilike '%lower((email)%'
        or coalesce(pg_get_indexdef(idx.indexrelid), '') ilike '%lower((email)%'
        or coalesce(pg_get_indexdef(idx.indexrelid), '') ilike '%lower(email)%'
      )
  ) then
    create unique index users_email_unique_ci_idx
      on public.users (lower(email))
      where email is not null;
  end if;
end
$$;

commit;
