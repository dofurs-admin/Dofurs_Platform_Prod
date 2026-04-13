-- Migration: Keep provider rating/performance stats in sync with actual reviews.
-- Purpose: Recompute provider aggregates whenever provider_reviews changes.

begin;

create or replace function public.sync_provider_scores_from_reviews()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'UPDATE' then
    if old.provider_id is distinct from new.provider_id then
      perform public.recompute_provider_performance_scores(old.provider_id);
      perform public.recompute_provider_performance_scores(new.provider_id);
    else
      perform public.recompute_provider_performance_scores(new.provider_id);
    end if;
  else
    perform public.recompute_provider_performance_scores(
      coalesce(new.provider_id, old.provider_id)
    );
  end if;

  return null;
end;
$$;

drop trigger if exists trg_provider_reviews_recompute_scores on public.provider_reviews;
create trigger trg_provider_reviews_recompute_scores
after insert or update of rating, provider_id or delete on public.provider_reviews
for each row
execute function public.sync_provider_scores_from_reviews();

commit;
