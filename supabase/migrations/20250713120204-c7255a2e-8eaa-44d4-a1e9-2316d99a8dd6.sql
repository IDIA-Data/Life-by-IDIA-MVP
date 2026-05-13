-- Restore the complete health data orchestration pipeline

-- Ensure pg_net extension is enabled for HTTP calls
CREATE EXTENSION IF NOT EXISTS pg_net;

-- Recreate the trigger function for IDIA-Synapse orchestration
CREATE OR REPLACE FUNCTION public.trigger_idia_synapse_orchestration()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $function$
BEGIN
  -- Enhanced logging for debugging
  RAISE LOG 'IDIA-Synapse Trigger: Processing new raw_health_data record ID: %', NEW.id;
  RAISE LOG 'IDIA-Synapse Trigger: User ID: %, Processed: %, Step Count: %', 
    NEW.user_id, NEW.processed, NEW.step_count;
  
  -- Only trigger if not already processed AND not already processing
  IF NEW.processed = FALSE AND (OLD.processed IS NULL OR OLD.processed = FALSE) 
     AND NEW.processing_started_at IS NULL THEN
    
    RAISE LOG 'IDIA-Synapse Trigger: Calling IDIA-Synapse with raw_data_id: %', NEW.id;
    
    -- Trigger IDIA-Synapse orchestrator with correct payload format
    PERFORM net.http_post(
      url := 'https://zxyngqciipcvveigrzqt.supabase.co/functions/v1/idia-synapse',
      headers := '{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inp4eW5ncWNpaXBjdnZlaWdyenF0Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1MTMyMjA3NiwiZXhwIjoyMDY2ODk4MDc2fQ.G0Nj4rG9N6N2MKlf9xYyPRXA9WJQx8ZhxqCMM-tpMWY"}'::jsonb,
      body := json_build_object(
        'raw_data_id', NEW.id::text,
        'orchestration_mode', true
      )::text
    );
    
    RAISE LOG 'IDIA-Synapse Trigger: HTTP POST sent successfully for raw_data_id: %', NEW.id;
  ELSE
    RAISE LOG 'IDIA-Synapse Trigger: Skipping processing for raw_data_id: % (already processed or processing)', NEW.id;
  END IF;
  
  RETURN NEW;
END;
$function$;

-- Drop existing triggers to avoid conflicts
DROP TRIGGER IF EXISTS trigger_idia_synapse_on_raw_health_data ON public.raw_health_data;
DROP TRIGGER IF EXISTS trigger_health_data_processing ON public.raw_health_data;

-- Create the orchestration trigger on raw_health_data
CREATE TRIGGER trigger_idia_synapse_on_raw_health_data
  AFTER INSERT OR UPDATE ON public.raw_health_data
  FOR EACH ROW
  EXECUTE FUNCTION public.trigger_idia_synapse_orchestration();

-- Ensure reward processing trigger exists and is working
CREATE OR REPLACE FUNCTION public.trigger_reward_processing()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $function$
BEGIN
  -- Only trigger reward processing if reward hasn't been calculated yet
  IF NEW.reward_calculated = FALSE AND (OLD.reward_calculated IS NULL OR OLD.reward_calculated = FALSE) THEN
    RAISE LOG 'Reward Trigger: Calling process-staged-data for staged_data_id: %', NEW.id;
    
    PERFORM net.http_post(
      url := 'https://zxyngqciipcvveigrzqt.supabase.co/functions/v1/process-staged-data',
      headers := '{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inp4eW5ncWNpaXBjdnZlaWdyenF0Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1MTMyMjA3NiwiZXhwIjoyMDY2ODk4MDc2fQ.G0Nj4rG9N6N2MKlf9xYyPRXA9WJQx8ZhxqCMM-tpMWY"}'::jsonb,
      body := json_build_object(
        'staged_data_id', NEW.id
      )::text
    );
  END IF;
  
  RETURN NEW;
END;
$function$;

-- Ensure reward processing trigger exists
DROP TRIGGER IF EXISTS on_staged_data_reward_processing ON public.staged_data;
CREATE TRIGGER on_staged_data_reward_processing
  AFTER INSERT OR UPDATE ON public.staged_data
  FOR EACH ROW
  EXECUTE FUNCTION public.trigger_reward_processing();

-- Create a function to process backlogged data
CREATE OR REPLACE FUNCTION public.process_backlog_data()
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
    WHERE processed = FALSE AND processing_started_at IS NULL
    ORDER BY created_at ASC
    LIMIT 100 -- Process in batches to avoid overwhelming the system
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
        )::text
      );
      
      processed_count := processed_count + 1;
      
    EXCEPTION WHEN OTHERS THEN
      error_count := error_count + 1;
      RAISE LOG 'Error processing backlog item %: %', rec.id, SQLERRM;
    END;
  END LOOP;
  
  RETURN QUERY SELECT processed_count, error_count;
END;
$function$;

-- Create a diagnostic function to check pipeline health
CREATE OR REPLACE FUNCTION public.check_pipeline_health()
RETURNS TABLE(
  total_raw_data integer,
  unprocessed_raw_data integer,
  processing_raw_data integer,
  processed_raw_data integer,
  total_staged_data integer,
  unrewarded_staged_data integer,
  total_transactions integer
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $function$
BEGIN
  RETURN QUERY
  SELECT 
    (SELECT COUNT(*)::integer FROM public.raw_health_data) as total_raw_data,
    (SELECT COUNT(*)::integer FROM public.raw_health_data WHERE processed = FALSE AND processing_started_at IS NULL) as unprocessed_raw_data,
    (SELECT COUNT(*)::integer FROM public.raw_health_data WHERE processed = FALSE AND processing_started_at IS NOT NULL) as processing_raw_data,
    (SELECT COUNT(*)::integer FROM public.raw_health_data WHERE processed = TRUE) as processed_raw_data,
    (SELECT COUNT(*)::integer FROM public.staged_data) as total_staged_data,
    (SELECT COUNT(*)::integer FROM public.staged_data WHERE reward_calculated = FALSE) as unrewarded_staged_data,
    (SELECT COUNT(*)::integer FROM public.transactions) as total_transactions;
END;
$function$;