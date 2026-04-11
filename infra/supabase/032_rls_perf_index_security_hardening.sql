begin;

-- ============================================================================
-- 032_rls_perf_index_security_hardening.sql
-- Purpose:
-- 1) RLS performance hardening (wrap auth.uid()/current_setting() in subquery)
-- 2) Add missing FK covering indexes
-- 3) Drop known redundant duplicate indexes
-- 4) Consolidate overlapping PERMISSIVE policies for high-priority tables
-- 5) Drop explicitly listed unused indexes (extend list from Supabase advisor)
-- ============================================================================

-- --------------------------------------------------------------------------
-- 1) RLS PERFORMANCE: normalize policy expressions to avoid per-row auth init
-- --------------------------------------------------------------------------
do $$
declare
  rec record;
  new_qual text;
  new_with_check text;
  roles_sql text;
  ddl text;
begin
  for rec in
    select schemaname, tablename, policyname, permissive, cmd, roles, qual, with_check
    from pg_policies
    where schemaname = 'public'
      and tablename = any (
        array[
          'users',
          'service_categories',
          'user_preferences',
          'services',
          'bookings',
          'service_addons',
          'service_packages',
          'booking_adjustment_events',
          'user_roles',
          'providers',
          'provider_clinic_details',
          'pets',
          'pet_vaccinations',
          'platform_discounts',
          'provider_reviews',
          'promotions',
          'faq_categories',
          'faqs'
        ]
      )
  loop
    new_qual := rec.qual;
    new_with_check := rec.with_check;

    if new_qual is not null then
      new_qual := regexp_replace(new_qual, '\mauth\.uid\(\)\M', '(select auth.uid())', 'gi');
      new_qual := regexp_replace(new_qual, '\mcurrent_setting\(([^)]*)\)\M', '(select current_setting(\1))', 'gi');
    end if;

    if new_with_check is not null then
      new_with_check := regexp_replace(new_with_check, '\mauth\.uid\(\)\M', '(select auth.uid())', 'gi');
      new_with_check := regexp_replace(new_with_check, '\mcurrent_setting\(([^)]*)\)\M', '(select current_setting(\1))', 'gi');
    end if;

    if new_qual is distinct from rec.qual
       or new_with_check is distinct from rec.with_check then
      select string_agg(quote_ident(role_name), ', ')
      into roles_sql
      from unnest(rec.roles) as role_name;

      execute format('drop policy if exists %I on %I.%I', rec.policyname, rec.schemaname, rec.tablename);

      ddl := format(
        'create policy %I on %I.%I as %s for %s to %s',
        rec.policyname,
        rec.schemaname,
        rec.tablename,
        rec.permissive,
        rec.cmd,
        roles_sql
      );

      if rec.cmd in ('SELECT', 'DELETE', 'ALL') then
        ddl := ddl || format(' using (%s)', coalesce(new_qual, 'true'));
      elsif rec.cmd = 'UPDATE' then
        ddl := ddl || format(' using (%s)', coalesce(new_qual, 'true'));
      end if;

      if rec.cmd in ('INSERT', 'UPDATE', 'ALL') then
        ddl := ddl || format(' with check (%s)', coalesce(new_with_check, 'true'));
      end if;

      execute ddl;
    end if;
  end loop;
end
$$;

-- --------------------------------------------------------------------------
-- 2) MISSING FK INDEXES (covering indexes for common joins/deletes)
-- --------------------------------------------------------------------------
do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'bookings' and column_name = 'pet_id'
  ) then
    execute 'create index if not exists idx_bookings_pet_id on public.bookings(pet_id)';
  end if;

  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'bookings' and column_name = 'service_id'
  ) then
    execute 'create index if not exists idx_bookings_service_id on public.bookings(service_id)';
  end if;

  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'platform_discounts' and column_name = 'created_by'
  ) then
    execute 'create index if not exists idx_platform_discounts_created_by on public.platform_discounts(created_by)';
  end if;

  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'provider_reviews' and column_name = 'user_id'
  ) then
    execute 'create index if not exists idx_provider_reviews_user_id on public.provider_reviews(user_id)';
  end if;

  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'users' and column_name = 'role_id'
  ) then
    execute 'create index if not exists idx_users_role_id on public.users(role_id)';
  end if;
