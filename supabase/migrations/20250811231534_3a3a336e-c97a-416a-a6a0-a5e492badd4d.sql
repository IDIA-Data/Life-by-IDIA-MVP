-- Disable cron jobs related to simulated data source syncs
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
END $$;

-- Keep nightly data processing job active (no change)
-- NOTE: No action taken for 'nightly-data-processing' since it performs real processing