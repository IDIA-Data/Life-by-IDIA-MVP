-- Create automated data sync jobs for connected data sources

-- First, ensure pg_cron and pg_net extensions are enabled
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

-- Schedule daily Apple Health sync at 6 AM UTC for all active connections
SELECT cron.schedule(
  'daily-apple-health-sync',
  '0 6 * * *', -- Daily at 6 AM UTC
  $$
  DO $$
  DECLARE
    connection_rec RECORD;
  BEGIN
    -- Loop through all active Apple Health connections
    FOR connection_rec IN 
      SELECT user_id, access_token, id 
      FROM data_connections 
      WHERE connection_type = 'apple_health' 
      AND is_active = true
    LOOP
      -- Trigger Apple Health sync for each user
      PERFORM net.http_post(
        url := 'https://zxyngqciipcvveigrzqt.supabase.co/functions/v1/apple-health-sync',
        headers := '{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inp4eW5ncWNpaXBjdnZlaWdyenF0Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1MTMyMjA3NiwiZXhwIjoyMDY2ODk4MDc2fQ.G0Nj4rG9N6N2MKlf9xYyPRXA9WJQx8ZhxqCMM-tpMWY"}'::jsonb,
        body := json_build_object(
          'user_id', connection_rec.user_id,
          'automated_sync', true,
          'connection_id', connection_rec.id
        )::jsonb
      );
      
      -- Update last sync time
      UPDATE data_connections 
      SET last_sync_at = now(), updated_at = now()
      WHERE id = connection_rec.id;
      
    END LOOP;
  END $$;
  $$
);

-- Schedule daily Strava sync at 7 AM UTC for all active connections
SELECT cron.schedule(
  'daily-strava-sync',
  '0 7 * * *', -- Daily at 7 AM UTC
  $$
  DO $$
  DECLARE
    connection_rec RECORD;
  BEGIN
    -- Loop through all active Strava connections
    FOR connection_rec IN 
      SELECT user_id, access_token, id 
      FROM data_connections 
      WHERE connection_type = 'strava' 
      AND is_active = true
    LOOP
      -- Trigger Strava data ingestion for each user
      PERFORM net.http_post(
        url := 'https://zxyngqciipcvveigrzqt.supabase.co/functions/v1/ingest-strava-data',
        headers := '{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inp4eW5ncWNpaXBjdnZlaWdyenF0Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1MTMyMjA3NiwiZXhwIjoyMDY2ODk4MDc2fQ.G0Nj4rG9N6N2MKlf9xYyPRXA9WJQx8ZhxqCMM-tpMWY"}'::jsonb,
        body := json_build_object(
          'user_id', connection_rec.user_id,
          'access_token', connection_rec.access_token,
          'automated_sync', true,
          'connection_id', connection_rec.id
        )::jsonb
      );
      
      -- Update last sync time
      UPDATE data_connections 
      SET last_sync_at = now(), updated_at = now()
      WHERE id = connection_rec.id;
      
    END LOOP;
  END $$;
  $$
);

-- Schedule Google Fit sync at 8 AM UTC for all active connections
SELECT cron.schedule(
  'daily-google-fit-sync',
  '0 8 * * *', -- Daily at 8 AM UTC
  $$
  DO $$
  DECLARE
    connection_rec RECORD;
  BEGIN
    -- Loop through all active Google Fit connections
    FOR connection_rec IN 
      SELECT user_id, access_token, id 
      FROM data_connections 
      WHERE connection_type = 'google_fit' 
      AND is_active = true
    LOOP
      -- Trigger Google Fit sync for each user
      PERFORM net.http_post(
        url := 'https://zxyngqciipcvveigrzqt.supabase.co/functions/v1/google-fit-sync',
        headers := '{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inp4eW5ncWNpaXBjdnZlaWdyenF0Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1MTMyMjA3NiwiZXhwIjoyMDY2ODk4MDc2fQ.G0Nj4rG9N6N2MKlf9xYyPRXA9WJQx8ZhxqCMM-tpMWY"}'::jsonb,
        body := json_build_object(
          'user_id', connection_rec.user_id,
          'google_access_token', connection_rec.access_token,
          'automated_sync', true,
          'connection_id', connection_rec.id
        )::jsonb
      );
      
      -- Update last sync time
      UPDATE data_connections 
      SET last_sync_at = now(), updated_at = now()
      WHERE id = connection_rec.id;
      
    END LOOP;
  END $$;
  $$
);

-- Schedule comprehensive nightly data processing at 12 PM (noon) UTC
SELECT cron.schedule(
  'nightly-data-processing',
  '0 12 * * *', -- Daily at noon UTC (12 PM)
  $$
  SELECT net.http_post(
    url := 'https://zxyngqciipcvveigrzqt.supabase.co/functions/v1/nightly-data-processor',
    headers := '{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inp4eW5ncWNpaXBjdnZlaWdyenF0Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1MTMyMjA3NiwiZXhwIjoyMDY2ODk4MDc2fQ.G0Nj4rG9N6N2MKlf9xYyPRXA9WJQx8ZhxqCMM-tpMWY"}'::jsonb,
    body := '{"scheduled_run": true}'::jsonb
  );
  $$
);