begin;

create table if not exists public.blog_posts (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  title text not null,
  excerpt text not null,
  category text not null default 'Grooming',
  read_time text,
  published_on text,
  date_published date,
  date_modified date,
  author text not null default 'Dofurs Editorial',
  tags text[] not null default '{}',
  hero_image_src text not null,
  hero_image_alt text not null,
  sections jsonb not null default '[]'::jsonb,
  status text not null default 'draft',
  display_order integer not null default 0,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint blog_posts_slug_format_check check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  constraint blog_posts_status_check check (status in ('draft', 'published', 'archived')),
  constraint blog_posts_sections_array_check check (jsonb_typeof(sections) = 'array')
);

create index if not exists idx_blog_posts_status_date on public.blog_posts(status, date_published desc, created_at desc);
create index if not exists idx_blog_posts_updated_at on public.blog_posts(updated_at desc);

create or replace function public.set_blog_posts_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_blog_posts_updated_at on public.blog_posts;
create trigger trg_blog_posts_updated_at
before update on public.blog_posts
for each row
execute function public.set_blog_posts_updated_at();

alter table public.blog_posts enable row level security;

drop policy if exists blog_posts_public_read_published on public.blog_posts;
create policy blog_posts_public_read_published
on public.blog_posts
for select
to anon, authenticated
using (status = 'published');

drop policy if exists blog_posts_admin_read_all on public.blog_posts;
create policy blog_posts_admin_read_all
on public.blog_posts
for select
to authenticated
using (coalesce(public.current_role_name() in ('admin', 'staff'), false));

drop policy if exists blog_posts_admin_insert on public.blog_posts;
create policy blog_posts_admin_insert
on public.blog_posts
for insert
to authenticated
with check (coalesce(public.current_role_name() in ('admin', 'staff'), false));

drop policy if exists blog_posts_admin_update on public.blog_posts;
create policy blog_posts_admin_update
on public.blog_posts
for update
to authenticated
using (coalesce(public.current_role_name() in ('admin', 'staff'), false))
with check (coalesce(public.current_role_name() in ('admin', 'staff'), false));

drop policy if exists blog_posts_admin_delete on public.blog_posts;
create policy blog_posts_admin_delete
on public.blog_posts
for delete
to authenticated
using (coalesce(public.current_role_name() in ('admin', 'staff'), false));

grant select on public.blog_posts to anon, authenticated;
grant insert, update, delete on public.blog_posts to authenticated;

insert into storage.buckets (id, name, public)
values ('blog-images', 'blog-images', true)
on conflict (id) do update set public = true;

drop policy if exists "blog images public read" on storage.objects;
create policy "blog images public read"
on storage.objects
for select
to public
using (bucket_id = 'blog-images');

drop policy if exists "blog images authenticated insert own" on storage.objects;
create policy "blog images authenticated insert own"
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'blog-images'
  and coalesce(public.current_role_name() in ('admin', 'staff'), false)
);

drop policy if exists "blog images authenticated update own" on storage.objects;
create policy "blog images authenticated update own"
on storage.objects
for update
to authenticated
using (
  bucket_id = 'blog-images'
  and coalesce(public.current_role_name() in ('admin', 'staff'), false)
)
with check (
  bucket_id = 'blog-images'
  and coalesce(public.current_role_name() in ('admin', 'staff'), false)
);

drop policy if exists "blog images authenticated delete own" on storage.objects;
create policy "blog images authenticated delete own"
on storage.objects
for delete
to authenticated
using (
  bucket_id = 'blog-images'
  and coalesce(public.current_role_name() in ('admin', 'staff'), false)
);

commit;