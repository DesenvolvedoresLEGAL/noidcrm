
do $$
begin
  if exists (select 1 from cron.job where jobname='generate-release-notes-weekly') then
    perform cron.unschedule('generate-release-notes-weekly');
  end if;
end$$;

select cron.schedule(
  'generate-release-notes-weekly',
  '0 21 * * 5',
  $cron$ select net.http_post(
       url:='https://urihdqturaebhiefwjnw.supabase.co/functions/v1/generate-release-notes-draft',
       headers:='{"Content-Type":"application/json","apikey":"eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVyaWhkcXR1cmFlYmhpZWZ3am53Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjE0MDUzMDAsImV4cCI6MjA3Njk4MTMwMH0.RQ1EqUy4ARQb0RV0h83_Iw_QsXfdCCxZXXGrE2Y3Xx8"}'::jsonb,
       body:='{"trigger":"scheduled","period_days":7}'::jsonb
     ); $cron$
);
