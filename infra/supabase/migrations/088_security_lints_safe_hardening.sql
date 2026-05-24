begin;

-- Supabase Advisor: pin search_path for functions reported as role-mutable.
do $$
declare
  target_function_names text[] := array[
    'touch_booking_conversion_events_updated_at',
    'expire_overdue_subscriptions',
    'touch_service_provider_applications_updated_at',
    'touch_updated_at_generic',
    'trg_fn_create_referral_code',
    'validate_booking_status_transition',
    'generate_referral_code',
    'enforce_single_primary_emergency_contact',
    'cleanup_stale_notifications',
    'expire_stale_pending_bookings',
    'update_service_categories_updated_at',
    'prevent_sensitive_profile_self_updates',
    'enforce_single_default_user_address',
    'touch_customer_service_feedback_updated_at',
    'cap_user_notifications',
    'booking_can_transition',
    'update_provider_services_updated_at',
    'update_service_packages_updated_at',
    'cleanup_stale_messages',
    'update_service_addons_updated_at',
    'set_updated_at',
    'touch_updated_at',
    'normalize_and_validate_pet_share',
    'touch_business_referral_campaigns_updated_at',
    'check_and_increment_discount_usage',
    'current_provider_id',
    'touch_provider_booking_completion_tasks_updated_at'
  ];
  function_record record;
begin
  for function_record in
    select
      n.nspname,
      p.proname,
      pg_get_function_identity_arguments(p.oid) as identity_arguments
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname = any(target_function_names)
  loop
    execute format(
      'alter function %I.%I(%s) set search_path = public, pg_temp',
      function_record.nspname,
      function_record.proname,
      function_record.identity_arguments
    );
  end loop;
end
$$;

-- Supabase Advisor: service insert policies should not apply to every role.
do $$
begin
  if to_regclass('public.notifications') is not null then
    execute 'drop policy if exists notifications_insert_service on public.notifications';
    execute $policy$
      create policy notifications_insert_service
      on public.notifications
      for insert
      to service_role
      with check (true)
    $policy$;
  end if;

  if to_regclass('public.messages') is not null then
    execute 'drop policy if exists messages_insert_service on public.messages';
    execute $policy$
      create policy messages_insert_service
      on public.messages
      for insert
      to service_role
      with check (true)
    $policy$;
  end if;
end
$$;

-- Keep public provider applications available, but reject arbitrary insert shapes.
do $$
declare
  has_business_fields boolean;
begin
  if to_regclass('public.service_provider_applications') is null then
    return;
  end if;

  select exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'service_provider_applications'
      and column_name in ('partner_category', 'business_name', 'team_size')
    having count(*) = 3
  ) into has_business_fields;

  execute 'drop policy if exists service_provider_applications_public_insert on public.service_provider_applications';

  if has_business_fields then
    execute $policy$
      create policy service_provider_applications_public_insert
      on public.service_provider_applications
      for insert
      to anon, authenticated
      with check (
        (submitted_by_user_id is null or submitted_by_user_id = auth.uid())
        and status = 'pending'
        and admin_notes is null
        and reviewed_by is null
        and reviewed_at is null
        and length(btrim(full_name)) between 2 and 120
        and full_name ~ '^[A-Za-z .]+$'
        and email = lower(email)
        and position('@' in email) > 1
        and phone_number ~ '^\+91[6-9][0-9]{9}$'
        and length(btrim(city)) between 2 and 120
        and length(btrim(state)) between 2 and 120
        and length(btrim(provider_type)) between 2 and 120
        and years_of_experience between 0 and 60
        and coalesce(array_length(service_modes, 1), 0) between 1 and 4
        and length(btrim(service_areas)) between 6 and 600
        and (portfolio_url is null or length(btrim(portfolio_url)) <= 2000)
        and (motivation is null or length(btrim(motivation)) <= 1200)
        and partner_category in ('individual', 'business')
        and (business_name is null or length(btrim(business_name)) <= 120)
        and (team_size is null or team_size between 1 and 500)
      )
    $policy$;
  else
    execute $policy$
      create policy service_provider_applications_public_insert
      on public.service_provider_applications
      for insert
      to anon, authenticated
      with check (
        (submitted_by_user_id is null or submitted_by_user_id = auth.uid())
        and status = 'pending'
        and admin_notes is null
        and reviewed_by is null
        and reviewed_at is null
        and length(btrim(full_name)) between 2 and 120
        and full_name ~ '^[A-Za-z .]+$'
        and email = lower(email)
        and position('@' in email) > 1
        and phone_number ~ '^\+91[6-9][0-9]{9}$'
        and length(btrim(city)) between 2 and 120
        and length(btrim(state)) between 2 and 120
        and length(btrim(provider_type)) between 2 and 120
        and years_of_experience between 0 and 60
        and coalesce(array_length(service_modes, 1), 0) between 1 and 4
        and length(btrim(service_areas)) between 6 and 600
        and (portfolio_url is null or length(btrim(portfolio_url)) <= 2000)
        and (motivation is null or length(btrim(motivation)) <= 1200)
      )
    $policy$;
  end if;
end
$$;

