create table if not exists pending_proposals (
  id uuid default gen_random_uuid() primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  proposal jsonb not null,
  profile jsonb not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(user_id)
);

alter table pending_proposals enable row level security;

create policy "Users manage own pending proposals"
  on pending_proposals
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
