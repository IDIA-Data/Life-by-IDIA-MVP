-- Unschedule prior versions if present (idempotent).
DO $$
DECLARE j TEXT;
BEGIN
  FOREACH j IN ARRAY ARRAY[
    'dao-hat-eligibility-daily',
    'dao-veto-tally-15min',
    'dao-timelock-sweep-15min',
    'dao-proposal-tally-10min'
  ] LOOP
    IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = j) THEN
      PERFORM cron.unschedule(j);
    END IF;
  END LOOP;
END $$;

SELECT cron.schedule(
  'dao-hat-eligibility-daily',
  '0 7 * * *',
  $$SELECT net.http_post(
    url := 'https://zxyngqciipcvveigrzqt.supabase.co/functions/v1/dao-hat-eligibility',
    headers := jsonb_build_object('Content-Type','application/json'),
    body := '{}'::jsonb
  );$$
);

SELECT cron.schedule(
  'dao-veto-tally-15min',
  '*/15 * * * *',
  $$SELECT net.http_post(
    url := 'https://zxyngqciipcvveigrzqt.supabase.co/functions/v1/dao-veto-tally',
    headers := jsonb_build_object('Content-Type','application/json'),
    body := '{}'::jsonb
  );$$
);

SELECT cron.schedule(
  'dao-timelock-sweep-15min',
  '*/15 * * * *',
  $$SELECT net.http_post(
    url := 'https://zxyngqciipcvveigrzqt.supabase.co/functions/v1/dao-timelock-sweep',
    headers := jsonb_build_object('Content-Type','application/json'),
    body := '{}'::jsonb
  );$$
);

SELECT cron.schedule(
  'dao-proposal-tally-10min',
  '*/10 * * * *',
  $$SELECT net.http_post(
    url := 'https://zxyngqciipcvveigrzqt.supabase.co/functions/v1/dao-proposal-tally',
    headers := jsonb_build_object('Content-Type','application/json'),
    body := '{}'::jsonb
  );$$
);