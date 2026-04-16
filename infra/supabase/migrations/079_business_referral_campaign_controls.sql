begin;

alter table public.referral_redemptions
  add column if not exists referee_reward_inr integer not null default 500,
  add column if not exists referrer_reward_inr integer not null default 500;

create table if not exists public.business_referral_campaigns (
  key text primary key,
  referral_code text not null unique,
  is_active boolean not null default true,
  referee_reward_inr integer not null default 500 check (referee_reward_inr > 0),
  referrer_reward_inr integer not null default 500 check (referrer_reward_inr > 0),
  notes text,
  updated_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint business_referral_campaigns_key_check check (key = 'welcome_offer')
);

create or replace function public.touch_business_referral_campaigns_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists trg_business_referral_campaigns_updated_at on public.business_referral_campaigns;
create trigger trg_business_referral_campaigns_updated_at
before update on public.business_referral_campaigns
for each row
execute function public.touch_business_referral_campaigns_updated_at();

insert into public.business_referral_campaigns (
  key,
  referral_code,
  is_active,
  referee_reward_inr,
  referrer_reward_inr,
  notes
)
values (
  'welcome_offer',
  'DOFMQS68G',
  true,
  500,
  500,
  'Welcome-offer business referral campaign. This campaign is intentionally non-expiring unless manually disabled.'
)
on conflict (key) do nothing;

alter table public.business_referral_campaigns enable row level security;

drop policy if exists business_referral_campaigns_service_role_all on public.business_referral_campaigns;
create policy business_referral_campaigns_service_role_all
on public.business_referral_campaigns
for all
to service_role
using (true)
with check (true);

commit;