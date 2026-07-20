alter table public.routines
  add column position integer;

-- Set initial position for existing routines per user,
-- ordered by most recently updated first.
with ranked as (
  select
    id,
    row_number() over (
      partition by user_id
      order by updated_at desc, created_at desc, id
    ) - 1 as pos
  from public.routines
)
update public.routines r
  set position = ranked.pos
  from ranked
  where r.id = ranked.id;
