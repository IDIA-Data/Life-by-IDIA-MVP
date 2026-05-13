-- Create triggers to automatically process new data end-to-end
-- This migration is idempotent and only creates triggers when tables exist

DO $$
BEGIN
  -- 1) Raw health data -> IDIA Synapse orchestrator
  IF to_regclass('public.raw_health_data') IS NOT NULL THEN
    IF EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_safe_health_processing') THEN
      EXECUTE 'DROP TRIGGER trg_safe_health_processing ON public.raw_health_data';
    END IF;
    EXECUTE 'CREATE TRIGGER trg_safe_health_processing\n      AFTER INSERT ON public.raw_health_data\n      FOR EACH ROW EXECUTE FUNCTION public.safe_health_processing_trigger()';
  END IF;

  -- 2) Staged data -> reward calculation and wallet crediting via edge function
  IF to_regclass('public.staged_data') IS NOT NULL THEN
    IF EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_safe_reward_processing') THEN
      EXECUTE '';
    ELSE
      EXECUTE 'CREATE TRIGGER trg_safe_reward_processing\n        AFTER INSERT OR UPDATE OF reward_calculated ON public.staged_data\n        FOR EACH ROW EXECUTE FUNCTION public.safe_reward_processing_trigger()';
    END IF;
  END IF;

  -- 3) Device events -> universal data processor
  IF to_regclass('public.device_events') IS NOT NULL THEN
    IF EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_universal_data_processing') THEN
      EXECUTE 'DROP TRIGGER trg_universal_data_processing ON public.device_events';
    END IF;
    EXECUTE 'CREATE TRIGGER trg_universal_data_processing\n      AFTER INSERT ON public.device_events\n      FOR EACH ROW EXECUTE FUNCTION public.trigger_universal_data_processing()';
  END IF;

  -- 4) Bundle generation on staged tables -> HUB
  IF to_regclass('public.staged_health_data') IS NOT NULL THEN
    IF EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_generate_bundles_health') THEN
      EXECUTE 'DROP TRIGGER trg_generate_bundles_health ON public.staged_health_data';
    END IF;
    EXECUTE 'CREATE TRIGGER trg_generate_bundles_health\n      AFTER INSERT ON public.staged_health_data\n      FOR EACH ROW EXECUTE FUNCTION public.trigger_bundle_generation()';
  END IF;

  IF to_regclass('public.staged_lifestyle_data') IS NOT NULL THEN
    IF EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_generate_bundles_lifestyle') THEN
      EXECUTE 'DROP TRIGGER trg_generate_bundles_lifestyle ON public.staged_lifestyle_data';
    END IF;
    EXECUTE 'CREATE TRIGGER trg_generate_bundles_lifestyle\n      AFTER INSERT ON public.staged_lifestyle_data\n      FOR EACH ROW EXECUTE FUNCTION public.trigger_bundle_generation()';
  END IF;

  IF to_regclass('public.staged_business_data') IS NOT NULL THEN
    IF EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_generate_bundles_business') THEN
      EXECUTE 'DROP TRIGGER trg_generate_bundles_business ON public.staged_business_data';
    END IF;
    EXECUTE 'CREATE TRIGGER trg_generate_bundles_business\n      AFTER INSERT ON public.staged_business_data\n      FOR EACH ROW EXECUTE FUNCTION public.trigger_bundle_generation()';
  END IF;
END $$;