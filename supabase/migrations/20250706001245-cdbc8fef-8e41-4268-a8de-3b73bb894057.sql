-- Create trigger to automatically process rewards when staged_data is inserted
-- This ensures users get paid immediately when their data is processed

CREATE OR REPLACE FUNCTION public.trigger_reward_processing()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $function$
BEGIN
  -- Trigger reward calculation and wallet crediting for new staged data
  PERFORM net.http_post(
    url := 'https://zxyngqciipcvveigrzqt.supabase.co/functions/v1/process-staged-data',
    headers := '{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inp4eW5ncWNpaXBjdnZlaWdyenF0Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1MTMyMjA3NiwiZXhwIjoyMDY2ODk4MDc2fQ.G0Nj4rG9N6N2MKlf9xYyPRXA9WJQx8ZhxqCMM-tpMWY"}'::jsonb,
    body := json_build_object(
      'staged_data_id', NEW.id
    )::text
  );
  
  RETURN NEW;
END;
$function$;

-- Create the trigger on staged_data inserts
DROP TRIGGER IF EXISTS on_staged_data_reward_processing ON public.staged_data;
CREATE TRIGGER on_staged_data_reward_processing
  AFTER INSERT ON public.staged_data
  FOR EACH ROW EXECUTE FUNCTION public.trigger_reward_processing();