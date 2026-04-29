SELECT cron.schedule(
  'process-opportunity-indicators-queue-every-min',
  '* * * * *',
  $$
  SELECT net.http_post(
    url := 'https://urihdqturaebhiefwjnw.supabase.co/functions/v1/process-opportunity-indicators-queue',
    headers := '{"Content-Type": "application/json", "apikey": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVyaWhkcXR1cmFlYmhpZWZ3am53Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjE0MDUzMDAsImV4cCI6MjA3Njk4MTMwMH0.RQ1EqUy4ARQb0RV0h83_Iw_QsXfdCCxZXXGrE2Y3Xx8"}'::jsonb,
    body := concat('{"time": "', now(), '"}')::jsonb
  ) AS request_id;
  $$
);