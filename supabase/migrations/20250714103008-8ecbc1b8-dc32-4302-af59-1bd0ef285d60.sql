-- DEFINITIVE FIX: Correct HTTP Function Calls in Database Triggers
-- The issue is that triggers are using net.http_post() which doesn't exist
-- The correct function from pg_net extension is net.http_post_queue()

-- Step 1: Fix the IDIA-Synapse orchestration trigger function
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
    
    -- Make HTTP call using correct pg_net function
    PERFORM net.http_post_queue(
      'https://zxyngqciipcvveigrzqt.supabase.co/functions/v1/idia-synapse',
      '{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inp4eW5ncWNpaXBjdnZlaWdyenF0Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1MTMyMjA3NiwiZXhwIjoyMDY2ODk4MDc2fQ.G0Nj4rG9N6N2MKlf9xYyPRXA9WJQx8ZhxqCMM-tpMWY"}',
      json_build_object(
        'raw_data_id', NEW.id,
        'orchestration_mode', true
      )::text
    );
    
    RAISE LOG 'HTTP call queued for raw_data_id: %', NEW.id;
  ELSE
    RAISE LOG 'Skipping already processed record: %', NEW.id;
  END IF;
  
  RETURN NEW;
END;
$function$;

-- Step 2: Fix the reward processing trigger function  
CREATE OR REPLACE FUNCTION public.trigger_reward_processing()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $function$
BEGIN
  -- Only trigger reward processing if reward hasn't been calculated yet
  IF NEW.reward_calculated = FALSE AND (OLD.reward_calculated IS NULL OR OLD.reward_calculated = FALSE) THEN
    RAISE LOG 'Triggering reward processing for staged_data_id: %', NEW.id;
    
    -- Make HTTP call using correct pg_net function
    PERFORM net.http_post_queue(
      'https://zxyngqciipcvveigrzqt.supabase.co/functions/v1/process-staged-data',
      '{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inp4eW5ncWNpaXBjdnZlaWdyenF0Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1MTMyMjA3NiwiZXhwIjoyMDY2ODk4MDc2fQ.G0Nj4rG9N6N2MKlf9xYyPRXA9WJQx8ZhxqCMM-tpMWY"}',
      json_build_object(
        'staged_data_id', NEW.id
      )::text
    );
    
    RAISE LOG 'Reward processing queued for staged_data_id: %', NEW.id;
  END IF;
  
  RETURN NEW;
END;
$function$;