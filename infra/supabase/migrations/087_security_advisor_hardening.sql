begin;

-- Supabase Advisor: public.schema_migrations should not be exposed via PostgREST.
create table if not exists public.schema_migrations (
  filename text primary key,
  applied_at timestamptz not null default now()
);

alter table public.schema_migrations enable row level security;
revoke all on table public.schema_migrations from anon, authenticated;

-- Supabase Advisor: billing automation telemetry needs RLS before it is exposed in public.
do $$
begin
  if to_regclass('public.billing_automation_runs') is not null then
    execute 'alter table public.billing_automation_runs enable row level security';
    execute 'revoke all on table public.billing_automation_runs from anon';
    execute 'grant select on table public.billing_automation_runs to authenticated';

    execute 'drop policy if exists billing_automation_runs_select_admin_v1 on public.billing_automation_runs';
    execute $policy$
      create policy billing_automation_runs_select_admin_v1
      on public.billing_automation_runs
      for select
      to authenticated
      using (public.is_admin())
    $policy$;
  end if;
end
$$;

-- Supabase Advisor: legacy refund compatibility view should run with invoker rights.
do $$
begin
  if exists (
    select 1
    from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public'
      and c.relname = 'booking_refund_events'
      and c.relkind = 'v'
  ) then
    execute 'alter view public.booking_refund_events set (security_invoker = true)';
    execute 'revoke all on table public.booking_refund_events from anon';
    execute 'grant select, insert on table public.booking_refund_events to authenticated';
  end if;
end
$$;

-- Keep legacy inserts admin-only if anything still writes through the compatibility view.
do $$
begin
  if to_regclass('public.booking_adjustment_events') is not null
     and to_regprocedure('public.is_admin()') is not null then
    execute $function$
      create or replace function public.booking_refund_events_compat_insert()
      returns trigger
      language plpgsql
      security definer
      set search_path = public
      as $body$
      declare
        v_id uuid;
      begin
        if not public.is_admin() then
          raise exception 'permission denied for booking_refund_events'
            using errcode = '42501';
        end if;

        insert into public.booking_adjustment_events (
          booking_id,
          actor_id,
          adjustment_amount,
          reason,
          metadata,
          adjustment_type,
          created_at
        )
        values (
          new.booking_id,
          new.actor_id,
          new.refund_amount,
          new.reason,
          coalesce(new.metadata, '{}'::jsonb),
          'legacy_refund_compat',
          coalesce(new.created_at, now())
        )
        returning id into v_id;

        new.id := v_id;
        return new;
      end;
      $body$;
    $function$;
  end if;
end
$$;

commit;
