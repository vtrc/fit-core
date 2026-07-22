create extension if not exists vector with schema public;

create table public.chat_messages (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null check (role in ('user', 'assistant', 'tool')),
  content text not null,
  embedding vector(1024),
  metadata jsonb not null default '{}',
  created_at timestamptz not null default now()
);

create index chat_messages_user_id_created_at_idx on public.chat_messages(user_id, created_at desc);
create index chat_messages_embedding_idx on public.chat_messages using ivfflat (embedding vector_cosine_ops) with (lists = 100);

alter table public.chat_messages enable row level security;

create policy chat_messages_owner_insert on public.chat_messages
  for insert to authenticated
  with check (user_id = auth.uid());

create policy chat_messages_owner_select on public.chat_messages
  for select to authenticated
  using (user_id = auth.uid());

grant select, insert on public.chat_messages to authenticated;
