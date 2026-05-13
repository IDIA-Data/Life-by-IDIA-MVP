-- Ensure end-to-end auto-processing via triggers (idempotent)
DO $$
BEGIN
  -- 1) Raw health data -> orchestrator
  IF to_regclass('public.raw_health_data') IS NOT NULL THEN
    IF EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_safe_health_processing' AND tgrelid = 'public.raw_health_data'::regclass) THEN
      EXECUTE 'DROP TRIGGER trg_safe_health_processing ON public.raw_health_data';
    END IF;
    EXECUTE 'CREATE TRIGGER trg_safe_health_processing AFTER INSERT ON public.raw_health_data FOR EACH ROW EXECUTE FUNCTION public.safe_health_processing_trigger()';
  END IF;

  -- 2) Staged data -> rewards & wallet crediting
  IF to_regclass('public.staged_data') IS NOT NULL THEN
    IF EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_safe_reward_processing' AND tgrelid = 'public.staged_data'::regclass) THEN
      EXECUTE 'DROP TRIGGER trg_safe_reward_processing ON public.staged_data';
    END IF;
    EXECUTE 'CREATE TRIGGER trg_safe_reward_processing AFTER INSERT OR UPDATE OF reward_calculated ON public.staged_data FOR EACH ROW EXECUTE FUNCTION public.safe_reward_processing_trigger()';
  END IF;

  -- 3) Device events -> universal data processor
  IF to_regclass('public.device_events') IS NOT NULL THEN
    IF EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_universal_data_processing' AND tgrelid = 'public.device_events'::regclass) THEN
      EXECUTE 'DROP TRIGGER trg_universal_data_processing ON public.device_events';
    END IF;
    EXECUTE 'CREATE TRIGGER trg_universal_data_processing AFTER INSERT ON public.device_events FOR EACH ROW EXECUTE FUNCTION public.trigger_universal_data_processing()';
  END IF;

  -- 4) Bundle generation triggers -> HUB
  IF to_regclass('public.staged_health_data') IS NOT NULL THEN
    IF EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_generate_bundles_health' AND tgrelid = 'public.staged_health_data'::regclass) THEN
      EXECUTE 'DROP TRIGGER trg_generate_bundles_health ON public.staged_health_data';
    END IF;
    EXECUTE 'CREATE TRIGGER trg_generate_bundles_health AFTER INSERT ON public.staged_health_data FOR EACH ROW EXECUTE FUNCTION public.trigger_bundle_generation()';
  END IF;

  IF to_regclass('public.staged_lifestyle_data') IS NOT NULL THEN
    IF EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_generate_bundles_lifestyle' AND tgrelid = 'public.staged_lifestyle_data'::regclass) THEN
      EXECUTE 'DROP TRIGGER trg_generate_bundles_lifestyle ON public.staged_lifestyle_data';
    END IF;
    EXECUTE 'CREATE TRIGGER trg_generate_bundles_lifestyle AFTER INSERT ON public.staged_lifestyle_data FOR EACH ROW EXECUTE FUNCTION public.trigger_bundle_generation()';
  END IF;

  IF to_regclass('public.staged_business_data') IS NOT NULL THEN
    IF EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_generate_bundles_business' AND tgrelid = 'public.staged_business_data'::regclass) THEN
      EXECUTE 'DROP TRIGGER trg_generate_bundles_business ON public.staged_business_data';
    END IF;
    EXECUTE 'CREATE TRIGGER trg_generate_bundles_business AFTER INSERT ON public.staged_business_data FOR EACH ROW EXECUTE FUNCTION public.trigger_bundle_generation()';
  END IF;
END $$;