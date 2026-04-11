export const BOOKING_DASHBOARD_QUERIES = {
  providerToday: `
    select
      b.id,
      b.booking_date,
      b.start_time,
      b.end_time,
      b.booking_status,
      b.booking_mode,
      b.service_type,
      b.provider_notes,
      p.name as pet_name,
      u.name as owner_name,
      u.phone as owner_phone
    from public.bookings b
    join public.pets p on p.id = b.pet_id
    join public.users u on u.id = b.user_id
    where b.provider_id = :provider_id
      and b.booking_date = current_date
    order by b.start_time asc;
  `,
  providerUpcoming: `
    select
      b.id,
      b.booking_date,
      b.start_time,
      b.end_time,
      b.booking_status,
      b.booking_mode,
      b.service_type,
      b.price_at_booking,
      p.name as pet_name
    from public.bookings b
    join public.pets p on p.id = b.pet_id
    where b.provider_id = :provider_id
      and b.booking_date >= current_date
      and b.booking_status in ('pending', 'confirmed')
    order by b.booking_date asc, b.start_time asc
    limit 200;
  `,
  providerSlotLoad: `
    select
      booking_date,
      count(*) filter (where booking_status in ('pending', 'confirmed')) as active_bookings,
      count(*) filter (where booking_status = 'completed') as completed_bookings,
      count(*) filter (where booking_status = 'cancelled') as cancelled_bookings,
      count(*) filter (where booking_status = 'no_show') as no_show_bookings
    from public.bookings
    where provider_id = :provider_id
      and booking_date between :from_date and :to_date
    group by booking_date
    order by booking_date asc;
  `,
};