begin;

alter table public.discount_redemptions
  add column if not exists reversed_at timestamptz,
  add column if not exists reversal_reason text;

create index if not exists idx_discount_redemptions_active
  on public.discount_redemptions(discount_id, created_at desc)
  where reversed_at is null;

commit;
