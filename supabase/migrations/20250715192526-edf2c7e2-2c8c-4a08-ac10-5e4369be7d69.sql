-- Fix Health Data Sync Pipeline - Complete Database Restoration

-- Step 1: Clean up conflicting and broken trigger functions
DROP TRIGGER IF EXISTS trigger_idia_synapse_on_raw_health_data ON public.raw_health_data;
DROP TRIGGER IF EXISTS on_staged_data_reward_processing ON public.staged_data;
DROP TRIGGER IF EXISTS mark_raw_health_data_processing ON public.raw_health_data;
DROP TRIGGER IF EXISTS mark_staged_data_for_rewards ON public.staged_data;
DROP TRIGGER IF EXISTS trigger_apple_health_processing_trigger ON public.raw_health_data;

-- Clean up broken functions
DROP FUNCTION IF EXISTS public.mark_health_data_for_processing() CASCADE;
DROP FUNCTION IF EXISTS public.mark_staged_data_for_rewards() CASCADE;
DROP FUNCTION IF EXISTS public.trigger_apple_health_processing() CASCADE;

-- Step 2: Create the missing health_metrics table that's still being referenced
CREATE TABLE IF NOT EXISTS public.health_metrics (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id),
  activity_type TEXT NOT NULL DEFAULT 'Unknown',
  step_count INTEGER,
  heart_rate INTEGER,
  duration_seconds INTEGER,
  distance_meters NUMERIC,
  calories_burned INTEGER,
  recorded_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  device_type TEXT DEFAULT 'Unknown',
  raw_data JSONB
);

-- Enable RLS on health_metrics
ALTER TABLE public.health_metrics ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for health_metrics
CREATE POLICY "Users can view their own health metrics" 
ON public.health_metrics 
FOR SELECT 
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own health metrics" 
ON public.health_metrics 
FOR INSERT 
WITH CHECK (auth.uid() = user_id);

-- Step 3: Create a unified, robust IDIA-Synapse orchestration function
CREATE OR REPLACE FUNCTION public.trigger_unified_health_processing()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $function$
BEGIN
  -- Log trigger execution for debugging
  RAISE LOG 'Health processing trigger fired for raw_health_data: %', NEW.id;
  
  -- Only proceed if not already processed
  IF NEW.processed = FALSE AND (OLD.processed IS NULL OR OLD.processed = FALSE) THEN
    -- Mark as processing started
    UPDATE public.raw_health_data 
    SET processing_started_at = NOW() 
    WHERE id = NEW.id;
    
    RAISE LOG 'Calling IDIA-Synapse for raw_data_id: %', NEW.id;
    
    -- Call IDIA-Synapse orchestrator using proper parameter structure
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
    
    RAISE LOG 'IDIA-Synapse called for raw_data_id: %', NEW.id;
  ELSE
    RAISE LOG 'Skipping already processed record: %', NEW.id;
  END IF;
  
  RETURN NEW;
END;
$function$;

-- Step 4: Create unified reward processing function
CREATE OR REPLACE FUNCTION public.trigger_unified_reward_processing()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $function$
BEGIN
  -- Only trigger reward processing if reward hasn't been calculated yet
  IF NEW.reward_calculated = FALSE AND (OLD.reward_calculated IS NULL OR OLD.reward_calculated = FALSE) THEN
    RAISE LOG 'Triggering reward processing for staged_data_id: %', NEW.id;
    
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
    
    RAISE LOG 'Reward processing triggered for staged_data_id: %', NEW.id;
  END IF;
  
  RETURN NEW;
END;
$function$;

-- Step 5: Create the unified triggers
CREATE TRIGGER trigger_unified_health_processing
  AFTER INSERT OR UPDATE ON public.raw_health_data
  FOR EACH ROW EXECUTE FUNCTION public.trigger_unified_health_processing();

CREATE TRIGGER trigger_unified_reward_processing
  AFTER INSERT OR UPDATE ON public.staged_data
  FOR EACH ROW EXECUTE FUNCTION public.trigger_unified_reward_processing();

