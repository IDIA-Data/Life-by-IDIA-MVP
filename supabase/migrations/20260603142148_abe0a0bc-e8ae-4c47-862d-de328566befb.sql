-- =====================================================================
-- vault_bridge_and_grant_restore.sql
-- Part A: Replace GUC service_role_key with supabase_vault lookup
-- Part B: Restore missing GRANTs on user-facing tables
-- =====================================================================

-- ---------- PART A: VAULT BRIDGE ----------

CREATE EXTENSION IF NOT EXISTS supabase_vault WITH SCHEMA vault;

-- Seed placeholder secret if not present (user replaces value via Vault UI)
DO $seed$
DECLARE v_exists boolean;
BEGIN
  SELECT EXISTS (SELECT 1 FROM vault.secrets WHERE name = 'service_role_key') INTO v_exists;
  IF NOT v_exists THEN
    PERFORM vault.create_secret(
      'PLACEHOLDER_REPLACE_IN_VAULT_UI',
      'service_role_key',
      'Service role key for background trigger HTTP callouts. Replace via Supabase Dashboard -> Project Settings -> Vault.'
    );
  END IF;
END
$seed$;

-- Helper: SECURITY DEFINER resolver. Returns NULL when unconfigured / placeholder.
CREATE OR REPLACE FUNCTION public.get_service_role_key()
RETURNS text
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, vault
AS $fn$
DECLARE v_key text;
BEGIN
  SELECT decrypted_secret INTO v_key
  FROM vault.decrypted_secrets
  WHERE name = 'service_role_key'
  LIMIT 1;

  IF v_key IS NULL OR v_key = '' OR v_key = 'PLACEHOLDER_REPLACE_IN_VAULT_UI' THEN
    RETURN NULL;
  END IF;
  RETURN v_key;
END;
$fn$;

REVOKE ALL ON FUNCTION public.get_service_role_key() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_service_role_key() TO postgres, service_role;

-- ---------- TRIGGER + HELPER REWRITES (18) ----------

CREATE OR REPLACE FUNCTION public.safe_health_processing_trigger()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $fn$
DECLARE v_key text;
BEGIN
  RAISE LOG '[VAULT_BRIDGE][INVOKE][START] safe_health_processing_trigger table=% op=%', TG_TABLE_NAME, TG_OP;
  IF TG_OP = 'INSERT' AND NEW.processing_status = 'pending' THEN
    v_key := public.get_service_role_key();
    IF v_key IS NULL THEN
      RAISE WARNING '🚨 [VAULT_BRIDGE][WARN] service_role_key resolution returned placeholder asset. Background loop throttled until Vault configuration is complete. (safe_health_processing_trigger / %)', TG_TABLE_NAME;
      RETURN NEW;
    END IF;
    PERFORM net.http_post(
      'https://zxyngqciipcvveigrzqt.supabase.co/functions/v1/idia-synapse'::text,
      json_build_object('raw_data_id', NEW.id::text, 'orchestration_mode', true)::jsonb,
      '{}'::jsonb,
      jsonb_build_object('Content-Type','application/json','Authorization','Bearer '||v_key),
      5000
    );
  END IF;
  RETURN NEW;
END;
$fn$;

CREATE OR REPLACE FUNCTION public.trigger_universal_data_processing()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $fn$
DECLARE v_key text;
BEGIN
  RAISE LOG '[VAULT_BRIDGE][INVOKE][START] trigger_universal_data_processing table=% op=%', TG_TABLE_NAME, TG_OP;
  IF NEW.processing_status = 'pending' THEN
    v_key := public.get_service_role_key();
    IF v_key IS NULL THEN
      RAISE WARNING '🚨 [VAULT_BRIDGE][WARN] service_role_key resolution returned placeholder asset. Background loop throttled until Vault configuration is complete. (trigger_universal_data_processing / %)', TG_TABLE_NAME;
      RETURN NEW;
    END IF;
    PERFORM net.http_post(
      'https://zxyngqciipcvveigrzqt.supabase.co/functions/v1/universal-data-processor'::text,
      json_build_object('event_id', NEW.id, 'data_category', NEW.data_category, 'orchestration_mode', true)::jsonb,
      '{}'::jsonb,
      jsonb_build_object('Content-Type','application/json','Authorization','Bearer '||v_key),
      5000
    );
  END IF;
  RETURN NEW;
