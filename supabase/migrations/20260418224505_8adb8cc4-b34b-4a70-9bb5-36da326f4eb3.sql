-- 1. BEFORE INSERT: auto-stamp source_id and created_at if missing
CREATE OR REPLACE FUNCTION public.stamp_aca_source_defaults()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.source_id IS NULL OR NEW.source_id = '' OR NEW.source_id = 'unknown' THEN
    NEW.source_id := COALESCE(NULLIF(NEW.consent_type, ''), 'sovereign_onboarding');
  END IF;

  IF NEW.created_at IS NULL THEN
    NEW.created_at := now();
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_stamp_aca_source_defaults ON public.user_aca_records;
CREATE TRIGGER trg_stamp_aca_source_defaults
  BEFORE INSERT ON public.user_aca_records
  FOR EACH ROW
  EXECUTE FUNCTION public.stamp_aca_source_defaults();

-- 2. AFTER INSERT: propagate hash into data_lineage_index
DROP TRIGGER IF EXISTS trg_register_aca_in_library ON public.user_aca_records;
CREATE TRIGGER trg_register_aca_in_library
  AFTER INSERT ON public.user_aca_records
  FOR EACH ROW
  EXECUTE FUNCTION public.register_aca_in_library();