-- Fix net.http_post function calls to use correct pg_net signature
-- All functions should use positional parameters: (url, body, params, headers, timeout)

-- Fix trigger_idia_synapse_orchestration function
CREATE OR REPLACE FUNCTION public.trigger_idia_synapse_orchestration()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Only trigger if not already processed
  IF NEW.processed = FALSE AND (OLD.processed IS NULL OR OLD.processed = FALSE) THEN
    -- Mark as processing started
    UPDATE public.raw_health_data 
    SET processing_started_at = NOW() 
    WHERE id = NEW.id;
    
    -- Trigger IDIA-Synapse orchestrator using correct net.http_post signature
    PERFORM net.http_post(
      'https://zxyngqciipcvveigrzqt.supabase.co/functions/v1/idia-synapse'::text,
      json_build_object(
        'raw_data_id', NEW.id,
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

-- Fix trigger_reward_processing function
CREATE OR REPLACE FUNCTION public.trigger_reward_processing()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Only trigger reward processing if reward hasn't been calculated yet
  IF NEW.reward_calculated = FALSE AND (OLD.reward_calculated IS NULL OR OLD.reward_calculated = FALSE) THEN
    PERFORM net.http_post(
      'https://zxyngqciipcvveigrzqt.supabase.co/functions/v1/process-staged-data'::text,
      json_build_object(
        'staged_data_id', NEW.id
      )::jsonb,
      '{}'::jsonb,
      '{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inp4eW5ncWNpaXBjdnZlaWdyenF0Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1MTMyMjA3NiwiZXhwIjoyMDY2ODk4MDc2fQ.G0Nj4rG9N6N2MKlf9xYyPRXA9WJQx8ZhxqCMM-tpMWY"}'::jsonb,
      5000
    );
  END IF;
  
  RETURN NEW;
END;
$$;

-- Fix process_backlog_data function
CREATE OR REPLACE FUNCTION public.process_backlog_data()
RETURNS TABLE(processed_count integer, error_count integer)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  rec RECORD;
  processed_count integer := 0;
  error_count integer := 0;
BEGIN
  -- Process all unprocessed raw_health_data entries
  FOR rec IN 
    SELECT id FROM public.raw_health_data 
    WHERE processed = FALSE AND processing_started_at IS NULL
    ORDER BY created_at ASC
    LIMIT 100 -- Process in batches to avoid overwhelming the system
  LOOP
    BEGIN
      -- Mark as processing started
      UPDATE public.raw_health_data 
      SET processing_started_at = NOW() 
      WHERE id = rec.id;
      
      -- Call IDIA-Synapse orchestrator using correct signature
      PERFORM net.http_post(
        'https://zxyngqciipcvveigrzqt.supabase.co/functions/v1/idia-synapse'::text,
        json_build_object(
          'raw_data_id', rec.id::text,
          'orchestration_mode', true
        )::jsonb,
        '{}'::jsonb,
        '{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inp4eW5ncWNpaXBjdnZlaWdyenF0Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1MTMyMjA3NiwiZXhwIjoyMDY2ODk4MDc2fQ.G0Nj4rG9N6N2MKlf9xYyPRXA9WJQx8ZhxqCMM-tpMWY"}'::jsonb,
        5000
      );
      
      processed_count := processed_count + 1;
      
    EXCEPTION WHEN OTHERS THEN
      error_count := error_count + 1;
      RAISE LOG 'Error processing backlog item %: %', rec.id, SQLERRM;
    END;
  END LOOP;
  
  RETURN QUERY SELECT processed_count, error_count;
END;
$$;

-- Fix process_stuck_raw_data function
CREATE OR REPLACE FUNCTION public.process_stuck_raw_data()
RETURNS TABLE(processed_count integer, error_count integer)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  rec RECORD;
  processed_count integer := 0;
  error_count integer := 0;
BEGIN
  -- Process all unprocessed raw_health_data entries
  FOR rec IN 
    SELECT id FROM public.raw_health_data 
    WHERE processed = FALSE 
    ORDER BY created_at ASC
    LIMIT 50 -- Process in batches
  LOOP
    BEGIN
      -- Mark as processing started
      UPDATE public.raw_health_data 
      SET processing_started_at = NOW() 
      WHERE id = rec.id;
      
      -- Call IDIA-Synapse orchestrator using correct signature
      PERFORM net.http_post(
        'https://zxyngqciipcvveigrzqt.supabase.co/functions/v1/idia-synapse'::text,
        json_build_object(
          'raw_data_id', rec.id::text,
          'orchestration_mode', true
        )::jsonb,
        '{}'::jsonb,
        '{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inp4eW5ncWNpaXBjdnZlaWdyenF0Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1MTMyMjA3NiwiZXhwIjoyMDY2ODk4MDc2fQ.G0Nj4rG9N6N2MKlf9xYyPRXA9WJQx8ZhxqCMM-tpMWY"}'::jsonb,
        5000
      );
      
      processed_count := processed_count + 1;
      
    EXCEPTION WHEN OTHERS THEN
      error_count := error_count + 1;
      RAISE LOG 'Error processing stuck data item %: %', rec.id, SQLERRM;
    END;
  END LOOP;
  
  RETURN QUERY SELECT processed_count, error_count;
END;
$$;

-- Fix process_staged_data function (change from anon to service_role key)
CREATE OR REPLACE FUNCTION public.process_staged_data()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  base_reward DECIMAL(10,2) := 0.50; -- Base reward in USDC
  quality_multiplier DECIMAL(3,2) := 1.0;
  uniqueness_bonus DECIMAL(10,2) := 0.0;
  final_reward DECIMAL(10,2);
BEGIN
  -- Calculate quality multiplier based on data completeness
  IF NEW.average_heartrate IS NOT NULL AND NEW.elevation_gain_meters IS NOT NULL THEN
    quality_multiplier := quality_multiplier + 0.3;
  END IF;
  
  IF NEW.weather_conditions IS NOT NULL THEN
    quality_multiplier := quality_multiplier + 0.2;
  END IF;
  
  -- Calculate uniqueness bonus for rare activity types
  IF NEW.activity_type IN ('TrailRun', 'Hike', 'RockClimbing', 'Skiing') THEN
    uniqueness_bonus := 0.25;
  ELSIF NEW.activity_type IN ('Swim', 'Bike', 'CrossCountrySkiing') THEN
    uniqueness_bonus := 0.15;
  END IF;
  
  -- Calculate final reward
  final_reward := (base_reward * quality_multiplier) + uniqueness_bonus;
  
  -- Cap maximum reward per activity
  IF final_reward > 2.00 THEN
    final_reward := 2.00;
  END IF;
  
  -- Update the staged_data record with calculated reward
  UPDATE public.staged_data 
  SET 
    reward_amount = final_reward,
    reward_calculated = true
  WHERE id = NEW.id;
  
  -- Call edge function to credit user wallet using correct signature and service_role key
  PERFORM net.http_post(
    'https://zxyngqciipcvveigrzqt.supabase.co/functions/v1/credit-user-wallet'::text,
    json_build_object(
      'user_id', NEW.user_id,
      'reward_amount', final_reward,
      'staged_data_id', NEW.id
    )::jsonb,
    '{}'::jsonb,
    '{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inp4eW5ncWNpaXBjdnZlaWdyenF0Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1MTMyMjA3NiwiZXhwIjoyMDY2ODk4MDc2fQ.G0Nj4rG9N6N2MKlf9xYyPRXA9WJQx8ZhxqCMM-tpMWY"}'::jsonb,
    5000
  );
  
  RETURN NEW;
END;
$$;