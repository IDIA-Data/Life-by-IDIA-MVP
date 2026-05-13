-- Restore missing database triggers for health data pipeline

-- Create the trigger for raw_health_data to call IDIA-Synapse orchestration
DROP TRIGGER IF EXISTS trigger_idia_synapse_on_raw_health_data ON public.raw_health_data;
CREATE TRIGGER trigger_idia_synapse_on_raw_health_data
  AFTER INSERT OR UPDATE ON public.raw_health_data
  FOR EACH ROW
  EXECUTE FUNCTION public.trigger_idia_synapse_orchestration();

-- Create the trigger for staged_data to process rewards
DROP TRIGGER IF EXISTS on_staged_data_reward_processing ON public.staged_data;
CREATE TRIGGER on_staged_data_reward_processing
  AFTER INSERT OR UPDATE ON public.staged_data
  FOR EACH ROW
  EXECUTE FUNCTION public.trigger_reward_processing();