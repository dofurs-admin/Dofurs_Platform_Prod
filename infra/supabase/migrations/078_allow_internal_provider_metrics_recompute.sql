-- Migration: Allow internal provider metric recomputation updates.
-- Purpose: Prevent customer review submissions from failing provider profile edit guards.

begin;

create or replace function public.enforce_provider_editable_fields()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.role() = 'service_role' or public.is_admin() then
    return new;
  end if;

  if current_setting('dofurs.internal_provider_metrics_update', true) = 'on' then
    return new;
  end if;

  if public.is_provider_owner(old.id) then
    if old.bio is distinct from new.bio
      or old.profile_photo_url is distinct from new.profile_photo_url
      or old.years_of_experience is distinct from new.years_of_experience
      or old.phone_number is distinct from new.phone_number
      or old.email is distinct from new.email
      or old.service_radius_km is distinct from new.service_radius_km then
      -- Allowed changes; now verify nothing else changed.
      null;
    end if;

    if old.user_id is distinct from new.user_id
      or old.provider_type is distinct from new.provider_type
      or old.is_individual is distinct from new.is_individual
      or old.business_name is distinct from new.business_name
      or old.is_verified is distinct from new.is_verified
      or old.verification_status is distinct from new.verification_status
      or old.background_verified is distinct from new.background_verified
      or old.admin_approval_status is distinct from new.admin_approval_status
      or old.account_status is distinct from new.account_status
      or old.average_rating is distinct from new.average_rating
      or old.total_bookings is distinct from new.total_bookings
      or old.performance_score is distinct from new.performance_score
      or old.cancellation_rate is distinct from new.cancellation_rate
      or old.no_show_count is distinct from new.no_show_count
      or old.ranking_score is distinct from new.ranking_score
      or old.accepts_platform_payment is distinct from new.accepts_platform_payment
      or old.payout_method_type is distinct from new.payout_method_type
      or old.payout_details is distinct from new.payout_details
      or old.name is distinct from new.name
      or old.type is distinct from new.type
      or old.address is distinct from new.address
      or old.lat is distinct from new.lat
      or old.lng is distinct from new.lng
      or old.working_days is distinct from new.working_days
      or old.start_time is distinct from new.start_time
      or old.end_time is distinct from new.end_time
      or old.created_at is distinct from new.created_at then
      raise exception 'Providers can only edit: bio, profile_photo_url, years_of_experience, phone_number, email, service_radius_km';
    end if;

    return new;
  end if;

  raise exception 'Not authorized to update provider profile';
end;
$$;

create or replace function public.sync_provider_scores_from_reviews()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  perform set_config('dofurs.internal_provider_metrics_update', 'on', true);

  if tg_op = 'UPDATE' then
    if old.provider_id is distinct from new.provider_id then
      perform public.recompute_provider_performance_scores(old.provider_id);
      perform public.recompute_provider_performance_scores(new.provider_id);
    else
      perform public.recompute_provider_performance_scores(new.provider_id);
    end if;
  else
    perform public.recompute_provider_performance_scores(
      coalesce(new.provider_id, old.provider_id)
    );
  end if;

  return null;
end;
$$;

commit;
