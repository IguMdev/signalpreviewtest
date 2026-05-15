select cron.unschedule('dispatch-recurring-schedules')
where exists (select 1 from cron.job where jobname = 'dispatch-recurring-schedules');

select cron.schedule(
  'dispatch-recurring-schedules',
  '* * * * *',
  $$
  select net.http_post(
    url := 'https://project--8dafe7ca-cf53-49eb-9c75-fa970d91c13f-dev.lovable.app/api/public/cron/dispatch-recurring',
    headers := '{"Content-Type":"application/json","apikey":"eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InR4bW91aHl5bGhueWFwYWh4bmpqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzg3MTM0NDMsImV4cCI6MjA5NDI4OTQ0M30.BCkU4JfKgZy11CKdCnRNnqDk6qXB1x8N0LXA7FJVlrw"}'::jsonb,
    body := '{}'::jsonb
  );
  $$
);