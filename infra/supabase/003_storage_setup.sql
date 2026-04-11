begin;

insert into storage.buckets (id, name, public)
values
  ('user-photos', 'user-photos', false),
  ('pet-photos', 'pet-photos', false)
on conflict (id) do nothing;

drop policy if exists "user photos insert own" on storage.objects;
create policy "user photos insert own"
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'user-photos'
  and (storage.foldername(name))[1] = auth.uid()::text
);

drop policy if exists "pet photos insert own" on storage.objects;
create policy "pet photos insert own"
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'pet-photos'
  and (storage.foldername(name))[1] = auth.uid()::text
);

drop policy if exists "read own photos" on storage.objects;
create policy "read own photos"
on storage.objects
for select
to authenticated
using (
  (
    bucket_id in ('user-photos', 'pet-photos')
    and (storage.foldername(name))[1] = auth.uid()::text
  )
  or public.is_admin()
);

drop policy if exists "update own photos" on storage.objects;
create policy "update own photos"
on storage.objects
for update
to authenticated
using (
  (
    bucket_id in ('user-photos', 'pet-photos')
    and (storage.foldername(name))[1] = auth.uid()::text
  )
  or public.is_admin()
)
with check (
  (
    bucket_id in ('user-photos', 'pet-photos')
    and (storage.foldername(name))[1] = auth.uid()::text
  )
  or public.is_admin()
);

drop policy if exists "delete own photos" on storage.objects;
create policy "delete own photos"
on storage.objects
for delete
to authenticated
using (
  (
    bucket_id in ('user-photos', 'pet-photos')
    and (storage.foldername(name))[1] = auth.uid()::text
  )
  or public.is_admin()
);

commit;
