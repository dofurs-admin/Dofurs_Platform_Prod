-- 047_payments_subscriptions_billing.sql
-- Adds modular payment, subscription, credit, and billing tables without modifying existing booking logic.

begin;

-- =========================
-- Subscription Catalog
-- =========================
create table if not exists public.subscription_plans (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  name text not null,
  description text,
  price_inr numeric(12,2) not null check (price_inr >= 0),
  duration_days integer not null check (duration_days > 0),
  is_active boolean not null default true,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.subscription_plan_services (
  id uuid primary key default gen_random_uuid(),
  plan_id uuid not null references public.subscription_plans(id) on delete cascade,
  service_type text not null,
  credit_count integer not null check (credit_count > 0),
  created_at timestamptz not null default timezone('utc', now()),
  unique(plan_id, service_type)
);

create index if not exists idx_subscription_plan_services_plan_id on public.subscription_plan_services(plan_id);

-- =========================
-- User Subscriptions
-- =========================
create table if not exists public.user_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  plan_id uuid not null references public.subscription_plans(id) on delete restrict,
  status text not null check (status in ('pending', 'active', 'expired', 'cancelled')),
  starts_at timestamptz,
  ends_at timestamptz,
  activated_at timestamptz,
  cancelled_at timestamptz,
  payment_transaction_id uuid,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create index if not exists idx_user_subscriptions_user_id on public.user_subscriptions(user_id);
create index if not exists idx_user_subscriptions_status on public.user_subscriptions(status);
create index if not exists idx_user_subscriptions_active_window on public.user_subscriptions(user_id, status, starts_at, ends_at);

create table if not exists public.user_service_credits (
  id uuid primary key default gen_random_uuid(),
  user_subscription_id uuid not null references public.user_subscriptions(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  service_type text not null,
  total_credits integer not null check (total_credits >= 0),
  available_credits integer not null check (available_credits >= 0),
  consumed_credits integer not null check (consumed_credits >= 0),
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  unique(user_subscription_id, service_type),
  constraint user_service_credits_totals_check check (total_credits = available_credits + consumed_credits)
);

create index if not exists idx_user_service_credits_user_service on public.user_service_credits(user_id, service_type);

-- =========================
-- Payments and Webhooks
-- =========================
create table if not exists public.subscription_payment_orders (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  plan_id uuid not null references public.subscription_plans(id) on delete restrict,
  provider text not null default 'razorpay' check (provider in ('razorpay')),
  provider_order_id text not null,
  amount_inr numeric(12,2) not null check (amount_inr >= 0),
  currency text not null default 'INR',
  status text not null check (status in ('created', 'paid', 'failed', 'cancelled')),
  receipt text,
  expires_at timestamptz,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  unique(provider, provider_order_id)
);

create index if not exists idx_subscription_payment_orders_user_id on public.subscription_payment_orders(user_id);
create index if not exists idx_subscription_payment_orders_status on public.subscription_payment_orders(status);

create table if not exists public.payment_transactions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  payment_order_id uuid references public.subscription_payment_orders(id) on delete set null,
  provider text not null default 'razorpay' check (provider in ('razorpay', 'manual')),
  transaction_type text not null check (transaction_type in ('subscription_purchase', 'service_collection')),
  status text not null check (status in ('initiated', 'authorized', 'captured', 'failed', 'refunded', 'pending_manual', 'paid_manual')),
  amount_inr numeric(12,2) not null check (amount_inr >= 0),
  currency text not null default 'INR',
  provider_payment_id text,
  provider_signature text,
  booking_id bigint references public.bookings(id) on delete set null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  unique(provider, provider_payment_id)
);

alter table public.user_subscriptions
  drop constraint if exists user_subscriptions_payment_transaction_id_fkey;

alter table public.user_subscriptions
  add constraint user_subscriptions_payment_transaction_id_fkey
  foreign key (payment_transaction_id) references public.payment_transactions(id) on delete set null;

create index if not exists idx_payment_transactions_user_id on public.payment_transactions(user_id);
create index if not exists idx_payment_transactions_booking_id on public.payment_transactions(booking_id);
create index if not exists idx_payment_transactions_status on public.payment_transactions(status);

create table if not exists public.payment_events (
  id uuid primary key default gen_random_uuid(),
  transaction_id uuid references public.payment_transactions(id) on delete cascade,
  event_type text not null,
  event_status text,
  provider text not null,
  provider_event_id text,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc', now())
);

create index if not exists idx_payment_events_transaction_id on public.payment_events(transaction_id);

create table if not exists public.payment_webhook_events (
  id uuid primary key default gen_random_uuid(),
  provider text not null default 'razorpay',
  provider_event_id text,
  event_type text not null,
  signature text,
  payload jsonb not null,
  processed boolean not null default false,
  processed_at timestamptz,
  processing_error text,
  created_at timestamptz not null default timezone('utc', now()),
  unique(provider, provider_event_id)
);

create index if not exists idx_payment_webhook_events_processed on public.payment_webhook_events(processed, created_at);

-- =========================
-- Credits and Usage
-- =========================
create table if not exists public.booking_subscription_credit_links (
  id uuid primary key default gen_random_uuid(),
  booking_id bigint not null references public.bookings(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  user_subscription_id uuid not null references public.user_subscriptions(id) on delete restrict,
  service_type text not null,
  status text not null check (status in ('reserved', 'consumed', 'released', 'restored')),
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  unique(booking_id)
);

create table if not exists public.credit_usage_events (
  id uuid primary key default gen_random_uuid(),
  booking_credit_link_id uuid not null references public.booking_subscription_credit_links(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  user_subscription_id uuid not null references public.user_subscriptions(id) on delete restrict,
  booking_id bigint not null references public.bookings(id) on delete cascade,
  service_type text not null,
  event_type text not null check (event_type in ('reserved', 'consumed', 'released', 'restored')),
  notes text,
  created_at timestamptz not null default timezone('utc', now())
);

create index if not exists idx_credit_usage_events_booking on public.credit_usage_events(booking_id, created_at);
create index if not exists idx_credit_usage_events_subscription on public.credit_usage_events(user_subscription_id, created_at);

-- =========================
-- Billing / Invoicing
-- =========================
create table if not exists public.billing_invoices (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  invoice_number text not null unique,
  invoice_type text not null check (invoice_type in ('service', 'subscription')),
  status text not null check (status in ('draft', 'issued', 'paid', 'void')),
  booking_id bigint references public.bookings(id) on delete set null,
  user_subscription_id uuid references public.user_subscriptions(id) on delete set null,
  payment_transaction_id uuid references public.payment_transactions(id) on delete set null,
  subtotal_inr numeric(12,2) not null check (subtotal_inr >= 0),
  discount_inr numeric(12,2) not null default 0 check (discount_inr >= 0),
  tax_inr numeric(12,2) not null default 0 check (tax_inr >= 0),
  total_inr numeric(12,2) not null check (total_inr >= 0),
  issued_at timestamptz,
  paid_at timestamptz,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create index if not exists idx_billing_invoices_user_id on public.billing_invoices(user_id, created_at desc);

create table if not exists public.billing_invoice_items (
  id uuid primary key default gen_random_uuid(),
  invoice_id uuid not null references public.billing_invoices(id) on delete cascade,
  item_type text not null check (item_type in ('service', 'subscription', 'discount', 'tax', 'adjustment')),
  description text not null,
  quantity integer not null default 1 check (quantity > 0),
  unit_amount_inr numeric(12,2) not null,
  line_total_inr numeric(12,2) not null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc', now())
);

create index if not exists idx_billing_invoice_items_invoice_id on public.billing_invoice_items(invoice_id);

-- =========================
-- Pay-After-Service Collection Tracking
-- =========================
create table if not exists public.booking_payment_collections (
  id uuid primary key default gen_random_uuid(),
  booking_id bigint not null references public.bookings(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  provider_id bigint,
  collection_mode text not null check (collection_mode in ('cash', 'upi', 'other')),
  amount_inr numeric(12,2) not null check (amount_inr >= 0),
  status text not null check (status in ('pending', 'paid')),
  marked_paid_by uuid references auth.users(id) on delete set null,
  marked_paid_at timestamptz,
  notes text,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  unique(booking_id)
);

-- =========================
-- Generic updated_at trigger
-- =========================
create or replace function public.touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := timezone('utc', now());
  return new;
end;
$$;

do $$
declare
  tbl text;
begin
  foreach tbl in array array[
    'subscription_plans',
    'user_subscriptions',
    'user_service_credits',
    'subscription_payment_orders',
    'payment_transactions',
    'booking_subscription_credit_links',
    'billing_invoices',
    'booking_payment_collections'
  ]
  loop
    execute format('drop trigger if exists trg_touch_%I on public.%I', tbl, tbl);
    execute format('create trigger trg_touch_%I before update on public.%I for each row execute function public.touch_updated_at()', tbl, tbl);
  end loop;
end $$;

-- =========================
-- RLS (read-safe defaults)
-- =========================
alter table public.subscription_plans enable row level security;
alter table public.subscription_plan_services enable row level security;
alter table public.user_subscriptions enable row level security;
alter table public.user_service_credits enable row level security;
alter table public.subscription_payment_orders enable row level security;
alter table public.payment_transactions enable row level security;
alter table public.payment_events enable row level security;
alter table public.payment_webhook_events enable row level security;
alter table public.booking_subscription_credit_links enable row level security;
alter table public.credit_usage_events enable row level security;
alter table public.billing_invoices enable row level security;
alter table public.billing_invoice_items enable row level security;
alter table public.booking_payment_collections enable row level security;

-- Catalog is readable by authenticated users.
drop policy if exists subscription_plans_read on public.subscription_plans;
create policy subscription_plans_read on public.subscription_plans
for select to authenticated
using (is_active = true);

drop policy if exists subscription_plan_services_read on public.subscription_plan_services;
create policy subscription_plan_services_read on public.subscription_plan_services
for select to authenticated
using (
  exists (
    select 1
    from public.subscription_plans p
    where p.id = subscription_plan_services.plan_id
      and p.is_active = true
  )
);

-- User-owned data read policy.
drop policy if exists user_subscriptions_owner_rw on public.user_subscriptions;
create policy user_subscriptions_owner_rw on public.user_subscriptions
for all to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

drop policy if exists user_service_credits_owner_read on public.user_service_credits;
create policy user_service_credits_owner_read on public.user_service_credits
for select to authenticated
using (auth.uid() = user_id);

drop policy if exists subscription_payment_orders_owner_rw on public.subscription_payment_orders;
create policy subscription_payment_orders_owner_rw on public.subscription_payment_orders
for all to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

drop policy if exists payment_transactions_owner_read on public.payment_transactions;
create policy payment_transactions_owner_read on public.payment_transactions
for select to authenticated
using (auth.uid() = user_id);

drop policy if exists payment_events_owner_read on public.payment_events;
create policy payment_events_owner_read on public.payment_events
for select to authenticated
using (
  exists (
    select 1
    from public.payment_transactions t
    where t.id = payment_events.transaction_id
      and t.user_id = auth.uid()
  )
);

drop policy if exists booking_subscription_credit_links_owner_read on public.booking_subscription_credit_links;
create policy booking_subscription_credit_links_owner_read on public.booking_subscription_credit_links
for select to authenticated
using (auth.uid() = user_id);

drop policy if exists credit_usage_events_owner_read on public.credit_usage_events;
create policy credit_usage_events_owner_read on public.credit_usage_events
for select to authenticated
using (auth.uid() = user_id);

drop policy if exists billing_invoices_owner_read on public.billing_invoices;
create policy billing_invoices_owner_read on public.billing_invoices
for select to authenticated
using (auth.uid() = user_id);

drop policy if exists billing_invoice_items_owner_read on public.billing_invoice_items;
create policy billing_invoice_items_owner_read on public.billing_invoice_items
for select to authenticated
using (
  exists (
    select 1 from public.billing_invoices i
    where i.id = billing_invoice_items.invoice_id
      and i.user_id = auth.uid()
  )
);

drop policy if exists booking_payment_collections_owner_read on public.booking_payment_collections;
create policy booking_payment_collections_owner_read on public.booking_payment_collections
for select to authenticated
using (auth.uid() = user_id);

commit;
