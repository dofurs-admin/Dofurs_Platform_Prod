create or replace function public.enforce_booking_role_updates()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  -- Allow service-role API writes, admin JWT writes, and trusted SQL console maintenance sessions.
  if auth.role() = 'service_role'
     or public.is_admin()
     or current_user in ('postgres', 'supabase_admin')
     or session_user in ('postgres', 'supabase_admin') then
    return new;
  end if;

  if old.user_id = auth.uid() then
    if new.user_id is distinct from old.user_id
      or new.pet_id is distinct from old.pet_id
      or new.provider_id is distinct from old.provider_id
      or new.provider_service_id is distinct from old.provider_service_id
      or new.service_id is distinct from old.service_id
      or new.service_type is distinct from old.service_type
      or new.booking_date is distinct from old.booking_date
      or new.start_time is distinct from old.start_time
      or new.end_time is distinct from old.end_time
      or new.booking_mode is distinct from old.booking_mode
      or new.location_address is distinct from old.location_address
      or new.latitude is distinct from old.latitude
      or new.longitude is distinct from old.longitude
      or new.price_at_booking is distinct from old.price_at_booking
      or new.admin_price_reference is distinct from old.admin_price_reference
      or new.provider_notes is distinct from old.provider_notes
      or new.internal_notes is distinct from old.internal_notes
      or new.payment_mode is distinct from old.payment_mode
      or new.platform_fee is distinct from old.platform_fee
      or new.provider_payout_status is distinct from old.provider_payout_status then
      raise exception 'Users cannot modify booking financials or scheduling details';
    end if;

    if new.booking_status <> 'cancelled' then
      raise exception 'Users can only cancel their bookings';
    end if;

    if coalesce(new.cancellation_by, 'user') <> 'user' then
      raise exception 'User cancellation must set cancellation_by=user';
    end if;

    return new;
  end if;

  if public.is_provider_owner(old.provider_id) then
    if new.user_id is distinct from old.user_id
      or new.pet_id is distinct from old.pet_id
      or new.provider_id is distinct from old.provider_id
      or new.provider_service_id is distinct from old.provider_service_id
      or new.service_id is distinct from old.service_id
      or new.service_type is distinct from old.service_type
      or new.booking_date is distinct from old.booking_date
      or new.start_time is distinct from old.start_time
      or new.end_time is distinct from old.end_time
      or new.booking_mode is distinct from old.booking_mode
      or new.location_address is distinct from old.location_address
      or new.latitude is distinct from old.latitude
      or new.longitude is distinct from old.longitude
      or new.price_at_booking is distinct from old.price_at_booking
      or new.admin_price_reference is distinct from old.admin_price_reference
      or new.internal_notes is distinct from old.internal_notes
      or new.payment_mode is distinct from old.payment_mode
      or new.platform_fee is distinct from old.platform_fee
      or new.provider_payout_status is distinct from old.provider_payout_status then
      raise exception 'Providers cannot modify booking identity, financials or schedule';
    end if;

    return new;
  end if;

  raise exception 'Not authorized to update booking';
end;
$$;