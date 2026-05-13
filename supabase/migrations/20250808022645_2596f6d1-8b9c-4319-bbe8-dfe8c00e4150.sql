-- Create automated data sync jobs for connected data sources

-- First, ensure pg_cron and pg_net extensions are enabled
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

-- Schedule daily Apple Health sync at 6 AM UTC for all active connections
SELECT cron.schedule(
  'daily-apple-health-sync',
  '0 6 * * *',
  $cron$
  SELECT net.http_post(
    url => 'https://zxyngqciipcvveigrzqt.supabase.co/functions/v1/apple-health-sync',
    headers => '{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inp4eW5ncWNpaXBjdnZlaWdyenF0Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1MTMyMjA3NiwiZXhwIjoyMDY2ODk4MDc2fQ.G0Nj4rG9N6N2MKlf9xYyPRXA9WJQx8ZhxqCMM-tpMWY"}'::jsonb,
    body => '{"automated_sync": true}'::jsonb
  ) as request_id;
  $cron$
);

-- Schedule daily Strava sync at 7 AM UTC for all active connections  
SELECT cron.schedule(
  'daily-strava-sync',
  '0 7 * * *',
  $cron$
  SELECT net.http_post(
    url => 'https://zxyngqciipcvveigrzqt.supabase.co/functions/v1/ingest-strava-data',
    headers => '{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inp4eW5ncWNpaXBjdnZlaWdyenF0Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1MTMyMjA3NiwiZXhwIjoyMDY2ODk4MDc2fQ.G0Nj4rG9N6N2MKlf9xYyPRXA9WJQx8ZhxqCMM-tpMWY"}'::jsonb,
    body => '{"automated_sync": true}'::jsonb
  ) as request_id;
  $cron$
);

-- Schedule Google Fit sync at 8 AM UTC for all active connections
SELECT cron.schedule(
  'daily-google-fit-sync', 
  '0 8 * * *',
  $cron$
  SELECT net.http_post(
    url => 'https://zxyngqciipcvveigrzqt.supabase.co/functions/v1/google-fit-sync',
    headers => '{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inp4eW5ncWNpaXBjdnZlaWdyenF0Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1MTMyMjA3NiwiZXhwIjoyMDY2ODk4MDc2fQ.G0Nj4rG9N6N2MKlf9xYyPRXA9WJQx8ZhxqCMM-tpMWY"}'::jsonb,
    body => '{"automated_sync": true}'::jsonb
  ) as request_id;
  $cron$
);

-- Schedule comprehensive nightly data processing at 12 PM (noon) UTC
SELECT cron.schedule(
  'nightly-data-processing',
  '0 12 * * *',
  $cron$
  SELECT net.http_post(
    url => 'https://zxyngqciipcvveigrzqt.supabase.co/functions/v1/nightly-data-processor',
    headers => '{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inp4eW5ncWNpaXBjdnZlaWdyenF0Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1MTMyMjA3NiwiZXhwIjoyMDY2ODk4MDc2fQ.G0Nj4rG9N6N2MKlf9xYyPRXA9WJQx8ZhxqCMM-tpMWY"}'::jsonb,
    body => '{"scheduled_run": true}'::jsonb
  ) as request_id;
  $cron$
);