END;
$fn$;

CREATE OR REPLACE FUNCTION public.invoke_refiner_secure(payload jsonb)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, extensions
AS $fn$
DECLARE v_key text;
BEGIN
  RAISE LOG '[VAULT_BRIDGE][INVOKE][START] invoke_refiner_secure target=anonymization-processor';
  v_key := public.get_service_role_key();
  IF v_key IS NULL THEN
    RAISE WARNING '🚨 [VAULT_BRIDGE][WARN] service_role_key resolution returned placeholder asset. Background loop throttled until Vault configuration is complete. (invoke_refiner_secure)';
    RETURN;
  END IF;
  PERFORM extensions.http_post(
    url := 'https://zxyngqciipcvveigrzqt.supabase.co/functions/v1/anonymization-processor',
    headers := jsonb_build_object('Content-Type','application/json','Authorization','Bearer '||v_key),
    body := payload
  );
END;
$fn$;

CREATE OR REPLACE FUNCTION public.fn_call_synapse_engine()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $fn$
DECLARE v_key text; request_body jsonb;
BEGIN
  RAISE LOG '[VAULT_BRIDGE][INVOKE][START] fn_call_synapse_engine table=% op=%', TG_TABLE_NAME, TG_OP;
  v_key := public.get_service_role_key();
  IF v_key IS NULL THEN
    RAISE WARNING '🚨 [VAULT_BRIDGE][WARN] service_role_key resolution returned placeholder asset. Background loop throttled until Vault configuration is complete. (fn_call_synapse_engine / %)', TG_TABLE_NAME;
    RETURN NEW;
  END IF;
  request_body := jsonb_build_object(
    'type', TG_OP, 'table', TG_TABLE_NAME, 'schema', TG_TABLE_SCHEMA,
    'record', row_to_json(NEW),
    'old_record', CASE WHEN TG_OP IN ('UPDATE','DELETE') THEN row_to_json(OLD) ELSE NULL END
  );
  PERFORM net.http_post(
    url := 'https://zxyngqciipcvveigrzqt.supabase.co/functions/v1/synapse-controller',
    body := request_body,
    headers := jsonb_build_object('Content-Type','application/json','Authorization','Bearer '||v_key)
  );
  RETURN NEW;
END;
$fn$;

CREATE OR REPLACE FUNCTION public.trigger_daily_apple_health_sync()
RETURNS TABLE(request_id bigint)
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $fn$
DECLARE v_key text;
BEGIN
  RAISE LOG '[VAULT_BRIDGE][INVOKE][START] trigger_daily_apple_health_sync target=daily-apple-health-sync';
  v_key := public.get_service_role_key();
  IF v_key IS NULL THEN
    RAISE WARNING '🚨 [VAULT_BRIDGE][WARN] service_role_key resolution returned placeholder asset. Background loop throttled until Vault configuration is complete. (trigger_daily_apple_health_sync)';
    RETURN;
  END IF;
  RETURN QUERY SELECT net.http_post(
    url := 'https://zxyngqciipcvveigrzqt.supabase.co/functions/v1/daily-apple-health-sync'::text,
    headers := jsonb_build_object('Content-Type','application/json','Authorization','Bearer '||v_key),
    body := concat('{"triggered_by": "manual", "sync_time": "', now()::text, '"}')::jsonb
  );
END;
$fn$;

