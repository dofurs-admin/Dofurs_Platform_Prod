begin;

alter table if exists public.bookings
  drop constraint if exists bookings_provider_service_id_fkey;

alter table if exists public.bookings
  add constraint bookings_provider_service_id_fkey
  foreign key (provider_service_id)
  references public.provider_services(id)
  on delete set null;

commit;
