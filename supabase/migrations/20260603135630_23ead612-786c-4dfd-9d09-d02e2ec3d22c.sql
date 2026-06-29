-- ============================================================================
-- PART 1: Strip hardcoded service_role_key literals from trigger functions.
-- Replace with current_setting('app.settings.service_role_key', true).
-- The GUC must be set once by the operator via:
--   ALTER DATABASE postgres SET app.settings.service_role_key = '<new key>';
-- (run from the Supabase SQL editor; not included here per migration rules).
-- ============================================================================

CREATE OR REPLACE FUNCTION public.safe_health_processing_trigger()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER AS $function$
BEGIN
  IF TG_OP = 'INSERT' AND NEW.processing_status = 'pending' THEN
    PERFORM net.http_post(
      'https://zxyngqciipcvveigrzqt.supabase.co/functions/v1/idia-synapse'::text,
      json_build_object('raw_data_id', NEW.id::text, 'orchestration_mode', true)::jsonb,
      '{}'::jsonb,
      jsonb_build_object(
        'Content-Type','application/json',
        'Authorization','Bearer '||current_setting('app.settings.service_role_key', true)
      ),
      5000
    );
  END IF;
  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.trigger_universal_data_processing()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER AS $function$
BEGIN
  IF NEW.processing_status = 'pending' THEN
    PERFORM net.http_post(
      'https://zxyngqciipcvveigrzqt.supabase.co/functions/v1/universal-data-processor'::text,
      json_build_object('event_id', NEW.id, 'data_category', NEW.data_category, 'orchestration_mode', true)::jsonb,
      '{}'::jsonb,
      jsonb_build_object(
        'Content-Type','application/json',
        'Authorization','Bearer '||current_setting('app.settings.service_role_key', true)
      ),
      5000
    );
  END IF;
  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.invoke_refiner_secure(payload jsonb)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public','extensions' AS $function$
BEGIN
  PERFORM extensions.http_post(
    url := 'https://zxyngqciipcvveigrzqt.supabase.co/functions/v1/anonymization-processor',
    headers := jsonb_build_object(
      'Content-Type','application/json',
      'Authorization','Bearer '||current_setting('app.settings.service_role_key', true)
    ),
    body := payload
  );
END;
$function$;

CREATE OR REPLACE FUNCTION public.fn_call_synapse_engine()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER AS $function$
DECLARE request_body JSONB;
BEGIN
  request_body := jsonb_build_object(
    'type', TG_OP, 'table', TG_TABLE_NAME, 'schema', TG_TABLE_SCHEMA,
    'record', row_to_json(NEW),
    'old_record', CASE WHEN TG_OP IN ('UPDATE','DELETE') THEN row_to_json(OLD) ELSE NULL END
  );
  PERFORM net.http_post(
    url := 'https://zxyngqciipcvveigrzqt.supabase.co/functions/v1/synapse-controller',
    body := request_body,
    headers := jsonb_build_object(
      'Content-Type','application/json',
      'Authorization','Bearer '||current_setting('app.settings.service_role_key', true)
    )
  );
  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.trigger_daily_apple_health_sync()
RETURNS TABLE(request_id bigint) LANGUAGE sql SECURITY DEFINER AS $function$
  SELECT net.http_post(
    url := 'https://zxyngqciipcvveigrzqt.supabase.co/functions/v1/daily-apple-health-sync'::text,
    headers := jsonb_build_object(
      'Content-Type','application/json',
      'Authorization','Bearer '||current_setting('app.settings.service_role_key', true)
    ),
    body := concat('{"triggered_by": "manual", "sync_time": "', now()::text, '"}')::jsonb
  ) as request_id;
$function$;

CREATE OR REPLACE FUNCTION public.notify_crazy_friend_sentinel()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER AS $function$
BEGIN
  PERFORM net.http_post(
    'https://zxyngqciipcvveigrzqt.supabase.co/functions/v1/Crazy-Friend-AI'::text,
    jsonb_build_object(
      'moduleId','SENTINEL',
      'platformGuid', NEW.pseudo_user_id,
      'targetUserId', NEW.pseudo_user_id,
      'eventMetadata', jsonb_build_object('action', TG_OP, 'table', TG_TABLE_NAME, 'record_id', NEW.id)
    ),
    '{}'::jsonb,
    jsonb_build_object(
      'Content-Type','application/json',
      'Authorization','Bearer '||current_setting('app.settings.service_role_key', true)
    ),
    5000
  );
  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.trigger_lifestyle_data_processing()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER AS $function$
