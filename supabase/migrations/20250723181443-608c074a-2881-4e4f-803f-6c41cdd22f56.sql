-- Create trigger to auto-process device events
CREATE OR REPLACE FUNCTION public.trigger_universal_data_processing()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Only trigger for new events that aren't processed yet
  IF NEW.processing_status = 'pending' THEN
    -- Call universal data processor
    PERFORM net.http_post(
      'https://zxyngqciipcvveigrzqt.supabase.co/functions/v1/universal-data-processor'::text,
      json_build_object(
        'event_id', NEW.id,
        'data_category', NEW.data_category,
        'orchestration_mode', true
      )::jsonb,
      '{}'::jsonb,
      '{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inp4eW5ncWNpaXBjdnZlaWdyenF0Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1MTMyMjA3NiwiZXhwIjoyMDY2ODk4MDc2fQ.G0Nj4rG9N6N2MKlf9xYyPRXA9WJQx8ZhxqCMM-tpMWY"}'::jsonb,
      5000
    );
  END IF;
  
  RETURN NEW;
END;
$$;

-- Create trigger for universal data processing
DROP TRIGGER IF EXISTS trigger_universal_data_processing ON public.device_events;
CREATE TRIGGER trigger_universal_data_processing
AFTER INSERT ON public.device_events
FOR EACH ROW
EXECUTE FUNCTION public.trigger_universal_data_processing();