-- Supabase Advisor: remove anonymous/default EXECUTE from exposed SECURITY DEFINER RPCs.
do $$
declare
  target_function_names text[] := array[
    'admin_search_bookings',
    'booking_refund_events_compat_insert',
    'check_rate_limit',
    'cleanup_billing_automation_runs',
    'create_booking',
    'create_booking_atomic',
    'create_booking_transactional_v1',
    'create_booking_v2',
    'current_role_name',
    'deduct_user_credits',
    'enforce_booking_role_updates',
    'enforce_provider_booking_status_update',
    'enforce_provider_document_update_rules',
    'enforce_provider_editable_fields',
    'enforce_provider_review_response_rules',
    'enforce_user_profile_requirements_by_role',
    'get_admin_dashboard_business_stats',
    'get_available_slots',
    'get_platform_schema_health',
    'grant_user_credits',
    'increment_referral_count',
    'is_admin',
    'is_provider',
    'is_provider_owner',
    'log_owner_profile_audit_event',
    'recompute_owner_profile_metrics',
    'recompute_provider_performance_scores',
    'release_automation_lock',
    'restore_user_credits',
    'sync_provider_scores_from_reviews',
    'trg_fn_create_referral_code',
    'try_acquire_automation_lock'
  ];
  authenticated_allowed_function_names text[] := array[
    'check_rate_limit',
    'create_booking',
    'create_booking_atomic',
    'create_booking_transactional_v1',
    'create_booking_v2',
    'current_role_name',
    'get_admin_dashboard_business_stats',
    'get_available_slots',
    'is_admin',
    'is_provider',
    'is_provider_owner',
    'log_owner_profile_audit_event'
  ];
  function_record record;
begin
  for function_record in
    select
      n.nspname,
      p.proname,
      pg_get_function_identity_arguments(p.oid) as identity_arguments
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname = any(target_function_names)
      and p.prosecdef
  loop
    execute format(
      'revoke all on function %I.%I(%s) from public',
      function_record.nspname,
      function_record.proname,
      function_record.identity_arguments
    );
    execute format(
      'revoke all on function %I.%I(%s) from anon',
      function_record.nspname,
      function_record.proname,
      function_record.identity_arguments
    );
    execute format(
      'revoke all on function %I.%I(%s) from authenticated',
      function_record.nspname,
      function_record.proname,
      function_record.identity_arguments
    );
    execute format(
      'grant execute on function %I.%I(%s) to service_role',
      function_record.nspname,
      function_record.proname,
      function_record.identity_arguments
    );

    if function_record.proname = any(authenticated_allowed_function_names) then
      execute format(
        'grant execute on function %I.%I(%s) to authenticated',
        function_record.nspname,
        function_record.proname,
        function_record.identity_arguments
      );
    end if;
  end loop;
end
$$;

-- Preserve RLS helper access for current_provider_id(), which is SECURITY INVOKER.
do $$
begin
  if to_regprocedure('public.current_provider_id()') is not null then
    revoke all on function public.current_provider_id() from public;
    revoke all on function public.current_provider_id() from anon;
    grant execute on function public.current_provider_id() to authenticated, service_role;
  end if;
end
$$;

-- Tighten owner profile audit RPC so direct authenticated calls cannot spoof other users.
do $$
begin
  if to_regclass('public.owner_profile_audit_events') is not null
     and to_regprocedure('public.log_owner_profile_audit_event(uuid,text,jsonb,uuid)') is not null then
    execute $function$
      create or replace function public.log_owner_profile_audit_event(
        p_user_id uuid,
        p_action text,
        p_metadata jsonb default '{}'::jsonb,
        p_actor_id uuid default auth.uid()
      )
      returns void
      language plpgsql
      security definer
      set search_path = public
      as $body$
      declare
        v_actor_id uuid := coalesce(p_actor_id, auth.uid());
      begin
        if auth.role() <> 'service_role'
           and auth.uid() is distinct from p_user_id
           and not public.is_admin() then
          raise exception 'permission denied for owner profile audit event'
            using errcode = '42501';
        end if;

        if auth.role() <> 'service_role'
           and v_actor_id is distinct from auth.uid()
           and not public.is_admin() then
          raise exception 'permission denied for owner profile audit actor'
            using errcode = '42501';
        end if;

        insert into public.owner_profile_audit_events (user_id, actor_id, action, metadata)
        values (p_user_id, v_actor_id, p_action, coalesce(p_metadata, '{}'::jsonb));
      end;
      $body$;
    $function$;

    revoke all on function public.log_owner_profile_audit_event(uuid, text, jsonb, uuid) from public;
    revoke all on function public.log_owner_profile_audit_event(uuid, text, jsonb, uuid) from anon;
    grant execute on function public.log_owner_profile_audit_event(uuid, text, jsonb, uuid) to authenticated, service_role;
  end if;
end
$$;

-- Admin-only health RPC now runs through the service-role API route after app auth.
do $$
begin
  if to_regprocedure('public.get_platform_schema_health()') is not null then
    revoke all on function public.get_platform_schema_health() from public;
    revoke all on function public.get_platform_schema_health() from anon;
    revoke all on function public.get_platform_schema_health() from authenticated;
    grant execute on function public.get_platform_schema_health() to service_role;
  end if;
end
$$;

commit;