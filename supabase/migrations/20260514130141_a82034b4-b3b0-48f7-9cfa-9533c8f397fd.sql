
create table public.telegram_member_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  account_id uuid not null,
  chat_id bigint not null,
  chat_title text,
  tg_user_id bigint not null,
  tg_username text,
  tg_first_name text,
  event_type text not null check (event_type in ('join','leave','kicked')),
  old_status text,
  new_status text,
  occurred_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create index idx_tme_user_date on public.telegram_member_events (user_id, occurred_at desc);
create index idx_tme_account_chat_date on public.telegram_member_events (account_id, chat_id, occurred_at desc);

alter table public.telegram_member_events enable row level security;

create policy tme_select_own on public.telegram_member_events
  for select using (auth.uid() = user_id);

create policy tme_insert_service on public.telegram_member_events
  for insert with check (true);
