create table public.pending_routine_proposals (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  proposal jsonb not null,
  status text not null default 'pending' check (status in ('pending', 'approved', 'discarded')),
  created_at timestamptz not null default now(),
  resolved_at timestamptz
);

create index pending_routine_proposals_user_status_created_idx
  on public.pending_routine_proposals(user_id, status, created_at desc);

alter table public.pending_routine_proposals enable row level security;

create policy pending_routine_proposals_owner_insert on public.pending_routine_proposals
  for insert to authenticated
  with check (user_id = auth.uid());

create policy pending_routine_proposals_owner_select on public.pending_routine_proposals
  for select to authenticated
  using (user_id = auth.uid());

create policy pending_routine_proposals_owner_update on public.pending_routine_proposals
  for update to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

grant select, insert, update on public.pending_routine_proposals to authenticated;
