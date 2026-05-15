create table if not exists public.room_report_runs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  room_id uuid not null,
  window_id uuid not null,
  report_key text not null,
  message_ids jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  unique (room_id, window_id, report_key)
);

alter table public.room_report_runs enable row level security;

drop policy if exists rrr_select_own on public.room_report_runs;
create policy rrr_select_own on public.room_report_runs
  for select using (auth.uid() = user_id);

create index if not exists room_report_runs_room_created_idx
  on public.room_report_runs (room_id, created_at desc);

select cron.unschedule('dispatch-recurring-schedules')
where exists (select 1 from cron.job where jobname = 'dispatch-recurring-schedules');

select cron.schedule(
  'dispatch-recurring-schedules',
  '* * * * *',
  $$
  select net.http_post(
    url := 'https://project--8dafe7ca-cf53-49eb-9c75-fa970d91c13f-dev.lovable.app/api/public/cron/dispatch-recurring',
    headers := '{"Content-Type":"application/json","apikey":"eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJIUzI1NiIsInJlZiI6InR4bW91aHl5bGhueWFwYWh4bmpqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzg3MTM0NDMsImV4cCI6MjA5NDI4OTQ0M30.BCkU4JfKgZy11CKdCnRNnqDk6qXB1x8N0LXA7FJVlrw"}'::jsonb,
    body := '{}'::jsonb
  );
  $$
);