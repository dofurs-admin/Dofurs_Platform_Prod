export const PROVIDER_DASHBOARD_QUERIES = {
  profile: `
    select
      id, provider_type, is_individual, business_name, bio, profile_photo_url,
      years_of_experience, phone_number, email, service_radius_km,
      is_verified, verification_status, admin_approval_status, account_status,
      average_rating, total_bookings, performance_score, cancellation_rate, no_show_count, ranking_score
    from public.providers
    where user_id = auth.uid()
    limit 1;
  `,
  details: `
    select * from public.provider_professional_details where provider_id = :provider_id;
    select * from public.provider_clinic_details where provider_id = :provider_id;
  `,
  availability: `
    select day_of_week, start_time, end_time, is_available
    from public.provider_availability
    where provider_id = :provider_id
    order by day_of_week, start_time;
  `,
  documents: `
    select document_type, document_url, verification_status, verified_at
    from public.provider_documents
    where provider_id = :provider_id
    order by created_at desc;
  `,
  reviews: `
    select rating, review_text, provider_response, created_at
    from public.provider_reviews
    where provider_id = :provider_id
    order by created_at desc
    limit 100;
  `,
  pricingViewOnly: `
    select service_type, base_price, surge_price, commission_percentage, service_duration_minutes, is_active
    from public.provider_services
    where provider_id = :provider_id
    order by service_type;
  `,
};
