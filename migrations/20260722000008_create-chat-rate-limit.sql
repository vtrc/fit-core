create table if not exists public.chat_rate_limits (
  user_id uuid primary key references auth.users(id) on delete cascade,
  window_started_at timestamptz not null,
  request_count integer not null
);

alter table public.chat_rate_limits enable row level security;

create policy chat_rate_limits_owner_all on public.chat_rate_limits
  for all to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

create or replace function public.check_chat_rate_limit(
  p_user_id uuid,
  p_limit integer,
  p_window_seconds integer
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  current_count integer;
  window_started timestamptz;
  now_at timestamptz := clock_timestamp();
begin
  if auth.uid() is null or auth.uid() <> p_user_id then
    raise exception 'User identity does not match rate-limit subject';
  end if;

  select request_count, window_started_at
    into current_count, window_started
    from public.chat_rate_limits
    where user_id = p_user_id
    for update;

  if not found then
    insert into public.chat_rate_limits(user_id, window_started_at, request_count)
      values (p_user_id, now_at, 1);
    return true;
  end if;

  if now_at >= window_started + make_interval(secs => p_window_seconds) then
    update public.chat_rate_limits
      set window_started_at = now_at, request_count = 1
      where user_id = p_user_id;
    return true;
  end if;

  if current_count >= p_limit then
    return false;
  end if;

  update public.chat_rate_limits
    set request_count = current_count + 1
    where user_id = p_user_id;
  return true;
end;
$$;

revoke all on function public.check_chat_rate_limit(uuid, integer, integer) from public;
grant execute on function public.check_chat_rate_limit(uuid, integer, integer) to authenticated;
