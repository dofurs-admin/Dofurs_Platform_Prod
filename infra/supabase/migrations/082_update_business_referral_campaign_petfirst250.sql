begin;

do $$
declare
  v_existing_campaign_code text;
  v_campaign_owner_user_id uuid;
begin
  select referral_code
  into v_existing_campaign_code
  from public.business_referral_campaigns
  where key = 'welcome_offer';

  select user_id
  into v_campaign_owner_user_id
  from public.referral_codes
  where code in (coalesce(v_existing_campaign_code, ''), 'PETFIRST500', 'DOFMQS68G')
  order by case code
    when coalesce(v_existing_campaign_code, '') then 0
    when 'PETFIRST500' then 1
    when 'DOFMQS68G' then 2
    else 3
  end
  limit 1;

  if v_campaign_owner_user_id is null then
    select u.id
    into v_campaign_owner_user_id
    from public.users u
    join public.roles r on r.id = u.role_id
    where r.name in ('admin', 'staff')
    order by u.created_at asc
    limit 1;
  end if;

  insert into public.business_referral_campaigns (
    key,
    referral_code,
    is_active,
    referee_reward_inr,
    referrer_reward_inr,
    notes,
    updated_by
  )
  values (
    'welcome_offer',
    'PETFIRST250',
    true,
    250,
    250,
    'Welcome-offer business referral campaign. This campaign is intentionally non-expiring unless manually disabled.',
    v_campaign_owner_user_id
  )
  on conflict (key) do update
  set referral_code = excluded.referral_code,
      is_active = true,
      referee_reward_inr = excluded.referee_reward_inr,
      referrer_reward_inr = excluded.referrer_reward_inr,
      notes = coalesce(public.business_referral_campaigns.notes, excluded.notes),
      updated_by = coalesce(public.business_referral_campaigns.updated_by, excluded.updated_by);
end $$;

commit;
