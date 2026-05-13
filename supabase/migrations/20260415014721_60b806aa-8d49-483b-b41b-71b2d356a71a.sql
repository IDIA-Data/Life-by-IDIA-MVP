CREATE OR REPLACE FUNCTION public.validate_real_health_data()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_step_count numeric;
  v_heart_rate numeric;
BEGIN
  IF NEW.user_id IS NULL THEN
    RAISE EXCEPTION 'Invalid health data: missing user_id';
  END IF;

  -- Extract values safely from raw_payload JSONB
  v_step_count := (NEW.raw_payload->>'value')::numeric;
  v_heart_rate := (NEW.raw_payload->>'heart_rate')::numeric;

  -- Only validate if the values are present
  IF v_step_count IS NOT NULL AND (v_step_count > 50000 OR v_step_count < 0) THEN
    RAISE EXCEPTION 'Invalid health data: unrealistic step count';
  END IF;

  IF v_heart_rate IS NOT NULL AND (v_heart_rate > 220 OR v_heart_rate < 30) THEN
    RAISE EXCEPTION 'Invalid health data: unrealistic heart rate';
  END IF;

  RETURN NEW;
END;
$$;