CREATE OR REPLACE FUNCTION public.notify_crazy_friend_sentinel()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $fn$
DECLARE v_key text;
BEGIN
  RAISE LOG '[VAULT_BRIDGE][INVOKE][START] notify_crazy_friend_sentinel table=% op=%', TG_TABLE_NAME, TG_OP;
  v_key := public.get_service_role_key();
  IF v_key IS NULL THEN
    RAISE WARNING '🚨 [VAULT_BRIDGE][WARN] service_role_key resolution returned placeholder asset. Background loop throttled until Vault configuration is complete. (notify_crazy_friend_sentinel / %)', TG_TABLE_NAME;
    RETURN NEW;
  END IF;
  PERFORM net.http_post(
    'https://zxyngqciipcvveigrzqt.supabase.co/functions/v1/Crazy-Friend-AI'::text,
    jsonb_build_object(
      'moduleId','SENTINEL',
      'platformGuid', NEW.pseudo_user_id,
      'targetUserId', NEW.pseudo_user_id,
      'eventMetadata', jsonb_build_object('action', TG_OP, 'table', TG_TABLE_NAME, 'record_id', NEW.id)
    ),
    '{}'::jsonb,
    jsonb_build_object('Content-Type','application/json','Authorization','Bearer '||v_key),
    5000
  );
  RETURN NEW;
END;
$fn$;

CREATE OR REPLACE FUNCTION public.trigger_lifestyle_data_processing()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $fn$
DECLARE v_key text;
BEGIN
  RAISE LOG '[VAULT_BRIDGE][INVOKE][START] trigger_lifestyle_data_processing table=% op=%', TG_TABLE_NAME, TG_OP;
  IF TG_OP = 'INSERT' AND NEW.data_category IN ('lifestyle','social','behavioral','location','user_profile','governance') THEN
    v_key := public.get_service_role_key();
    IF v_key IS NULL THEN
      RAISE WARNING '🚨 [VAULT_BRIDGE][WARN] service_role_key resolution returned placeholder asset. Background loop throttled until Vault configuration is complete. (trigger_lifestyle_data_processing / %)', TG_TABLE_NAME;
      RETURN NEW;
    END IF;
    PERFORM net.http_post(
      'https://zxyngqciipcvveigrzqt.supabase.co/functions/v1/process-lifestyle-data'::text,
      json_build_object('device_event_id', NEW.id::text, 'trigger_source','device_events')::jsonb,
      '{}'::jsonb,
      jsonb_build_object('Content-Type','application/json','Authorization','Bearer '||v_key),
      5000
    );
  END IF;
  RETURN NEW;
END;
$fn$;

CREATE OR REPLACE FUNCTION public.trigger_business_data_processing()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $fn$
DECLARE v_key text;
BEGIN
  RAISE LOG '[VAULT_BRIDGE][INVOKE][START] trigger_business_data_processing table=% op=%', TG_TABLE_NAME, TG_OP;
  v_key := public.get_service_role_key();
  IF v_key IS NULL THEN
    RAISE WARNING '🚨 [VAULT_BRIDGE][WARN] service_role_key resolution returned placeholder asset. Background loop throttled until Vault configuration is complete. (trigger_business_data_processing / %)', TG_TABLE_NAME;
    RETURN NEW;
  END IF;
  PERFORM net.http_post(
    'https://zxyngqciipcvveigrzqt.supabase.co/functions/v1/process-business-data'::text,
    json_build_object('transaction_id', NEW.id::text, 'transaction_type', TG_TABLE_NAME, 'trigger_source', TG_TABLE_NAME)::jsonb,
    '{}'::jsonb,
    jsonb_build_object('Content-Type','application/json','Authorization','Bearer '||v_key),
    5000
  );
  RETURN NEW;
END;
$fn$;