-- Step 6: Create data consolidation function for IDIA Hub to access ALL health data
CREATE OR REPLACE FUNCTION public.get_all_user_health_data(p_user_id UUID)
RETURNS TABLE(
  source_table TEXT,
  record_id UUID,
  user_id UUID,
  activity_type TEXT,
  recorded_at TIMESTAMP WITH TIME ZONE,
  processed_at TIMESTAMP WITH TIME ZONE,
  step_count INTEGER,
  heart_rate INTEGER,
  distance_meters NUMERIC,
  duration_seconds INTEGER,
  calories_burned INTEGER,
  device_type TEXT,
  raw_data JSONB,
  reward_amount NUMERIC,
  processing_status TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $function$
BEGIN
  -- Return data from raw_health_data
  RETURN QUERY
  SELECT 
    'raw_health_data'::TEXT as source_table,
    rhd.id as record_id,
    rhd.user_id,
    COALESCE(rhd.raw_payload->>'activityType', rhd.raw_payload->>'type', 'Unknown')::TEXT as activity_type,
    rhd.recorded_at,
    rhd.processing_completed_at as processed_at,
    rhd.step_count,
    (rhd.raw_payload->>'heart_rate')::INTEGER as heart_rate,
    (rhd.raw_payload->>'distance')::NUMERIC as distance_meters,
    (rhd.raw_payload->>'duration')::INTEGER as duration_seconds,
    (rhd.raw_payload->>'calories')::INTEGER as calories_burned,
    rhd.device_type,
    rhd.raw_payload as raw_data,
    NULL::NUMERIC as reward_amount,
    CASE 
      WHEN rhd.processed = TRUE THEN 'completed'
      WHEN rhd.processing_started_at IS NOT NULL THEN 'processing'
      ELSE 'pending'
    END as processing_status
  FROM public.raw_health_data rhd
  WHERE rhd.user_id = p_user_id;

  -- Return data from staged_health_data
  RETURN QUERY
  SELECT 
    'staged_health_data'::TEXT as source_table,
    shd.id as record_id,
    NULL::UUID as user_id, -- staged_health_data uses pseudo_user_id
    shd.activity_type,
    shd.processed_at as recorded_at,
    shd.processed_at,
    shd.steps_count as step_count,
    shd.average_heartrate as heart_rate,
    shd.distance_meters,
    shd.duration_seconds,
    shd.calories_burned,
    shd.device_type,
    json_build_object(
      'data_quality_score', shd.data_quality_score,
      'data_completeness_score', shd.data_completeness_score
    ) as raw_data,
    NULL::NUMERIC as reward_amount,
    'anonymized'::TEXT as processing_status
  FROM public.staged_health_data shd
  WHERE shd.pseudo_user_id = generate_pseudonym(p_user_id::TEXT);

  -- Return data from staged_data with rewards
  RETURN QUERY
  SELECT 
    'staged_data'::TEXT as source_table,
    sd.id as record_id,
    sd.user_id,
    sd.activity_type,
    sd.processed_at as recorded_at,
    sd.processed_at,
    NULL::INTEGER as step_count,
    sd.average_heartrate,
    sd.distance_meters,
    sd.duration_seconds,
    NULL::INTEGER as calories_burned,
    sd.device_type,
    sd.weather_conditions as raw_data,
    sd.reward_amount,
    CASE 
      WHEN sd.reward_calculated = TRUE THEN 'rewarded'
      ELSE 'pending_reward'
    END as processing_status
  FROM public.staged_data sd
  WHERE sd.user_id = p_user_id;

  -- Return data from health_metrics (legacy support)
  RETURN QUERY
  SELECT 
    'health_metrics'::TEXT as source_table,
    hm.id as record_id,
    hm.user_id,
    hm.activity_type,
    hm.recorded_at,
    hm.created_at as processed_at,
    hm.step_count,
    hm.heart_rate,
    hm.distance_meters,
    hm.duration_seconds,
    hm.calories_burned,
    hm.device_type,
    hm.raw_data,
    NULL::NUMERIC as reward_amount,
    'legacy'::TEXT as processing_status
  FROM public.health_metrics hm
  WHERE hm.user_id = p_user_id;

END;
$function$;

-- Step 7: Create recovery function for stuck data processing
CREATE OR REPLACE FUNCTION public.recover_stuck_health_data()
RETURNS TABLE(recovered_count INTEGER, error_count INTEGER)
LANGUAGE plpgsql
SECURITY DEFINER
AS $function$
DECLARE
  rec RECORD;
  recovered_count INTEGER := 0;
  error_count INTEGER := 0;
BEGIN
  -- Find and recover stuck raw_health_data (processing started > 1 hour ago but not completed)
  FOR rec IN 
    SELECT id FROM public.raw_health_data 
    WHERE processed = FALSE 
      AND processing_started_at IS NOT NULL
      AND processing_started_at < NOW() - INTERVAL '1 hour'
    ORDER BY created_at ASC
    LIMIT 50
  LOOP
    BEGIN
      -- Reset processing state and retrigger
      UPDATE public.raw_health_data 
      SET processing_started_at = NULL,
          processing_completed_at = NULL
      WHERE id = rec.id;
      
      -- Trigger processing again
      UPDATE public.raw_health_data 
      SET processing_started_at = NOW()
      WHERE id = rec.id;
      
      recovered_count := recovered_count + 1;
      
    EXCEPTION WHEN OTHERS THEN
      error_count := error_count + 1;
      RAISE LOG 'Error recovering stuck data item %: %', rec.id, SQLERRM;
    END;
  END LOOP;
  
  RETURN QUERY SELECT recovered_count, error_count;
END;
$function$;