-- Fix the reward pipeline by updating the health metrics trigger
-- to properly create staged_data entries for reward processing

-- Drop existing trigger if it exists
DROP TRIGGER IF EXISTS on_health_metrics_inserted ON public.health_metrics;

-- Update the function to also create staged_data entries for rewards
CREATE OR REPLACE FUNCTION public.process_health_metrics()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'pg_catalog', 'public'
AS $function$
DECLARE
    staged_health_id UUID;
    pseudo_id TEXT;
BEGIN
  -- Generate pseudonym for the user
  pseudo_id := COALESCE(public.generate_pseudonym(NEW.user_id::text), 'anonymous_' || substring(md5(random()::text), 1, 8));
  
  -- Convert health_metrics to staged_health_data format
  INSERT INTO public.staged_health_data (
    pseudo_user_id,
    activity_type,
    steps_count,
    processed_at,
    created_at,
    data_quality_score,
    workout_intensity,
    device_type,
    anonymized_location_zone,
    raw_data_id
  ) VALUES (
    pseudo_id,
    'Daily Activity',
    NEW.step_count,
    NOW(),
    NEW.created_at,
    CASE 
      WHEN NEW.step_count IS NOT NULL THEN 0.8
      ELSE 0.5
    END,
    CASE 
      WHEN NEW.step_count > 10000 THEN 75
      WHEN NEW.step_count > 5000 THEN 50
      ELSE 25
    END,
    'Health App',
    public.anonymize_location(
      (40.7128 + (random() - 0.5) * 0.1)::numeric, 
      (-74.0060 + (random() - 0.5) * 0.1)::numeric
    ),
    NEW.id::text::uuid
  ) RETURNING id INTO staged_health_id;
  
  -- CRITICAL: Create corresponding entry in staged_data for reward processing
  -- Only if user_id is not null (authenticated users get rewards)
  IF NEW.user_id IS NOT NULL THEN
    INSERT INTO public.staged_data (
      user_id,
      raw_data_id,
      activity_type,
      duration_seconds,
      average_heartrate,
      effort_score,
      device_type,
      processed_at
    ) VALUES (
      NEW.user_id,
      NEW.id::text::uuid,
      'Health Data',
      CASE 
        WHEN NEW.step_count > 10000 THEN 3600 -- 1 hour for high activity
        WHEN NEW.step_count > 5000 THEN 1800  -- 30 min for medium activity
        ELSE 900 -- 15 min for light activity
      END,
      CASE 
        WHEN NEW.step_count > 8000 THEN 75
        WHEN NEW.step_count > 4000 THEN 65
        ELSE 55
      END,
      CASE 
        WHEN NEW.step_count > 10000 THEN 85
        WHEN NEW.step_count > 5000 THEN 65
        ELSE 45
      END,
      'Apple Health',
      NOW()
    );
  END IF;
  
  RETURN NEW;
END;
$function$;

-- Recreate the trigger
CREATE TRIGGER on_health_metrics_inserted
  AFTER INSERT ON public.health_metrics
  FOR EACH ROW EXECUTE FUNCTION public.process_health_metrics();