CREATE OR REPLACE FUNCTION public.trigger_staged_health_reward_processing()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $fn$
DECLARE v_key text;
BEGIN
  RAISE LOG '[VAULT_BRIDGE][INVOKE][START] trigger_staged_health_reward_processing table=% op=%', TG_TABLE_NAME, TG_OP;
  IF TG_OP = 'INSERT' AND NEW.reward_calculated = FALSE THEN
    v_key := public.get_service_role_key();
    IF v_key IS NULL THEN
      RAISE WARNING '🚨 [VAULT_BRIDGE][WARN] service_role_key resolution returned placeholder asset. Background loop throttled until Vault configuration is complete. (trigger_staged_health_reward_processing / %)', TG_TABLE_NAME;
      RETURN NEW;
    END IF;
    PERFORM net.http_post(
      'https://zxyngqciipcvveigrzqt.supabase.co/functions/v1/process-staged-data'::text,
      json_build_object('staged_data_id', NEW.id::text)::jsonb,
      '{}'::jsonb,
      jsonb_build_object('Content-Type','application/json','Authorization','Bearer '||v_key),
      5000
    );
  END IF;
  RETURN NEW;
END;
$fn$;

CREATE OR REPLACE FUNCTION public.safe_reward_processing_trigger()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $fn$
DECLARE v_key text;
BEGIN
  RAISE LOG '[VAULT_BRIDGE][INVOKE][START] safe_reward_processing_trigger table=% op=%', TG_TABLE_NAME, TG_OP;
  IF (TG_OP='INSERT' AND NEW.reward_calculated=FALSE)
     OR (TG_OP='UPDATE' AND OLD.reward_calculated=TRUE AND NEW.reward_calculated=FALSE) THEN
    v_key := public.get_service_role_key();
    IF v_key IS NULL THEN
      RAISE WARNING '🚨 [VAULT_BRIDGE][WARN] service_role_key resolution returned placeholder asset. Background loop throttled until Vault configuration is complete. (safe_reward_processing_trigger / %)', TG_TABLE_NAME;
      RETURN NEW;
    END IF;
    PERFORM net.http_post(
      'https://zxyngqciipcvveigrzqt.supabase.co/functions/v1/process-staged-data'::text,
      json_build_object('staged_data_id', NEW.id::text)::jsonb,
      '{}'::jsonb,
      jsonb_build_object('Content-Type','application/json','Authorization','Bearer '||v_key),
      5000
    );
  END IF;
  RETURN NEW;
END;
$fn$;

CREATE OR REPLACE FUNCTION public.trigger_bundle_generation()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $fn$
DECLARE v_key text; auth_header jsonb;
BEGIN
  RAISE LOG '[VAULT_BRIDGE][INVOKE][START] trigger_bundle_generation table=% op=%', TG_TABLE_NAME, TG_OP;
  v_key := public.get_service_role_key();
  IF v_key IS NULL THEN
    RAISE WARNING '🚨 [VAULT_BRIDGE][WARN] service_role_key resolution returned placeholder asset. Background loop throttled until Vault configuration is complete. (trigger_bundle_generation / %)', TG_TABLE_NAME;
    RETURN NEW;
  END IF;
  auth_header := jsonb_build_object('Content-Type','application/json','Authorization','Bearer '||v_key);
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
$fn$;

CREATE OR REPLACE FUNCTION public.settle_system_bonus()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $fn$
DECLARE v_key text;
BEGIN
  RAISE LOG '[VAULT_BRIDGE][INVOKE][START] settle_system_bonus table=% staged_id=%', TG_TABLE_NAME, NEW.id;
  v_key := public.get_service_role_key();
  IF v_key IS NULL THEN
    RAISE WARNING '🚨 [VAULT_BRIDGE][WARN] service_role_key resolution returned placeholder asset. Background loop throttled until Vault configuration is complete. (settle_system_bonus / %)', TG_TABLE_NAME;
    RETURN NEW;
  END IF;
  PERFORM net.http_post(
    url := 'https://zxyngqciipcvveigrzqt.supabase.co/functions/v1/fbo-dissemination',
    headers := jsonb_build_object('Content-Type','application/json','Authorization','Bearer '||v_key),
    body := jsonb_build_object(
      'user_id', NEW.user_id,
      'reward_amount', 0.50,
      'source', 'apple_health_sync',
      'description', 'IDIA Protocol Reward',
      'staged_data_id', NEW.id
    )
  );
  UPDATE public.staged_health_data
    SET reward_calculated = true, processed_at = NOW()
  WHERE id = NEW.id;
  RETURN NEW;
