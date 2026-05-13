-- Fix database trigger functions to make proper HTTP calls

-- Update trigger_idia_synapse_orchestration to make HTTP POST to IDIA-Synapse
CREATE OR REPLACE FUNCTION public.trigger_idia_synapse_orchestration()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $function$
BEGIN
  -- Log trigger execution for debugging
  RAISE LOG 'Trigger fired for raw_health_data insert/update: %', NEW.id;
  
  -- Only proceed if not already processed
  IF NEW.processed = false THEN
    RAISE LOG 'Calling IDIA-Synapse for raw_data_id: %', NEW.id;
    
    -- Make HTTP call to IDIA-Synapse orchestrator
    PERFORM net.http_post(
      url := 'https://zxyngqciipcvveigrzqt.supabase.co/functions/v1/idia-synapse',
      headers := '{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inp4eW5ncWNpaXBjdnZlaWdyenF0Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1MTMyMjA3NiwiZXhwIjoyMDY2ODk4MDc2fQ.G0Nj4rG9N6N2MKlf9xYyPRXA9WJQx8ZhxqCMM-tpMWY"}'::jsonb,
      body := json_build_object(
        'raw_data_id', NEW.id,
        'orchestration_mode', true
      )::jsonb
    );
    
    RAISE LOG 'HTTP call completed for raw_data_id: %', NEW.id;
  ELSE
    RAISE LOG 'Skipping already processed record: %', NEW.id;
  END IF;
  
  RETURN NEW;
END;
$function$;

-- Update trigger_reward_processing to make HTTP POST to process staged data
CREATE OR REPLACE FUNCTION public.trigger_reward_processing()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $function$
BEGIN
  -- Trigger reward calculation and wallet crediting for new staged data
  PERFORM net.http_post(
    url := 'https://zxyngqciipcvveigrzqt.supabase.co/functions/v1/process-staged-data',
    headers := '{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inp4eW5ncWNpaXBjdnZlaWdyenF0Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1MTMyMjA3NiwiZXhwIjoyMDY2ODk4MDc2fQ.G0Nj4rG9N6N2MKlf9xYyPRXA9WJQx8ZhxqCMM-tpMWY"}'::jsonb,
    body := json_build_object(
      'staged_data_id', NEW.id
    )::jsonb
  );
  
  RETURN NEW;
END;
$function$;

-- Create a function to process backlog of stuck data
CREATE OR REPLACE FUNCTION public.process_stuck_raw_data()
RETURNS TABLE(processed_count integer, error_count integer)
LANGUAGE plpgsql
SECURITY DEFINER
AS $function$
DECLARE
  rec RECORD;
  processed_count integer := 0;
  error_count integer := 0;
BEGIN
  -- Process all unprocessed raw_health_data entries
  FOR rec IN 
    SELECT id FROM public.raw_health_data 
    WHERE processed = FALSE 
    ORDER BY created_at ASC
    LIMIT 50 -- Process in batches
  LOOP
    BEGIN
      -- Mark as processing started
      UPDATE public.raw_health_data 
      SET processing_started_at = NOW() 
      WHERE id = rec.id;
      
      -- Call IDIA-Synapse orchestrator
      PERFORM net.http_post(
        url := 'https://zxyngqciipcvveigrzqt.supabase.co/functions/v1/idia-synapse',
        headers := '{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inp4eW5ncWNpaXBjdnZlaWdyenF0Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1MTMyMjA3NiwiZXhwIjoyMDY2ODk4MDc2fQ.G0Nj4rG9N6N2MKlf9xYyPRXA9WJQx8ZhxqCMM-tpMWY"}'::jsonb,
        body := json_build_object(
          'raw_data_id', rec.id::text,
          'orchestration_mode', true
        )::jsonb
      );
      
      processed_count := processed_count + 1;
      
    EXCEPTION WHEN OTHERS THEN
      error_count := error_count + 1;
      RAISE LOG 'Error processing stuck data item %: %', rec.id, SQLERRM;
    END;
  END LOOP;
  
  RETURN QUERY SELECT processed_count, error_count;
END;
$function$;