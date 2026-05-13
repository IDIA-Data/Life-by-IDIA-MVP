-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

-- Unschedule existing jobs to avoid duplicates
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'daily-apple-health-sync') THEN
    PERFORM cron.unschedule(jobid) FROM cron.job WHERE jobname = 'daily-apple-health-sync';
  END IF;
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'daily-strava-sync') THEN
    PERFORM cron.unschedule(jobid) FROM cron.job WHERE jobname = 'daily-strava-sync';
  END IF;
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'daily-google-fit-sync') THEN
    PERFORM cron.unschedule(jobid) FROM cron.job WHERE jobname = 'daily-google-fit-sync';
  END IF;
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'nightly-data-processing') THEN
    PERFORM cron.unschedule(jobid) FROM cron.job WHERE jobname = 'nightly-data-processing';
  END IF;
END $$;

-- Schedule daily Apple Health sync at 6 AM UTC
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

-- Schedule daily Strava sync at 7 AM UTC
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

-- Schedule daily Google Fit sync at 8 AM UTC
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
    headers => '{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inp4eW5ncWNpaXBjdnZlaWdyenF0Iiwicm9sZSIsInNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1MTMyMjA3NiwiZXhwIjoyMDY2ODk4MDc2fQ.G0Nj4rG9N6N2MKlf9xYyPRXA9WJQx8ZhxqCMM-tpMWY"}'::jsonb,
    body => '{"scheduled_run": true}'::jsonb
  ) as request_id;
  $cron$
);

-- Fix function error (overall_bhi_score upsert reference)
CREATE OR REPLACE FUNCTION public.calculate_business_health_index(p_business_id uuid, p_location_id uuid DEFAULT NULL::uuid)
 RETURNS numeric
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE
  sales_score DECIMAL(3,2) := 0.75;
  inventory_score DECIMAL(3,2) := 0.80;
  labor_score DECIMAL(3,2) := 0.70;
  customer_score DECIMAL(3,2) := 0.85;
  overall_score DECIMAL(3,2);
BEGIN
  overall_score := (sales_score * 0.35 + inventory_score * 0.25 + labor_score * 0.25 + customer_score * 0.15);

  INSERT INTO business_health_metrics (
    business_id, location_id, metric_date, 
    sales_score, inventory_score, labor_score, customer_score, overall_bhi_score
  ) VALUES (
    p_business_id, p_location_id, CURRENT_DATE,
    sales_score, inventory_score, labor_score, customer_score, overall_score
  ) ON CONFLICT (business_id, location_id, metric_date) 
  DO UPDATE SET
    sales_score = EXCLUDED.sales_score,
    inventory_score = EXCLUDED.inventory_score,
    labor_score = EXCLUDED.labor_score,
    customer_score = EXCLUDED.customer_score,
    overall_bhi_score = EXCLUDED.overall_bhi_score;
    
  RETURN overall_score;
END;
$function$;