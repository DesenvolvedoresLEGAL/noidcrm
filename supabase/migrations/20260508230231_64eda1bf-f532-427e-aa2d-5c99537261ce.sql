-- Cron horário (minuto 7) que dispara o aviso de virada da tabela dinâmica
-- de preços (72h / 48h / 24h antes do tier atual expirar).
SELECT cron.schedule(
  'check-proposal-pricing-tier-transition-hourly',
  '7 * * * *',
  $$
  SELECT net.http_post(
    url := 'https://urihdqturaebhiefwjnw.supabase.co/functions/v1/check-proposal-pricing-tier-transition',
    headers := '{"Content-Type": "application/json", "apikey": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVyaWhkcXR1cmFlYmhpZWZ3am53Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjE0MDUzMDAsImV4cCI6MjA3Njk4MTMwMH0.RQ1EqUy4ARQb0RV0h83_Iw_QsXfdCCxZXXGrE2Y3Xx8"}'::jsonb,
    body := concat('{"time": "', now(), '"}')::jsonb
  ) AS request_id;
  $$
);