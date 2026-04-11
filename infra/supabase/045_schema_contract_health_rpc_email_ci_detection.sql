begin;

create or replace function public.get_platform_schema_health()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  has_role_user boolean;
  has_role_provider boolean;
  has_role_admin boolean;
  has_role_staff boolean;
  users_address_nullable boolean;
  users_age_nullable boolean;
  users_gender_nullable boolean;
  users_profile_trigger_exists boolean;
  users_profile_trigger_enabled boolean;
  users_profile_function_exists boolean;
  users_phone_unique_constraint_exists boolean;
  users_email_ci_unique_index_exists boolean;
  providers_user_id_column_exists boolean;
  providers_provider_type_is_text boolean;
  providers_user_id_unique_idx_exists boolean;
  admin_idempotency_table_exists boolean;
  checks jsonb;
  all_ok boolean;
begin
  select exists(select 1 from public.roles where name = 'user') into has_role_user;
  select exists(select 1 from public.roles where name = 'provider') into has_role_provider;
  select exists(select 1 from public.roles where name = 'admin') into has_role_admin;
  select exists(select 1 from public.roles where name = 'staff') into has_role_staff;

  select c.is_nullable = 'YES'
  into users_address_nullable
  from information_schema.columns c
  where c.table_schema = 'public'
    and c.table_name = 'users'
    and c.column_name = 'address';

  select c.is_nullable = 'YES'
  into users_age_nullable
  from information_schema.columns c
  where c.table_schema = 'public'
    and c.table_name = 'users'
    and c.column_name = 'age';

  select c.is_nullable = 'YES'
  into users_gender_nullable
  from information_schema.columns c
  where c.table_schema = 'public'
    and c.table_name = 'users'
    and c.column_name = 'gender';

  select exists(
    select 1
    from pg_trigger t
    join pg_class tbl on tbl.oid = t.tgrelid
    join pg_namespace n on n.oid = tbl.relnamespace
    where n.nspname = 'public'
      and tbl.relname = 'users'
      and t.tgname = 'trg_users_enforce_profile_requirements_by_role'
      and not t.tgisinternal
  ) into users_profile_trigger_exists;

  select exists(
    select 1
    from pg_trigger t
    join pg_class tbl on tbl.oid = t.tgrelid
    join pg_namespace n on n.oid = tbl.relnamespace
    where n.nspname = 'public'
      and tbl.relname = 'users'
      and t.tgname = 'trg_users_enforce_profile_requirements_by_role'
      and t.tgenabled in ('O', 'A', 'R')
      and not t.tgisinternal
  ) into users_profile_trigger_enabled;

  select exists(
    select 1
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname = 'enforce_user_profile_requirements_by_role'
  ) into users_profile_function_exists;

  select exists(
    select 1
    from pg_constraint c
    join pg_class tbl on tbl.oid = c.conrelid
    join pg_namespace n on n.oid = tbl.relnamespace
    where n.nspname = 'public'
      and tbl.relname = 'users'
      and c.conname = 'users_phone_key'
      and c.contype = 'u'
  ) into users_phone_unique_constraint_exists;

  select exists(
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
  ) into users_email_ci_unique_index_exists;

  select exists(
    select 1
    from information_schema.columns c
    where c.table_schema = 'public'
      and c.table_name = 'providers'
      and c.column_name = 'user_id'
  ) into providers_user_id_column_exists;

  select exists(
    select 1
    from information_schema.columns c
    where c.table_schema = 'public'
      and c.table_name = 'providers'
      and c.column_name = 'provider_type'
      and c.data_type = 'text'
  ) into providers_provider_type_is_text;

  select exists(
    select 1
    from pg_indexes i
    where i.schemaname = 'public'
      and i.tablename = 'providers'
      and i.indexname = 'uq_providers_user_id_not_null'
  ) into providers_user_id_unique_idx_exists;

  select exists(
    select 1
    from information_schema.tables t
    where t.table_schema = 'public'
      and t.table_name = 'admin_idempotency_keys'
  ) into admin_idempotency_table_exists;

  checks := jsonb_build_array(
    jsonb_build_object('key', 'roles.user.exists', 'ok', coalesce(has_role_user, false), 'expected', true, 'actual', coalesce(has_role_user, false)),
    jsonb_build_object('key', 'roles.provider.exists', 'ok', coalesce(has_role_provider, false), 'expected', true, 'actual', coalesce(has_role_provider, false)),
    jsonb_build_object('key', 'roles.admin.exists', 'ok', coalesce(has_role_admin, false), 'expected', true, 'actual', coalesce(has_role_admin, false)),
    jsonb_build_object('key', 'roles.staff.exists', 'ok', coalesce(has_role_staff, false), 'expected', true, 'actual', coalesce(has_role_staff, false)),
    jsonb_build_object('key', 'users.address.nullable', 'ok', coalesce(users_address_nullable, false), 'expected', true, 'actual', coalesce(users_address_nullable, false)),
    jsonb_build_object('key', 'users.age.nullable', 'ok', coalesce(users_age_nullable, false), 'expected', true, 'actual', coalesce(users_age_nullable, false)),
    jsonb_build_object('key', 'users.gender.nullable', 'ok', coalesce(users_gender_nullable, false), 'expected', true, 'actual', coalesce(users_gender_nullable, false)),
    jsonb_build_object('key', 'users.role_profile.trigger.exists', 'ok', coalesce(users_profile_trigger_exists, false), 'expected', true, 'actual', coalesce(users_profile_trigger_exists, false)),
    jsonb_build_object('key', 'users.role_profile.trigger.enabled', 'ok', coalesce(users_profile_trigger_enabled, false), 'expected', true, 'actual', coalesce(users_profile_trigger_enabled, false)),
    jsonb_build_object('key', 'users.role_profile.function.exists', 'ok', coalesce(users_profile_function_exists, false), 'expected', true, 'actual', coalesce(users_profile_function_exists, false)),
    jsonb_build_object('key', 'users.phone.unique_constraint.exists', 'ok', coalesce(users_phone_unique_constraint_exists, false), 'expected', true, 'actual', coalesce(users_phone_unique_constraint_exists, false)),
    jsonb_build_object('key', 'users.email_ci.unique_index.exists', 'ok', coalesce(users_email_ci_unique_index_exists, false), 'expected', true, 'actual', coalesce(users_email_ci_unique_index_exists, false)),
    jsonb_build_object('key', 'providers.user_id.column.exists', 'ok', coalesce(providers_user_id_column_exists, false), 'expected', true, 'actual', coalesce(providers_user_id_column_exists, false)),
    jsonb_build_object('key', 'providers.provider_type.is_text', 'ok', coalesce(providers_provider_type_is_text, false), 'expected', true, 'actual', coalesce(providers_provider_type_is_text, false)),
    jsonb_build_object('key', 'providers.user_id.unique_index.exists', 'ok', coalesce(providers_user_id_unique_idx_exists, false), 'expected', true, 'actual', coalesce(providers_user_id_unique_idx_exists, false)),
    jsonb_build_object('key', 'admin.idempotency.table.exists', 'ok', coalesce(admin_idempotency_table_exists, false), 'expected', true, 'actual', coalesce(admin_idempotency_table_exists, false))
  );

  select coalesce(bool_and((item->>'ok')::boolean), false)
  into all_ok
  from jsonb_array_elements(checks) as item;

  return jsonb_build_object(
    'healthy', all_ok,
    'domain', 'schema-contract',
    'checks', checks,
    'generated_at', now()
  );
end;
$$;

grant execute on function public.get_platform_schema_health() to authenticated, service_role;

commit;
