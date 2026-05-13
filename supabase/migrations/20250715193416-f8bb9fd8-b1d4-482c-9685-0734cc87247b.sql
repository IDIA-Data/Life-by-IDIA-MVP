-- CRITICAL FIX: Stop infinite trigger loop causing stack depth crashes
-- Emergency fix for health data sync pipeline

-- Step 1: IMMEDIATELY drop all problematic triggers to stop crashes
DROP TRIGGER IF EXISTS trigger_unified_health_processing ON public.raw_health_data;
DROP TRIGGER IF EXISTS trigger_idia_synapse_on_raw_health_data ON public.raw_health_data;
DROP TRIGGER IF EXISTS trigger_unified_reward_processing ON public.staged_data;
DROP TRIGGER IF EXISTS on_staged_data_reward_processing ON public.staged_data;

-- Drop problematic functions
DROP FUNCTION IF EXISTS public.trigger_unified_health_processing() CASCADE;
DROP FUNCTION IF EXISTS public.trigger_idia_synapse_orchestration() CASCADE;
DROP FUNCTION IF EXISTS public.trigger_unified_reward_processing() CASCADE;
DROP FUNCTION IF EXISTS public.trigger_reward_processing() CASCADE;

-- Step 2: Add processing status tracking to prevent recursion
ALTER TABLE public.raw_health_data 
ADD COLUMN IF NOT EXISTS processing_status TEXT DEFAULT 'pending',
ADD COLUMN IF NOT EXISTS retry_count INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS last_error TEXT,
ADD COLUMN IF NOT EXISTS next_retry_at TIMESTAMP WITH TIME ZONE;

-- Step 3: Create safe, non-recursive trigger for health data processing
CREATE OR REPLACE FUNCTION public.safe_health_processing_trigger()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $function$
BEGIN
  -- CRITICAL: Only trigger on INSERT, never on UPDATE to prevent recursion
  -- Only process if status is 'pending' and not already being processed
  IF TG_OP = 'INSERT' AND NEW.processing_status = 'pending' THEN
    -- Log the trigger execution
    RAISE LOG 'Safe health processing trigger: Processing new record %', NEW.id;
    
    -- Call IDIA-Synapse using background processing (no table updates in trigger)
    PERFORM net.http_post(
      'https://zxyngqciipcvveigrzqt.supabase.co/functions/v1/idia-synapse'::text,
      json_build_object(
        'raw_data_id', NEW.id::text,
        'orchestration_mode', true
      )::jsonb,
      '{}'::jsonb,
      '{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inp4eW5ncWNpaXBjdnZlaWdyenF0Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1MTMyMjA3NiwiZXhwIjoyMDY2ODk4MDc2fQ.G0Nj4rG9N6N2MKlf9xYyPRXA9WJQx8ZhxqCMM-tpMWY"}'::jsonb,
      5000
    );
    
    RAISE LOG 'Safe health processing trigger: Called IDIA-Synapse for %', NEW.id;
  END IF;
  
  RETURN NEW;
END;
$function$;

-- Step 4: Create safe trigger ONLY on INSERT to prevent recursion loops
CREATE TRIGGER safe_health_processing_trigger
  AFTER INSERT ON public.raw_health_data
  FOR EACH ROW 
  EXECUTE FUNCTION public.safe_health_processing_trigger();

-- Step 5: Create safe reward processing trigger
CREATE OR REPLACE FUNCTION public.safe_reward_processing_trigger()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $function$
BEGIN
  -- Only trigger on INSERT or when reward_calculated changes to FALSE
  IF (TG_OP = 'INSERT' AND NEW.reward_calculated = FALSE) OR 
     (TG_OP = 'UPDATE' AND OLD.reward_calculated = TRUE AND NEW.reward_calculated = FALSE) THEN
    
    RAISE LOG 'Safe reward processing trigger: Processing staged_data %', NEW.id;
    
    -- Call process-staged-data function
    PERFORM net.http_post(
      'https://zxyngqciipcvveigrzqt.supabase.co/functions/v1/process-staged-data'::text,
      json_build_object(
        'staged_data_id', NEW.id::text
      )::jsonb,
      '{}'::jsonb,
      '{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inp4eW5ncWNpaXBjdnZlaWdyenF0Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1MTMyMjA3NiwiZXhwIjoyMDY2ODk4MDc2fQ.G0Nj4rG9N6N2MKlf9xYyPRXA9WJQx8ZhxqCMM-tpMWY"}'::jsonb,
      5000
    );
    
    RAISE LOG 'Safe reward processing trigger: Called process-staged-data for %', NEW.id;
  END IF;
  
  RETURN NEW;
