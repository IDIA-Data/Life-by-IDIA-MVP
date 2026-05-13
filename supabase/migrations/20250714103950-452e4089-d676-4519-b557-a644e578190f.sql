-- TYPE CASTING FIX: Cast json_build_object() to jsonb for net.http_post()
-- The root cause is json vs jsonb type mismatch in the body parameter
-- json_build_object() returns 'json' but net.http_post() expects 'jsonb'

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
    
    -- Make HTTP call using correct pg_net function with 5 parameters
    PERFORM net.http_post(
      url := 'https://zxyngqciipcvveigrzqt.supabase.co/functions/v1/idia-synapse',
      body := json_build_object(
        'raw_data_id', NEW.id,
        'orchestration_mode', true
      )::jsonb,
      params := '{}'::jsonb,
      headers := '{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inp4eW5ncWNpaXBjdnZlaWdyenF0Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1MTMyMjA3NiwiZXhwIjoyMDY2ODk4MDc2fQ.G0Nj4rG9N6N2MKlf9xYyPRXA9WJQx8ZhxqCMM-tpMWY"}'::jsonb,
      timeout_milliseconds := 5000
    );
    
    RAISE LOG 'HTTP call made for raw_data_id: %', NEW.id;
  ELSE
    RAISE LOG 'Skipping already processed record: %', NEW.id;
  END IF;
  
  RETURN NEW;
END;
$function$;

-- Step 2: Add test data insertion to verify trigger fix
INSERT INTO public.raw_health_data (
  user_id,
  device_type,
  raw_payload,
  step_count,
  recorded_at
) VALUES (
  'f47ac10b-58cc-4372-a567-0e02b2c3d479'::uuid,
  'TestDevice',
  '{"test": "type_casting_fix", "timestamp": "2025-01-14T12:00:00Z"}'::jsonb,
  8000,
  NOW()
);

-- Step 3: Fix the reward processing trigger function
CREATE OR REPLACE FUNCTION public.trigger_reward_processing()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $function$
BEGIN
  -- Only trigger reward processing if reward hasn't been calculated yet
  IF NEW.reward_calculated = FALSE AND (OLD.reward_calculated IS NULL OR OLD.reward_calculated = FALSE) THEN
    RAISE LOG 'Triggering reward processing for staged_data_id: %', NEW.id;
    
    -- Make HTTP call using correct pg_net function with 5 parameters
    PERFORM net.http_post(
      url := 'https://zxyngqciipcvveigrzqt.supabase.co/functions/v1/process-staged-data',
      body := json_build_object(
        'staged_data_id', NEW.id
      )::jsonb,
      params := '{}'::jsonb,
      headers := '{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inp4eW5ncWNpaXBjdnZlaWdyenF0Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1MTMyMjA3NiwiZXhwIjoyMDY2ODk4MDc2fQ.G0Nj4rG9N6N2MKlf9xYyPRXA9WJQx8ZhxqCMM-tpMWY"}'::jsonb,
      timeout_milliseconds := 5000
    );
    
    RAISE LOG 'Reward processing triggered for staged_data_id: %', NEW.id;
  END IF;
  
  RETURN NEW;
END;
$function$;