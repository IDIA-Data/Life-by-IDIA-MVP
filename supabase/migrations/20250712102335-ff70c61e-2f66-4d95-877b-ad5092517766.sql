-- Fix database trigger URL to use correct project ID
-- This migration updates the trigger function to use the correct project URL

-- Drop and recreate the trigger function with the correct URL
DROP FUNCTION IF EXISTS public.trigger_idia_synapse_orchestration() CASCADE;

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
    
    -- Make HTTP call to IDIA-Synapse orchestrator using correct project URL
    PERFORM net.http_post(
      url := 'https://qltkclkghtziwipwxxxm.supabase.co/functions/v1/idia-synapse',
      headers := '{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFsdGtjbGtnaHR6aXdpcHd4eHhtIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTIzMDkzNTgsImV4cCI6MjA2Nzg4NTM1OH0.J3R68H8LkBTyX8qu7WPg37rTOjI1Jt56zX-MHkRt7VU"}'::jsonb,
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

-- Recreate the trigger
DROP TRIGGER IF EXISTS trigger_idia_synapse_on_raw_health_data ON public.raw_health_data;
CREATE TRIGGER trigger_idia_synapse_on_raw_health_data
  AFTER INSERT OR UPDATE ON public.raw_health_data
  FOR EACH ROW EXECUTE FUNCTION public.trigger_idia_synapse_orchestration();