BEGIN
  IF TG_OP = 'INSERT' AND NEW.data_category IN ('lifestyle','social','behavioral','location','user_profile','governance') THEN
    PERFORM net.http_post(
      'https://zxyngqciipcvveigrzqt.supabase.co/functions/v1/process-lifestyle-data'::text,
      json_build_object('device_event_id', NEW.id::text, 'trigger_source','device_events')::jsonb,
      '{}'::jsonb,
      jsonb_build_object(
        'Content-Type','application/json',
        'Authorization','Bearer '||current_setting('app.settings.service_role_key', true)
      ),
      5000
    );
  END IF;
  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.trigger_business_data_processing()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER AS $function$
BEGIN
  PERFORM net.http_post(
    'https://zxyngqciipcvveigrzqt.supabase.co/functions/v1/process-business-data'::text,
    json_build_object('transaction_id', NEW.id::text, 'transaction_type', TG_TABLE_NAME, 'trigger_source', TG_TABLE_NAME)::jsonb,
    '{}'::jsonb,
    jsonb_build_object(
      'Content-Type','application/json',
      'Authorization','Bearer '||current_setting('app.settings.service_role_key', true)
    ),
    5000
  );
  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.trigger_staged_health_reward_processing()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER AS $function$
BEGIN
  IF TG_OP = 'INSERT' AND NEW.reward_calculated = FALSE THEN
    PERFORM net.http_post(
      'https://zxyngqciipcvveigrzqt.supabase.co/functions/v1/process-staged-data'::text,
      json_build_object('staged_data_id', NEW.id::text)::jsonb,
      '{}'::jsonb,
      jsonb_build_object(
        'Content-Type','application/json',
        'Authorization','Bearer '||current_setting('app.settings.service_role_key', true)
      ),
      5000
    );
  END IF;
  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.safe_reward_processing_trigger()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER AS $function$
BEGIN
  IF (TG_OP='INSERT' AND NEW.reward_calculated=FALSE)
     OR (TG_OP='UPDATE' AND OLD.reward_calculated=TRUE AND NEW.reward_calculated=FALSE) THEN
    PERFORM net.http_post(
      'https://zxyngqciipcvveigrzqt.supabase.co/functions/v1/process-staged-data'::text,
      json_build_object('staged_data_id', NEW.id::text)::jsonb,
      '{}'::jsonb,
      jsonb_build_object(
        'Content-Type','application/json',
        'Authorization','Bearer '||current_setting('app.settings.service_role_key', true)
      ),
      5000
    );
  END IF;
  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.trigger_bundle_generation()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER AS $function$
DECLARE auth_header jsonb := jsonb_build_object(
  'Content-Type','application/json',
  'Authorization','Bearer '||current_setting('app.settings.service_role_key', true)
);
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF TG_TABLE_NAME = 'staged_health_data' THEN
      PERFORM net.http_post(
        'https://zxyngqciipcvveigrzqt.supabase.co/functions/v1/create-health-data-bundle'::text,
        json_build_object('trigger_source','staged_health_data','staged_data_id', NEW.id::text)::jsonb,
        '{}'::jsonb, auth_header, 5000);
    ELSIF TG_TABLE_NAME = 'staged_lifestyle_data' THEN
      PERFORM net.http_post(
        'https://zxyngqciipcvveigrzqt.supabase.co/functions/v1/create-lifestyle-bundles'::text,
        json_build_object('trigger_source','staged_lifestyle_data','staged_data_id', NEW.id::text)::jsonb,
        '{}'::jsonb, auth_header, 5000);
    ELSIF TG_TABLE_NAME = 'staged_business_data' THEN
      PERFORM net.http_post(
        'https://zxyngqciipcvveigrzqt.supabase.co/functions/v1/create-business-intelligence-bundles'::text,
        json_build_object('trigger_source','staged_business_data','staged_data_id', NEW.id::text)::jsonb,
        '{}'::jsonb, auth_header, 5000);
    END IF;
  END IF;
  RETURN NEW;
END;
$function$;

-- ============================================================================
-- PART 2: Enable RLS on every public table currently without it.
-- No policies are added — service_role bypasses RLS so triggers/edge functions
-- still work. Any client-facing table that needs anon/authenticated access
-- must get an explicit policy + GRANT in a follow-up migration.
-- ============================================================================

DO $$
DECLARE r record;
BEGIN
  FOR r IN
    SELECT c.relname
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public'
      AND c.relkind = 'r'
      AND NOT c.relrowsecurity
  LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', r.relname);
    EXECUTE format('ALTER TABLE public.%I FORCE ROW LEVEL SECURITY', r.relname);
  END LOOP;
END $$;
