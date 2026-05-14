
-- enum de status do sinal
do $$ begin
  create type public.signal_event_status as enum (
    'scheduled', 'sent', 'win', 'win_g1', 'win_g2', 'loss', 'error'
  );
exception when duplicate_object then null; end $$;

create table if not exists public.signal_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  room_id uuid not null,
  window_id uuid not null,
  asset_code text not null,
  asset_category text,
  direction text not null check (direction in ('buy','sell')),
  timeframe text not null default 'M1',
  entry_at timestamptz not null,
  expires_at timestamptz not null,
  gale_level smallint not null default 0,
  max_gales smallint not null default 2,
  entry_price numeric,
  close_price numeric,
  status public.signal_event_status not null default 'scheduled',
  signal_message_ids jsonb not null default '[]'::jsonb,
  result_message_ids jsonb not null default '[]'::jsonb,
  last_error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists signal_events_window_entry_uniq
  on public.signal_events (window_id, entry_at);

create index if not exists signal_events_room_idx on public.signal_events (room_id, entry_at desc);
create index if not exists signal_events_pending_idx
  on public.signal_events (status, expires_at) where status in ('sent','scheduled');

alter table public.signal_events enable row level security;

drop policy if exists se_select_own on public.signal_events;
create policy se_select_own on public.signal_events for select using (auth.uid() = user_id);

drop trigger if exists trg_signal_events_updated on public.signal_events;
create trigger trg_signal_events_updated before update on public.signal_events
  for each row execute function public.touch_updated_at();
