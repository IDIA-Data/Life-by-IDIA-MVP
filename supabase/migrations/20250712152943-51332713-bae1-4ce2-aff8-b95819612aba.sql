-- Ensure pg_net extension is enabled for HTTP calls
CREATE EXTENSION IF NOT EXISTS pg_net;

-- Recreate the trigger on raw_health_data to ensure it works correctly
DROP TRIGGER IF EXISTS trigger_health_data_processing ON public.raw_health_data;
CREATE TRIGGER trigger_health_data_processing
  AFTER INSERT OR UPDATE ON public.raw_health_data
  FOR EACH ROW EXECUTE FUNCTION public.trigger_idia_synapse_orchestration();