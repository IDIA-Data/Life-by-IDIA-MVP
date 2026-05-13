
-- Function to reverse-lookup user_id from pseudo_user_id
CREATE OR REPLACE FUNCTION public.get_user_id_from_pseudonym(p_pseudo_id text)
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT user_id
  FROM public.profiles
  WHERE generate_pseudonym(user_id::text) = p_pseudo_id
  LIMIT 1;
$$;

-- Trigger function for staged_health_data reward processing
CREATE OR REPLACE FUNCTION public.trigger_staged_health_reward_processing()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  IF TG_OP = 'INSERT' AND NEW.reward_calculated = FALSE THEN
    PERFORM net.http_post(
      'https://zxyngqciipcvveigrzqt.supabase.co/functions/v1/process-staged-data'::text,
      json_build_object(
        'staged_data_id', NEW.id::text
      )::jsonb,
      '{}'::jsonb,
      '{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inp4eW5ncWNpaXBjdnZlaWdyenF0Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1MTMyMjA3NiwiZXhwIjoyMDY2ODk4MDc2fQ.G0Nj4rG9N6N2MKlf9xYyPRXA9WJQx8ZhxqCMM-tpMWY"}'::jsonb,
      5000
    );
  END IF;
  RETURN NEW;
END;
$$;

-- Create trigger on staged_health_data (drop if exists first)
DROP TRIGGER IF EXISTS safe_reward_on_staged_health ON public.staged_health_data;
CREATE TRIGGER safe_reward_on_staged_health
  AFTER INSERT ON public.staged_health_data
  FOR EACH ROW
  EXECUTE FUNCTION public.trigger_staged_health_reward_processing();
