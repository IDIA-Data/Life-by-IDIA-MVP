-- Ensure the trigger is properly attached to raw_health_data table
DROP TRIGGER IF EXISTS trigger_idia_synapse_on_raw_health_data ON public.raw_health_data;

-- Recreate the trigger with proper logging
CREATE TRIGGER trigger_idia_synapse_on_raw_health_data
  AFTER INSERT OR UPDATE ON public.raw_health_data
  FOR EACH ROW
  EXECUTE FUNCTION public.trigger_idia_synapse_orchestration();

-- Also ensure no conflicting triggers exist on staged_data
DROP TRIGGER IF EXISTS process_staged_data_trigger ON public.staged_data;
DROP TRIGGER IF EXISTS on_staged_data_reward_processing ON public.staged_data;

-- Recreate the staged_data trigger properly
CREATE TRIGGER on_staged_data_reward_processing
  AFTER INSERT OR UPDATE ON public.staged_data
  FOR EACH ROW
  EXECUTE FUNCTION public.trigger_reward_processing();