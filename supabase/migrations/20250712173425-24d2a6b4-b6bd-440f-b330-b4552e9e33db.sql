-- Fix Apple Health connection pipeline by removing unreliable trigger HTTP calls
-- and simplifying the processing flow

-- Drop the problematic trigger that's causing HTTP errors
DROP TRIGGER IF EXISTS trigger_idia_synapse_on_raw_health_data ON public.raw_health_data;
DROP FUNCTION IF EXISTS public.trigger_idia_synapse_orchestration() CASCADE;

-- Create a simplified trigger that just marks processing as started
CREATE OR REPLACE FUNCTION public.mark_health_data_for_processing()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $function$
BEGIN
  -- Simply mark the data as ready for processing
  -- The actual processing will be handled by the edge function directly
  IF NEW.processed = FALSE AND NEW.processing_started_at IS NULL THEN
    NEW.processing_started_at = NOW();
  END IF;
  
  RETURN NEW;
END;
$function$;

-- Create a simple trigger that just marks data for processing
CREATE TRIGGER mark_raw_health_data_processing
  BEFORE INSERT OR UPDATE ON public.raw_health_data
  FOR EACH ROW EXECUTE FUNCTION public.mark_health_data_for_processing();

-- Update the reward processing trigger to use correct project URL and remove HTTP calls
-- Instead, we'll handle this processing in the edge functions directly
DROP TRIGGER IF EXISTS on_staged_data_reward_processing ON public.staged_data;
DROP FUNCTION IF EXISTS public.trigger_reward_processing() CASCADE;

-- Create a simple function to mark staged data as ready for reward calculation
CREATE OR REPLACE FUNCTION public.mark_staged_data_for_rewards()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $function$
BEGIN
  -- Mark data as ready for reward processing
  -- The actual processing will be handled by edge functions
  IF NEW.reward_calculated = FALSE THEN
    -- Just mark the timestamp, processing will happen via edge functions
    NEW.processed_at = COALESCE(NEW.processed_at, NOW());
  END IF;
  
  RETURN NEW;
END;
$function$;

-- Create trigger for staged data
CREATE TRIGGER mark_staged_data_for_rewards
  BEFORE INSERT OR UPDATE ON public.staged_data
  FOR EACH ROW EXECUTE FUNCTION public.mark_staged_data_for_rewards();