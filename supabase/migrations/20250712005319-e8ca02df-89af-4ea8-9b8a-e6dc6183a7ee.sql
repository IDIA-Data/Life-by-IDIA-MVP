-- Step 1: Clean up ALL dependent objects first
DROP TRIGGER IF EXISTS on_health_metrics_inserted ON public.health_metrics;
DROP TRIGGER IF EXISTS trigger_process_health_metrics ON public.health_metrics;
DROP TRIGGER IF EXISTS on_staged_data_reward_processing ON public.staged_data;

-- Now drop the function safely
DROP FUNCTION IF EXISTS public.process_health_metrics() CASCADE;

-- Step 2: Create unified raw health data table for clean ingestion
CREATE TABLE IF NOT EXISTS public.raw_health_data (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id),
  device_type TEXT DEFAULT 'Unknown',
  raw_payload JSONB NOT NULL,
  step_count INTEGER,
  recorded_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  processed BOOLEAN DEFAULT FALSE,
  processing_started_at TIMESTAMP WITH TIME ZONE,
  processing_completed_at TIMESTAMP WITH TIME ZONE
);

-- Enable RLS on raw_health_data
ALTER TABLE public.raw_health_data ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for raw_health_data
CREATE POLICY "Users can insert their own raw health data" 
ON public.raw_health_data 
FOR INSERT 
WITH CHECK (auth.uid() = user_id OR user_id IS NULL);

CREATE POLICY "Users can view their own raw health data" 
ON public.raw_health_data 
FOR SELECT 
USING (auth.uid() = user_id);

CREATE POLICY "System can update raw health data" 
ON public.raw_health_data 
FOR UPDATE 
USING (true);

-- Step 3: Create clean orchestration trigger function
CREATE OR REPLACE FUNCTION public.trigger_idia_synapse_orchestration()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $function$
BEGIN
  -- Only trigger if not already processed
  IF NEW.processed = FALSE AND (OLD.processed IS NULL OR OLD.processed = FALSE) THEN
    -- Mark as processing started
    UPDATE public.raw_health_data 
    SET processing_started_at = NOW() 
    WHERE id = NEW.id;
    
    -- Trigger IDIA-Synapse orchestrator
    PERFORM net.http_post(
      url := 'https://zxyngqciipcvveigrzqt.supabase.co/functions/v1/idia-synapse',
      headers := '{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inp4eW5ncWNpaXBjdnZlaWdyenF0Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1MTMyMjA3NiwiZXhwIjoyMDY2ODk4MDc2fQ.G0Nj4rG9N6N2MKlf9xYyPRXA9WJQx8ZhxqCMM-tpMWY"}'::jsonb,
      body := json_build_object(
        'raw_data_id', NEW.id,
        'orchestration_mode', true
      )::text
    );
  END IF;
  
  RETURN NEW;
END;
$function$;

-- Step 4: Create the orchestration trigger on raw_health_data
CREATE TRIGGER trigger_idia_synapse_on_raw_health_data
  AFTER INSERT OR UPDATE ON public.raw_health_data
  FOR EACH ROW EXECUTE FUNCTION public.trigger_idia_synapse_orchestration();

-- Step 5: Keep only the essential reward processing trigger (simplified)
CREATE OR REPLACE FUNCTION public.trigger_reward_processing()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $function$
BEGIN
  -- Only trigger reward processing if reward hasn't been calculated yet
  IF NEW.reward_calculated = FALSE AND (OLD.reward_calculated IS NULL OR OLD.reward_calculated = FALSE) THEN
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

-- Recreate the reward processing trigger (clean version)
CREATE TRIGGER on_staged_data_reward_processing
  AFTER INSERT OR UPDATE ON public.staged_data
  FOR EACH ROW EXECUTE FUNCTION public.trigger_reward_processing();