end
$$;

-- --------------------------------------------------------------------------
-- 3) REDUNDANT/DUPLICATE INDEXES
-- Keep adjustment-event indexes, drop refund-event duplicates.
-- --------------------------------------------------------------------------
drop index if exists public.idx_booking_refund_events_actor_created;
drop index if exists public.idx_booking_refund_events_booking_created;

-- --------------------------------------------------------------------------
-- 4) SECURITY ARCHITECTURE: consolidate overlapping permissive policies
-- For each (table, command, role-set), merge multiple PERMISSIVE policies into one.
-- --------------------------------------------------------------------------
do $$
declare
  grp record;
  old_policy text;
  roles_sql text;
  merged_policy_name text;
  create_sql text;
begin
  for grp in
    with p as (
      select
        schemaname,
        tablename,
        cmd,
        roles,
        policyname,
        nullif(trim(qual), '') as qual,
        nullif(trim(with_check), '') as with_check
      from pg_policies
      where schemaname = 'public'
        and permissive = 'PERMISSIVE'
        and tablename = any (
          array[
            'booking_adjustment_events',
            'bookings',
            'services',
            'service_addons',
            'service_packages',
            'user_roles',
            'providers'
          ]
        )
        and cmd in ('SELECT', 'INSERT', 'UPDATE', 'DELETE')
    ),
    grouped as (
      select
        schemaname,
        tablename,
        cmd,
        roles,
        (select string_agg(r, ',' order by r) from unnest(roles) as r) as roles_key,
        array_agg(policyname order by policyname) as policy_names,
        string_agg(format('(%s)', coalesce(qual, 'true')), ' OR ') as merged_qual,
        nullif(
          string_agg(
            case when with_check is not null then format('(%s)', with_check) end,
            ' OR '
          ),
          ''
        ) as merged_with_check,
        count(*) as policy_count
      from p
      group by schemaname, tablename, cmd, roles
      having count(*) > 1
    )
    select * from grouped
  loop
    select string_agg(quote_ident(role_name), ', ')
    into roles_sql
    from unnest(grp.roles) as role_name;

    merged_policy_name := substr(
      format(
        'merged_%s_%s_%s',
        grp.tablename,
        lower(grp.cmd),
        substr(md5(grp.roles_key || coalesce(grp.merged_qual, '') || coalesce(grp.merged_with_check, '')), 1, 8)
      ),
      1,
      63
    );

    foreach old_policy in array grp.policy_names
    loop
      execute format('drop policy if exists %I on %I.%I', old_policy, grp.schemaname, grp.tablename);
    end loop;

    create_sql := format(
      'create policy %I on %I.%I as permissive for %s to %s',
      merged_policy_name,
      grp.schemaname,
      grp.tablename,
      grp.cmd,
      roles_sql
    );

    if grp.cmd in ('SELECT', 'DELETE') then
      create_sql := create_sql || format(' using (%s)', coalesce(grp.merged_qual, 'true'));
    elsif grp.cmd = 'INSERT' then
      create_sql := create_sql || format(' with check (%s)', coalesce(grp.merged_with_check, 'true'));
    elsif grp.cmd = 'UPDATE' then
      create_sql := create_sql || format(' using (%s)', coalesce(grp.merged_qual, 'true'));
      create_sql := create_sql || format(' with check (%s)', coalesce(grp.merged_with_check, 'true'));
    end if;

    execute create_sql;
  end loop;
end
$$;

-- --------------------------------------------------------------------------
-- 5) DATABASE BLOAT: drop advisor-flagged unused indexes
-- Extend this array with additional index names from Supabase advisor output.
-- --------------------------------------------------------------------------
do $$
declare
  idx_name text;
  idx_names text[] := array[
    'idx_users_updated_at',
    'idx_bookings_discount_code',
    'idx_bookings_provider_id',
    'idx_services_provider_id',
    'idx_pets_updated_at',
    'idx_service_addons_provider_service_id'
  ];
begin
  foreach idx_name in array idx_names
  loop
    execute format('drop index if exists public.%I', idx_name);
  end loop;
end
$$;

commit;
