
-- 1. Drop conflicting triggers on staged_health_data
DROP TRIGGER IF EXISTS trigger_staged_health_reward ON public.staged_health_data;
DROP TRIGGER IF EXISTS on_staged_health_insert ON public.staged_health_data;
DROP TRIGGER IF EXISTS trigger_staged_health_bundles ON public.staged_health_data;

-- 2. Drop the auto_process trigger on raw_health_data that bypasses the pipeline
-- (safe_health_processing_trigger calling idia-synapse is the correct one)
DROP TRIGGER IF EXISTS trigger_auto_process_health ON public.raw_health_data;

-- Also drop the BEFORE INSERT version if it exists with a different name
DO $$
BEGIN
  -- Check for any BEFORE INSERT triggers that call auto_process_raw_health_data
  IF EXISTS (
    SELECT 1 FROM pg_trigger t
    JOIN pg_proc p ON t.tgfoid = p.oid
    WHERE tgrelid = 'public.raw_health_data'::regclass
    AND p.proname = 'auto_process_raw_health_data'
  ) THEN
    -- Get the trigger name and drop it
    EXECUTE (
      SELECT 'DROP TRIGGER IF EXISTS ' || tgname || ' ON public.raw_health_data;'
      FROM pg_trigger t
      JOIN pg_proc p ON t.tgfoid = p.oid
      WHERE tgrelid = 'public.raw_health_data'::regclass
      AND p.proname = 'auto_process_raw_health_data'
      LIMIT 1
    );
  END IF;
END $$;

-- 3. Drop legacy functions that are no longer needed
DROP FUNCTION IF EXISTS public.calculate_and_credit_staged_reward() CASCADE;
DROP FUNCTION IF EXISTS public.trigger_process_staged_data() CASCADE;

-- 4. Fix check_pipeline_health to use staged_health_data instead of staged_data
CREATE OR REPLACE FUNCTION public.check_pipeline_health()
 RETURNS TABLE(total_raw_data integer, unprocessed_raw_data integer, processing_raw_data integer, processed_raw_data integer, total_staged_data integer, unrewarded_staged_data integer, total_transactions integer)
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
    (SELECT COUNT(*)::integer FROM public.staged_health_data) as total_staged_data,
    (SELECT COUNT(*)::integer FROM public.staged_health_data WHERE reward_calculated = FALSE) as unrewarded_staged_data,
    (SELECT COUNT(*)::integer FROM public.transactions) as total_transactions;
END;
$function$;

-- 5. Ensure the raw_data_id column exists on staged_health_data for reverse-lookup
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'staged_health_data' AND column_name = 'raw_data_id'
  ) THEN
    ALTER TABLE public.staged_health_data ADD COLUMN raw_data_id UUID REFERENCES public.raw_health_data(id);
  END IF;
END $$;
