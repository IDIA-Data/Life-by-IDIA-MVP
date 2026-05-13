-- Fix the recursive trigger loop in trigger_idia_synapse_orchestration
-- The issue is that the trigger updates the same table it's triggered on, causing infinite recursion

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