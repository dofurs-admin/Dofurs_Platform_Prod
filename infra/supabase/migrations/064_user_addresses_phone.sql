-- Add phone column to user_addresses for contact number at delivery location

alter table public.user_addresses
  add column if not exists phone text;

-- Validate format when provided: +91 followed by exactly 10 digits
alter table public.user_addresses
  add constraint user_addresses_phone_format
  check (phone is null or phone ~ '^\+91\d{10}$');

comment on column public.user_addresses.phone is 'Optional contact number for this address, stored in E.164 Indian format (+91XXXXXXXXXX)';
