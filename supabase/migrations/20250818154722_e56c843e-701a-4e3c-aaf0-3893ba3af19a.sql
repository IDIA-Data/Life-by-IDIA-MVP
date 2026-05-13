-- Test the reward pipeline by manually triggering for recent staged data
SELECT net.http_post(
  'https://zxyngqciipcvveigrzqt.supabase.co/functions/v1/process-staged-data',
  json_build_object(
    'staged_data_id', (
      SELECT id FROM staged_data 
      WHERE raw_data_id IS NOT NULL 
        AND user_id IS NOT NULL
        AND raw_data_id IN (
          SELECT id FROM raw_health_data 
          WHERE created_at >= '2024-08-18'
        )
      ORDER BY processed_at DESC
      LIMIT 1
    )
  )::jsonb,
  '{}'::jsonb,
  '{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inp4eW5ncWNpaXBjdnZlaWdyenF0Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1MTMyMjA3NiwiZXhwIjoyMDY2ODk4MDc2fQ.G0Nj4rG9N6N2MKlf9xYyPRXA9WJQx8ZhxqCMM-tpMWY"}'::jsonb,
  10000
) as test_result;