END;
$function$;

-- Create safe reward trigger
CREATE TRIGGER safe_reward_processing_trigger
  AFTER INSERT OR UPDATE ON public.staged_data
  FOR EACH ROW 
  EXECUTE FUNCTION public.safe_reward_processing_trigger();

-- Step 6: Create status update function for edge functions to use (prevents recursion)
CREATE OR REPLACE FUNCTION public.update_raw_health_data_status(
  p_record_id UUID,
  p_status TEXT,
  p_error_message TEXT DEFAULT NULL
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $function$
BEGIN
  UPDATE public.raw_health_data 
  SET 
    processing_status = p_status,
    processing_started_at = CASE WHEN p_status = 'processing' THEN NOW() ELSE processing_started_at END,
    processing_completed_at = CASE WHEN p_status = 'completed' THEN NOW() ELSE NULL END,
    processed = CASE WHEN p_status = 'completed' THEN TRUE ELSE processed END,
    last_error = p_error_message,
    retry_count = CASE WHEN p_status = 'failed' THEN retry_count + 1 ELSE retry_count END,
    next_retry_at = CASE 
      WHEN p_status = 'failed' THEN NOW() + (retry_count + 1) * INTERVAL '5 minutes'
      ELSE NULL 
    END
  WHERE id = p_record_id;
END;
$function$;

-- Step 7: Recovery function to fix stuck records
CREATE OR REPLACE FUNCTION public.recover_all_stuck_health_data()
RETURNS TABLE(recovered_count INTEGER, failed_count INTEGER)
LANGUAGE plpgsql
SECURITY DEFINER
AS $function$
DECLARE
  rec RECORD;
  recovered_count INTEGER := 0;
  failed_count INTEGER := 0;
BEGIN
  -- Reset all stuck records to pending for reprocessing
  UPDATE public.raw_health_data 
  SET 
    processing_status = 'pending',
    processing_started_at = NULL,
    processing_completed_at = NULL,
    processed = FALSE,
    retry_count = 0,
    last_error = NULL,
    next_retry_at = NULL
  WHERE processing_status IN ('processing', 'failed') 
    OR (processed = FALSE AND processing_started_at IS NOT NULL);
  
  GET DIAGNOSTICS recovered_count = ROW_COUNT;
  
  RAISE LOG 'Reset % stuck records to pending status', recovered_count;
  
  RETURN QUERY SELECT recovered_count, failed_count;
END;
$function$;

  -- Get counts for each status
  SELECT COUNT(*) INTO total_count FROM public.raw_health_data;
  SELECT COUNT(*) INTO pending_count FROM public.raw_health_data WHERE processing_status = 'pending';
  SELECT COUNT(*) INTO processing_count FROM public.raw_health_data WHERE processing_status = 'processing';
  SELECT COUNT(*) INTO completed_count FROM public.raw_health_data WHERE processing_status = 'completed';
  SELECT COUNT(*) INTO failed_count FROM public.raw_health_data WHERE processing_status = 'failed';
  
  -- Find stuck records (processing for more than 10 minutes)
  SELECT COUNT(*) INTO stuck_count 
  FROM public.raw_health_data 
  WHERE processing_status = 'processing' 
    AND processing_started_at < NOW() - INTERVAL '10 minutes';
  
  -- Calculate health score (0-1)
  IF total_count > 0 THEN
    health_score := (completed_count::NUMERIC / total_count::NUMERIC) * 
                   (1 - (failed_count::NUMERIC + stuck_count::NUMERIC) / total_count::NUMERIC);
  ELSE
    health_score := 1.0;
  END IF;
  
  RETURN QUERY SELECT 
    total_count,
    pending_count,
    processing_count,
    completed_count,
    failed_count,
    stuck_count,
    health_score;
END;
$function$;

-- Step 9: Immediately recover all stuck data
SELECT public.recover_all_stuck_health_data();