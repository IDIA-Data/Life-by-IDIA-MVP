-- Phase 2: Fix RLS policies on raw_health_data table
-- The current policy requires auth.uid() = user_id, but health-data-bridge uses service role
-- and sometimes inserts with user_id = null for anonymous health data

-- Drop existing restrictive policy
DROP POLICY IF EXISTS "Users can insert their own raw health data" ON public.raw_health_data;

-- Create more permissive policy for system insertions
CREATE POLICY "System can insert raw health data" 
ON public.raw_health_data 
FOR INSERT 
WITH CHECK (true);

-- Keep user access policy for reading
CREATE POLICY "Users can view their own raw health data v2" 
ON public.raw_health_data 
FOR SELECT 
USING (auth.uid() = user_id OR user_id IS NULL);

-- Ensure trigger function has proper logging
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
  
  -- Only trigger if not already processed
  IF NEW.processed = FALSE AND (OLD.processed IS NULL OR OLD.processed = FALSE) THEN
    -- Mark as processing started
    UPDATE public.raw_health_data 
    SET processing_started_at = NOW() 
    WHERE id = NEW.id;
    
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
    RAISE LOG 'IDIA-Synapse Trigger: Skipping processing for raw_data_id: % (already processed)', NEW.id;
  END IF;
  
  RETURN NEW;
END;
$function$;