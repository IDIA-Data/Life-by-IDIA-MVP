-- CRITICAL FIX: Install Missing Database Triggers
-- This migration ensures the health data pipeline triggers are properly installed

-- Step 1: Clean up any conflicting triggers first
DROP TRIGGER IF EXISTS trigger_health_data_processing ON public.raw_health_data;
DROP TRIGGER IF EXISTS trigger_idia_synapse_on_raw_health_data ON public.raw_health_data;
DROP TRIGGER IF EXISTS on_staged_data_reward_processing ON public.staged_data;

-- Step 2: Ensure trigger functions exist and are correct
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
      )::text
    );
    
    RAISE LOG 'HTTP call completed for raw_data_id: %', NEW.id;
  ELSE
    RAISE LOG 'Skipping already processed record: %', NEW.id;
  END IF;
  
  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.trigger_reward_processing()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $function$
BEGIN
  -- Only trigger reward processing if reward hasn't been calculated yet
  IF NEW.reward_calculated = FALSE AND (OLD.reward_calculated IS NULL OR OLD.reward_calculated = FALSE) THEN
    RAISE LOG 'Triggering reward processing for staged_data_id: %', NEW.id;
    
    PERFORM net.http_post(
      url := 'https://zxyngqciipcvveigrzqt.supabase.co/functions/v1/process-staged-data',
      headers := '{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inp4eW5ncWNpaXBjdnZlaWdyenF0Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1MTMyMjA3NiwiZXhwIjoyMDY2ODk4MDc2fQ.G0Nj4rG9N6N2MKlf9xYyPRXA9WJQx8ZhxqCMM-tpMWY"}'::jsonb,
      body := json_build_object(
        'staged_data_id', NEW.id
      )::text
    );
    
    RAISE LOG 'Reward processing triggered for staged_data_id: %', NEW.id;
  END IF;
  
  RETURN NEW;
END;
$function$;

-- Step 3: Install the primary trigger on raw_health_data
CREATE TRIGGER trigger_idia_synapse_on_raw_health_data
  AFTER INSERT OR UPDATE ON public.raw_health_data
  FOR EACH ROW 
  EXECUTE FUNCTION public.trigger_idia_synapse_orchestration();

-- Step 4: Install the secondary trigger on staged_data
CREATE TRIGGER on_staged_data_reward_processing
  AFTER INSERT OR UPDATE ON public.staged_data
  FOR EACH ROW 
  EXECUTE FUNCTION public.trigger_reward_processing();

-- Step 5: Insert test data to verify the pipeline works end-to-end
INSERT INTO public.raw_health_data (
  user_id,
  device_type,
  raw_payload,
  step_count,
  recorded_at,
  processed
) VALUES (
  NULL,
  'PipelineTest',
  '{"test": "trigger_verification", "timestamp": "2025-01-14T15:00:00Z", "steps": 8500}'::jsonb,
  8500,
  NOW(),
  FALSE
);