END;
$fn$;

CREATE OR REPLACE FUNCTION public.process_staged_data()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $fn$
DECLARE
  base_reward numeric(10,2) := 0.50;
  quality_multiplier numeric(3,2) := 1.0;
  uniqueness_bonus numeric(10,2) := 0.0;
  final_reward numeric(10,2);
  v_key text;
BEGIN
  RAISE LOG '[VAULT_BRIDGE][INVOKE][START] process_staged_data table=% staged_id=%', TG_TABLE_NAME, NEW.id;
  IF NEW.average_heartrate IS NOT NULL AND NEW.elevation_gain_meters IS NOT NULL THEN
    quality_multiplier := quality_multiplier + 0.3;
  END IF;
  IF NEW.weather_conditions IS NOT NULL THEN
    quality_multiplier := quality_multiplier + 0.2;
  END IF;
  IF NEW.activity_type IN ('TrailRun','Hike','RockClimbing','Skiing') THEN
    uniqueness_bonus := 0.25;
  ELSIF NEW.activity_type IN ('Swim','Bike','CrossCountrySkiing') THEN
    uniqueness_bonus := 0.15;
  END IF;
  final_reward := (base_reward * quality_multiplier) + uniqueness_bonus;
  IF final_reward > 2.00 THEN final_reward := 2.00; END IF;

  UPDATE public.staged_data
    SET reward_amount = final_reward, reward_calculated = true
  WHERE id = NEW.id;

  v_key := public.get_service_role_key();
  IF v_key IS NULL THEN
    RAISE WARNING '🚨 [VAULT_BRIDGE][WARN] service_role_key resolution returned placeholder asset. Background loop throttled until Vault configuration is complete. (process_staged_data / %)', TG_TABLE_NAME;
    RETURN NEW;
  END IF;
  PERFORM net.http_post(
    'https://zxyngqciipcvveigrzqt.supabase.co/functions/v1/credit-user-wallet'::text,
    json_build_object('user_id', NEW.user_id, 'reward_amount', final_reward, 'staged_data_id', NEW.id)::jsonb,
    '{}'::jsonb,
    jsonb_build_object('Content-Type','application/json','Authorization','Bearer '||v_key),
    5000
  );
  RETURN NEW;
END;
$fn$;

CREATE OR REPLACE FUNCTION public.process_stuck_raw_data()
RETURNS TABLE(processed_count integer, error_count integer)
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $fn$
DECLARE
  rec record;
  p_count integer := 0;
  e_count integer := 0;
  v_key text;
