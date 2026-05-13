-- Add missing database triggers for automatic data processing

-- 1. Create trigger for raw_health_data to automatically process through IDIA-Synapse
CREATE OR REPLACE TRIGGER trigger_raw_health_data_processing
  AFTER INSERT ON public.raw_health_data
  FOR EACH ROW
  EXECUTE FUNCTION public.safe_health_processing_trigger();

-- 2. Create trigger for device_events to process through universal data processor  
CREATE OR REPLACE TRIGGER trigger_device_events_processing
  AFTER INSERT ON public.device_events
  FOR EACH ROW
  EXECUTE FUNCTION public.trigger_universal_data_processing();

-- 3. Create trigger for staged_data to automatically calculate rewards
CREATE OR REPLACE TRIGGER trigger_staged_data_reward_processing
  AFTER INSERT ON public.staged_data
  FOR EACH ROW
  EXECUTE FUNCTION public.safe_reward_processing_trigger();