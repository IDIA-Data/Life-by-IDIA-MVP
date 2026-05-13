-- Live-only policy enforcement: reject simulated data at the database layer

-- Function to reject simulated data for raw_health_data
CREATE OR REPLACE FUNCTION public.reject_simulated_data()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  payload_text text := COALESCE(NEW.raw_payload::text, '{}');
BEGIN
  -- Explicit simulated flag
  IF (jsonb_typeof(NEW.raw_payload) = 'object' AND (NEW.raw_payload ? 'simulated') AND COALESCE((NEW.raw_payload->>'simulated')::boolean, false)) THEN
    RAISE EXCEPTION 'Simulated data is not allowed';
  END IF;

  -- Heuristic checks on content and metadata
  IF position('"simulated"' in lower(payload_text)) > 0
     OR position('simulator' in lower(COALESCE(NEW.device_type,''))) > 0
     OR position('simulated' in lower(COALESCE(NEW.device_type,''))) > 0
     OR position('simulated' in lower(COALESCE(NEW.activity_type,''))) > 0 THEN
    RAISE EXCEPTION 'Simulated data is not allowed';
  END IF;

  RETURN NEW;
END;
$$;

-- Attach validation and rejection triggers on raw_health_data
DROP TRIGGER IF EXISTS reject_simulated_data_raw ON public.raw_health_data;
CREATE TRIGGER reject_simulated_data_raw
BEFORE INSERT ON public.raw_health_data
FOR EACH ROW
EXECUTE FUNCTION public.reject_simulated_data();

DROP TRIGGER IF EXISTS validate_real_health_raw ON public.raw_health_data;
CREATE TRIGGER validate_real_health_raw
BEFORE INSERT ON public.raw_health_data
FOR EACH ROW
EXECUTE FUNCTION public.validate_real_health_data();

-- Function to reject simulated data for raw_strava_data
CREATE OR REPLACE FUNCTION public.reject_simulated_strava()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  payload_text text := COALESCE(NEW.raw_data::text, '{}');
BEGIN
  IF (jsonb_typeof(NEW.raw_data) = 'object' AND (NEW.raw_data ? 'simulated') AND COALESCE((NEW.raw_data->>'simulated')::boolean, false)) THEN
    RAISE EXCEPTION 'Simulated Strava data is not allowed';
  END IF;

  IF position('"simulated"' in lower(payload_text)) > 0 THEN
    RAISE EXCEPTION 'Simulated Strava data is not allowed';
  END IF;

  RETURN NEW;
END;
$$;

-- Attach trigger on raw_strava_data only if table exists
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables 
    WHERE table_schema = 'public' AND table_name = 'raw_strava_data'
  ) THEN
    DROP TRIGGER IF EXISTS reject_simulated_data_strava ON public.raw_strava_data;
    CREATE TRIGGER reject_simulated_data_strava
    BEFORE INSERT ON public.raw_strava_data
    FOR EACH ROW
    EXECUTE FUNCTION public.reject_simulated_strava();
  END IF;
END $$;