BEGIN
  RAISE LOG '[VAULT_BRIDGE][INVOKE][START] process_stuck_raw_data target=anonymization-processor';
  v_key := public.get_service_role_key();
  IF v_key IS NULL THEN
    RAISE WARNING '🚨 [VAULT_BRIDGE][WARN] service_role_key resolution returned placeholder asset. Background loop throttled until Vault configuration is complete. (process_stuck_raw_data)';
    RETURN QUERY SELECT 0, 0;
    RETURN;
  END IF;
  FOR rec IN
    SELECT * FROM public.raw_health_data
    WHERE processed = FALSE
      AND user_id = '217c6224-d839-43b0-98cb-b4d1be267536'
    ORDER BY created_at ASC
    LIMIT 50
  LOOP
    BEGIN
      UPDATE public.raw_health_data SET processing_status = 'processing' WHERE id = rec.id;
      PERFORM net.http_post(
        'https://zxyngqciipcvveigrzqt.supabase.co/functions/v1/anonymization-processor'::text,
        jsonb_build_object(
          'raw_data_id', rec.id::text,
          'user_id', rec.user_id,
          'raw_payload', rec.raw_payload,
          'step_count', rec.step_count,
          'recorded_at', rec.recorded_at
        ),
        '{}'::jsonb,
        jsonb_build_object('Content-Type','application/json','Authorization','Bearer '||v_key),
        5000
      );
      UPDATE public.raw_health_data SET processing_status = 'sent_to_processor' WHERE id = rec.id;
      p_count := p_count + 1;
    EXCEPTION WHEN OTHERS THEN
      e_count := e_count + 1;
      UPDATE public.raw_health_data
        SET processing_status = 'pending', last_error = SQLERRM
      WHERE id = rec.id;
    END;
  END LOOP;
  RETURN QUERY SELECT p_count, e_count;
END;
$fn$;

CREATE OR REPLACE FUNCTION public.fn_trigger_best_friend_ai()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $fn$
DECLARE v_key text;
BEGIN
  RAISE LOG '[VAULT_BRIDGE][INVOKE][START] fn_trigger_best_friend_ai table=% op=%', TG_TABLE_NAME, TG_OP;
  v_key := public.get_service_role_key();
  IF v_key IS NULL THEN
    RAISE WARNING '🚨 [VAULT_BRIDGE][WARN] service_role_key resolution returned placeholder asset. Background loop throttled until Vault configuration is complete. (fn_trigger_best_friend_ai / %)', TG_TABLE_NAME;
    RETURN NEW;
  END IF;
  PERFORM net.http_post(
    url := 'https://zxyngqciipcvveigrzqt.supabase.co/functions/v1/best-friend-ai',
    headers := jsonb_build_object('Content-Type','application/json','Authorization','Bearer '||v_key),
    body := jsonb_build_object(
      'message', 'Analyze library yield and settle protocol royalties.',
      'context', jsonb_build_object('isMarketplaceMode', true, 'userId', NEW.platform_guid)
    )
  );
  RETURN NEW;
END;
$fn$;

CREATE OR REPLACE FUNCTION public.invoke_synapse_engine()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $fn$
DECLARE v_key text;
BEGIN
  RAISE LOG '[VAULT_BRIDGE][INVOKE][START] invoke_synapse_engine table=% op=%', TG_TABLE_NAME, TG_OP;
  IF (NEW.processed = FALSE OR NEW.processed IS NULL) THEN
    v_key := public.get_service_role_key();
    IF v_key IS NULL THEN
      RAISE WARNING '🚨 [VAULT_BRIDGE][WARN] service_role_key resolution returned placeholder asset. Background loop throttled until Vault configuration is complete. (invoke_synapse_engine / %)', TG_TABLE_NAME;
      RETURN NEW;
    END IF;
    INSERT INTO public.synapse_credit_ledger (user_id, entry_type, amount, description)
    VALUES (NEW.user_id, 'USAGE', 1, 'Synapse Engine Activated for: ' || NEW.id);
    PERFORM net.http_post(
      url := 'https://zxyngqciipcvveigrzqt.supabase.co/functions/v1/synapse-controller',
      headers := jsonb_build_object('Content-Type','application/json','Authorization','Bearer '||v_key),
      body := jsonb_build_object('raw_data_id', NEW.id, 'user_id', NEW.user_id, 'mode', 'ORCHESTRATE')
    );
  END IF;
  RETURN NEW;
END;
$fn$;

CREATE OR REPLACE FUNCTION public.maintain_real_time_signals()
RETURNS void LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $fn$
DECLARE
  v_key text;
  api_url text := 'https://zxyngqciipcvveigrzqt.supabase.co';
  request_id uuid;
