-- Create trigger to automatically process raw health data
CREATE OR REPLACE TRIGGER trigger_auto_process_health_data
  AFTER INSERT ON public.raw_health_data
  FOR EACH ROW
  EXECUTE FUNCTION public.safe_health_processing_trigger();

-- Create trigger to automatically process staged data for rewards
CREATE OR REPLACE TRIGGER trigger_auto_process_staged_rewards
  AFTER INSERT ON public.staged_data
  FOR EACH ROW
  EXECUTE FUNCTION public.safe_reward_processing_trigger();