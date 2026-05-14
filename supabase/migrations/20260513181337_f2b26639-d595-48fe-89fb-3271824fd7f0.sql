
-- Unschedule if exists (idempotent)
DO $$ BEGIN
  PERFORM cron.unschedule('dao-timelock-sweep');
EXCEPTION WHEN OTHERS THEN NULL; END $$;
DO $$ BEGIN
  PERFORM cron.unschedule('dao-treasury-ingest');
EXCEPTION WHEN OTHERS THEN NULL; END $$;

SELECT cron.schedule(
  'dao-timelock-sweep',
  '* * * * *',
  $$
  SELECT net.http_post(
    url := 'https://zxyngqciipcvveigrzqt.supabase.co/functions/v1/dao-timelock-sweep',
    headers := '{"Content-Type":"application/json","apikey":"eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inp4eW5ncWNpaXBjdnZlaWdyenF0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTEzMjIwNzYsImV4cCI6MjA2Njg5ODA3Nn0.w-fUxBsH8wZ5ewzQkGAO6sEooqPEYbYJI_vL5F36HSU"}'::jsonb,
    body := concat('{"trigger":"cron","time":"', now(), '"}')::jsonb
  );
  $$
);

SELECT cron.schedule(
  'dao-treasury-ingest',
  '*/15 * * * *',
  $$
  SELECT net.http_post(
    url := 'https://zxyngqciipcvveigrzqt.supabase.co/functions/v1/dao-treasury-ingest',
    headers := '{"Content-Type":"application/json","apikey":"eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inp4eW5ncWNpaXBjdnZlaWdyenF0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTEzMjIwNzYsImV4cCI6MjA2Njg5ODA3Nn0.w-fUxBsH8wZ5ewzQkGAO6sEooqPEYbYJI_vL5F36HSU"}'::jsonb,
    body := concat('{"trigger":"cron","time":"', now(), '"}')::jsonb
  );
  $$
);