BEGIN
  RAISE LOG '[VAULT_BRIDGE][INVOKE][START] maintain_real_time_signals target=crazy-8-security';
  v_key := public.get_service_role_key();
  IF v_key IS NULL THEN
    RAISE WARNING '🚨 [VAULT_BRIDGE][WARN] service_role_key resolution returned placeholder asset. Background loop throttled until Vault configuration is complete. (maintain_real_time_signals)';
    RETURN;
  END IF;
  request_id := gen_random_uuid();
  PERFORM net.http_post(
    url := api_url || '/functions/v1/crazy-8-security',
    headers := jsonb_build_object(
      'Content-Type','application/json',
      'Authorization','Bearer '||v_key,
      'X-Request-ID', request_id::text
    ),
    body := jsonb_build_object(
      'agent','crazy_sentinel',
      'action','maintenance_pulse',
      'data', jsonb_build_object('status','active','timestamp', now()),
      'context', jsonb_build_object('node_guid','PRIMARY_HUB_NODE','cycle_id', request_id)
    )
  );
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING '[VAULT_BRIDGE][ERR] maintain_real_time_signals failed: % (%)', SQLERRM, SQLSTATE;
END;
$fn$;

CREATE OR REPLACE FUNCTION public.handle_dao_treasury_ingest_sync()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $fn$
DECLARE v_key text;
BEGIN
  RAISE LOG '[VAULT_BRIDGE][INVOKE][START] handle_dao_treasury_ingest_sync table=% op=%', TG_TABLE_NAME, TG_OP;
  v_key := public.get_service_role_key();
  IF v_key IS NULL THEN
    RAISE WARNING '🚨 [VAULT_BRIDGE][WARN] service_role_key resolution returned placeholder asset. Background loop throttled until Vault configuration is complete. (handle_dao_treasury_ingest_sync / %)', TG_TABLE_NAME;
    RETURN NEW;
  END IF;
  PERFORM net.http_post(
    url := 'https://zxyngqciipcvveigrzqt.supabase.co/functions/v1/dao-treasury-ingest',
    headers := jsonb_build_object('Content-Type','application/json','Authorization','Bearer '||v_key),
    body := jsonb_build_object(
      'flows', jsonb_build_array(
        jsonb_build_object(
          'direction','in',
          'asset','IDIA',
          'amount_usd', NEW.token_amount::numeric,
          'counterparty_label', NEW.recipient_wallet,
          'tx_hash', NEW.id::text
        )
      ),
      'volatile_exposure_pct', 0.00
    ),
    timeout_milliseconds := 5000
  );
  RETURN NEW;
END;
$fn$;

-- ---------- PART B: GRANT RESTORATION ----------

-- Auth-only user-owned tables
GRANT SELECT, INSERT, UPDATE, DELETE ON public.data_sources           TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.friends                TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.trust_circles          TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.user_subscriptions     TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.payment_methods        TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.endorsements           TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.praises                TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.good_deeds             TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.user_votes             TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.connection_ratings     TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.trust_score_history    TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.profiles               TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.wallets                TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.gift_cards             TO authenticated;
GRANT SELECT                          ON public.gift_card_redemptions TO authenticated;
GRANT SELECT                          ON public.gift_card_transactions TO authenticated;

-- pulse_surveys: anon + authenticated read (policy already filters active)
GRANT SELECT ON public.pulse_surveys TO anon, authenticated;

-- service_role on all of the above for edge-function admin operations
GRANT ALL ON public.data_sources, public.friends, public.trust_circles,
            public.user_subscriptions, public.payment_methods, public.endorsements,
            public.praises, public.good_deeds, public.user_votes,
            public.connection_ratings, public.trust_score_history,
            public.profiles, public.wallets, public.gift_cards,
            public.gift_card_redemptions, public.gift_card_transactions,
            public.pulse_surveys
         TO service_role;