begin;

do $$
declare
  v_user_role_id smallint;
  v_missing_count integer := 0;
  v_inserted_count integer := 0;
begin
  select id into v_user_role_id
  from public.roles
  where name = 'user';

  if v_user_role_id is null then
    raise exception 'Default user role not found in public.roles';
  end if;

  select count(*) into v_missing_count
  from auth.users au
  left join public.users pu on pu.id = au.id
  where pu.id is null;

  with source_rows as (
    select
      au.id,
      au.created_at,
      lower(nullif(trim(coalesce(au.email, au.raw_user_meta_data ->> 'email')), '')) as email,
      nullif(trim(coalesce(au.phone, au.raw_user_meta_data ->> 'phone')), '') as phone,
      coalesce(
        nullif(trim(au.raw_user_meta_data ->> 'name'), ''),
        nullif(trim(au.raw_user_meta_data ->> 'full_name'), ''),
        split_part(lower(nullif(trim(coalesce(au.email, au.raw_user_meta_data ->> 'email')), '')), '@', 1),
        'Pet Owner'
      ) as full_name,
      coalesce(
        nullif(trim(au.raw_user_meta_data ->> 'address'), ''),
        'Address pending update'
      ) as address,
      case
        when (au.raw_user_meta_data ->> 'age') ~ '^[0-9]+$'
          and (au.raw_user_meta_data ->> 'age')::integer between 13 and 120
        then (au.raw_user_meta_data ->> 'age')::integer
        else 18
      end as age,
      case
        when lower(nullif(trim(au.raw_user_meta_data ->> 'gender'), '')) in ('male', 'female', 'other')
        then lower(trim(au.raw_user_meta_data ->> 'gender'))
        else 'other'
      end as gender,
      nullif(trim(au.raw_user_meta_data ->> 'photo_url'), '') as photo_url
    from auth.users au
    left join public.users pu on pu.id = au.id
    where pu.id is null
  ),
  deduped_rows as (
    select
      s.*,
      row_number() over (partition by s.phone order by s.created_at asc, s.id asc) as phone_rank,
      row_number() over (partition by coalesce(s.email, s.id::text) order by s.created_at asc, s.id asc) as email_rank
    from source_rows s
  ),
  eligible_rows as (
    select d.*
    from deduped_rows d
    where d.phone is not null
      and d.phone_rank = 1
      and d.email_rank = 1
      and not exists (
        select 1
        from public.users u
        where u.phone = d.phone
      )
      and (
        d.email is null
        or not exists (
          select 1
          from public.users u
          where lower(u.email) = d.email
        )
      )
  ),
  inserted_users as (
    insert into public.users (
      id,
      phone,
      name,
      email,
      address,
      age,
      gender,
      role_id
    )
    select
      e.id,
      e.phone,
      e.full_name,
      e.email,
      e.address,
      e.age,
      e.gender,
      v_user_role_id
    from eligible_rows e
    on conflict (id) do nothing
    returning id, name, phone, gender, photo_url
  )
  insert into public.profiles (
    id,
    full_name,
    phone_number,
    gender,
    profile_photo_url
  )
  select
    i.id,
    i.name,
    i.phone,
    i.gender,
    i.photo_url
  from inserted_users i
  on conflict (id) do nothing;

  get diagnostics v_inserted_count = row_count;

  raise notice 'Backfill completed. Missing auth users: %, inserted/updated owner profiles: %', v_missing_count, v_inserted_count;
end $$;

commit;