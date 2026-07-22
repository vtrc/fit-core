alter table public.pending_proposals
  add column if not exists approval_status text not null default 'pending';

alter table public.pending_proposals
  add constraint pending_proposals_approval_status_check
  check (approval_status in ('pending', 'approving'));
