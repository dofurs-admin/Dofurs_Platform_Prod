-- Fix: avoid recursive RLS evaluation on bookings updates.
-- Some legacy policies self-query `public.bookings` in WITH CHECK, which can trigger
-- `42P17: infinite recursion detected in policy for relation "bookings"`.

begin;

drop policy if exists "bookings_provider_update_status" on public.bookings;
create policy "bookings_provider_update_status"
  on public.bookings
  as permissive
  for update
  to authenticated
  using (
    auth.jwt() ->> 'role' = 'provider'
    and provider_id = (
      select id
      from public.providers
      where user_id = auth.uid()
    )
  )
  with check (
    auth.jwt() ->> 'role' = 'provider'
    and provider_id = (
      select id
      from public.providers
      where user_id = auth.uid()
    )
  );

drop policy if exists "bookings_user_update" on public.bookings;
create policy "bookings_user_update"
  on public.bookings
  as permissive
  for update
  to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

commit;
