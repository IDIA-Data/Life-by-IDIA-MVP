
-- PART 0: mask_owner(text)
CREATE OR REPLACE FUNCTION public.mask_owner(_id text)
RETURNS text
LANGUAGE sql
IMMUTABLE
SECURITY INVOKER
SET search_path = public
AS $$
  SELECT CASE WHEN _id IS NULL THEN NULL
              ELSE encode(sha256((_id || 'IDIA_VIEW_SALT_V1')::bytea), 'hex')
         END;
$$;
REVOKE ALL ON FUNCTION public.mask_owner(text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.mask_owner(text) FROM anon;
GRANT EXECUTE ON FUNCTION public.mask_owner(text) TO authenticated, service_role;

-- PART 1: Kill anon ({public}) policies
DROP POLICY IF EXISTS "Service role can update payments" ON public.usdc_payments;
CREATE POLICY "service_role updates usdc_payments" ON public.usdc_payments FOR UPDATE TO service_role USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Service role can insert fiat ledger entries" ON public.fiat_ledger;
CREATE POLICY "service_role inserts fiat_ledger" ON public.fiat_ledger FOR INSERT TO service_role WITH CHECK (true);

DROP POLICY IF EXISTS "System can manage staged app data" ON public.raw_app_data;
CREATE POLICY "service_role manages raw_app_data" ON public.raw_app_data FOR ALL TO service_role USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "System can manage social health metrics" ON public.social_health_metrics;
DROP POLICY IF EXISTS "Users can view their own social health metrics" ON public.social_health_metrics;
CREATE POLICY "service_role manages social_health_metrics" ON public.social_health_metrics FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "Users view own social_health_metrics" ON public.social_health_metrics FOR SELECT TO authenticated USING (user_id = auth.uid());

DROP POLICY IF EXISTS "Allow all operations for service role on business processing qu" ON public.business_processing_queue;
DROP POLICY IF EXISTS "Allow authenticated read access to business processing queues" ON public.business_processing_queue;
CREATE POLICY "service_role manages business_processing_queue" ON public.business_processing_queue FOR ALL TO service_role USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Allow all operations for service role on lifestyle processing q" ON public.lifestyle_processing_queue;
DROP POLICY IF EXISTS "Allow authenticated read access to processing queues" ON public.lifestyle_processing_queue;
CREATE POLICY "service_role manages lifestyle_processing_queue" ON public.lifestyle_processing_queue FOR ALL TO service_role USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Allow service role to manage sync logs" ON public.sync_logs;
DROP POLICY IF EXISTS "Allow authenticated read access to sync logs" ON public.sync_logs;
CREATE POLICY "service_role manages sync_logs" ON public.sync_logs FOR ALL TO service_role USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Service role can insert proposals" ON public.governance_proposals;
DROP POLICY IF EXISTS "Service role can update proposals" ON public.governance_proposals;
DROP POLICY IF EXISTS "Anyone can read proposals" ON public.governance_proposals;
CREATE POLICY "service_role inserts governance_proposals" ON public.governance_proposals FOR INSERT TO service_role WITH CHECK (true);
CREATE POLICY "service_role updates governance_proposals" ON public.governance_proposals FOR UPDATE TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "Authenticated read governance_proposals" ON public.governance_proposals FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Service role can update indexer state" ON public.governance_indexer_state;
DROP POLICY IF EXISTS "Service role can read indexer state" ON public.governance_indexer_state;
CREATE POLICY "service_role manages governance_indexer_state" ON public.governance_indexer_state FOR ALL TO service_role USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Service roles can update spatial telemetry" ON public.processed_operator_telemetry;
DROP POLICY IF EXISTS "Operators can read their own spatial telemetry" ON public.processed_operator_telemetry;
CREATE POLICY "service_role manages processed_operator_telemetry" ON public.processed_operator_telemetry FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "Operators read own processed_operator_telemetry" ON public.processed_operator_telemetry FOR SELECT TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Allow all operations for service role on cross-platform insight" ON public.cross_platform_insights;
DROP POLICY IF EXISTS "Allow authenticated read access to cross-platform insights" ON public.cross_platform_insights;
CREATE POLICY "service_role manages cross_platform_insights" ON public.cross_platform_insights FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "Authenticated read cross_platform_insights" ON public.cross_platform_insights FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Production staff can view queue" ON public.production_queue;
CREATE POLICY "Authenticated read production_queue" ON public.production_queue FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Allow all operations for service role on staged business data" ON public.staged_business_data;
DROP POLICY IF EXISTS "Allow authenticated read access to staged business data" ON public.staged_business_data;
CREATE POLICY "service_role manages staged_business_data" ON public.staged_business_data FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "Authenticated read staged_business_data" ON public.staged_business_data FOR SELECT TO authenticated USING (true);

-- PART 2: Financial / sensitive lockdown
DROP POLICY IF EXISTS "MVP_Client_Sync_Policy" ON public.wallets;
DROP POLICY IF EXISTS "Users can update their own wallet" ON public.wallets;
DROP POLICY IF EXISTS "Users can insert their own ledger entries" ON public.synapse_credit_ledger;

DROP POLICY IF EXISTS "Authenticated users can delete blueprints" ON public.device_provisioning_blueprints;
DROP POLICY IF EXISTS "Authenticated users can insert blueprints" ON public.device_provisioning_blueprints;
DROP POLICY IF EXISTS "Authenticated users can update blueprints" ON public.device_provisioning_blueprints;
DROP POLICY IF EXISTS "Authenticated users can view blueprints" ON public.device_provisioning_blueprints;
CREATE POLICY "Csuite view blueprints" ON public.device_provisioning_blueprints FOR SELECT TO authenticated USING (public.is_csuite(auth.uid()));
CREATE POLICY "Csuite insert blueprints" ON public.device_provisioning_blueprints FOR INSERT TO authenticated WITH CHECK (public.is_csuite(auth.uid()));
CREATE POLICY "Csuite update blueprints" ON public.device_provisioning_blueprints FOR UPDATE TO authenticated USING (public.is_csuite(auth.uid())) WITH CHECK (public.is_csuite(auth.uid()));
CREATE POLICY "Csuite delete blueprints" ON public.device_provisioning_blueprints FOR DELETE TO authenticated USING (public.is_csuite(auth.uid()));

DROP POLICY IF EXISTS "Allow authenticated read access on api_metrics" ON public.api_metrics;
CREATE POLICY "Authenticated read api_metrics" ON public.api_metrics FOR SELECT TO authenticated USING (true);
CREATE POLICY "service_role manages api_metrics" ON public.api_metrics FOR ALL TO service_role USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Allow authenticated read-only access" ON public.system_configs;
CREATE POLICY "service_role manages system_configs" ON public.system_configs FOR ALL TO service_role USING (true) WITH CHECK (true);

-- PART 3: ACA-tagged masked views (cast uuid -> text)
CREATE OR REPLACE VIEW public.committee_applications_public WITH (security_invoker = true) AS
SELECT id, public.mask_owner(user_id::text) AS masked_owner, committee_id, statement_of_competence,
       aca_hash_key, aca_payload, status, created_at, sponsor_count, risk_score, risk_flags
FROM public.committee_applications;

CREATE OR REPLACE VIEW public.dao_proposals_public WITH (security_invoker = true) AS
SELECT id, public.mask_owner(proposer_id::text) AS masked_proposer, public.mask_owner(author_id::text) AS masked_author,
       title, description, status, vote_type, quorum_threshold, end_date, created_at,
       voting_modality, lifecycle_phase, on_chain_id, tx_hash, on_chain_block, committee_id,
       aca_hash_key, aca_payload, escalated_at, public.mask_owner(escalated_by::text) AS masked_escalated_by,
       committee_quorum_required, proposal_targets, proposal_values, proposal_calldatas
FROM public.dao_proposals;

CREATE OR REPLACE VIEW public.dao_vetoes_public WITH (security_invoker = true) AS
SELECT id, action_id, public.mask_owner(user_id::text) AS masked_owner, aca_hash_key, aca_payload, created_at
FROM public.dao_vetoes;

CREATE OR REPLACE VIEW public.dao_votes_public WITH (security_invoker = true) AS
SELECT id, public.mask_owner(user_id::text) AS masked_owner, vote_weight, credits_spent, created_at,
       aca_hash_key, aca_payload, vote_type, proposal_id, snapshot_block, snapshot_voting_power
FROM public.dao_votes;

CREATE OR REPLACE VIEW public.data_lineage_index_public WITH (security_invoker = true) AS
SELECT aca_hash_key, source_table, created_at, data_category
FROM public.data_lineage_index;

CREATE OR REPLACE VIEW public.governance_ledger_public WITH (security_invoker = true) AS
SELECT id, public.mask_owner(user_id::text) AS masked_owner, amount, transaction_type, description,
       on_chain_tx_hash, created_at, public.mask_owner(actor_id::text) AS masked_actor,
       action_type, target_table, target_id, aca_hash_key, metadata
FROM public.governance_ledger;

CREATE OR REPLACE VIEW public.hat_recall_petitions_public WITH (security_invoker = true) AS
SELECT id, target_hat_id, public.mask_owner(petitioner_id::text) AS masked_petitioner,
       reason, aca_hash_key, status, threshold, signature_count, opened_at, closed_at
FROM public.hat_recall_petitions;

CREATE OR REPLACE VIEW public.hat_recall_signatures_public WITH (security_invoker = true) AS
SELECT id, petition_id, public.mask_owner(signer_id::text) AS masked_signer, aca_hash_key, created_at
FROM public.hat_recall_signatures;

CREATE OR REPLACE VIEW public.proposal_comments_public WITH (security_invoker = true) AS
SELECT id, proposal_id, parent_id, public.mask_owner(author_id::text) AS masked_author,
       body, aca_hash_key, created_at, edited_at, redacted_at
FROM public.proposal_comments;

CREATE OR REPLACE VIEW public.proposal_signatures_public WITH (security_invoker = true) AS
SELECT id, proposal_id, public.mask_owner(signer_id::text) AS masked_signer,
       signature_type, aca_hash_key, created_at
FROM public.proposal_signatures;

CREATE OR REPLACE VIEW public.raw_app_data_public WITH (security_invoker = true) AS
SELECT id, public.mask_owner(pseudo_user_id) AS masked_owner, data_category, event_type,
       anonymized_payload, processed_at, data_quality_score, location_zone, session_context,
       created_at, device_aca_key, aca_hash_key, raw_source, telemetry_payload
FROM public.raw_app_data;

CREATE OR REPLACE VIEW public.raw_health_data_public WITH (security_invoker = true) AS
SELECT id, public.mask_owner(user_id::text) AS masked_owner, device_type, raw_payload, recorded_at,
       created_at, processed, processing_completed_at, processing_status, retry_count, last_error,
       next_retry_at, source, activity_type, step_count, processing_started_at, aca_hash_key, aca_hash
FROM public.raw_health_data;

CREATE OR REPLACE VIEW public.staged_health_data_public WITH (security_invoker = true) AS
SELECT id, public.mask_owner(entity_id::text) AS masked_entity, aca_hash_key, activity_type, payload,
       data_quality_score, synapse_weight_coefficient, processed_at, created_at, raw_data_id,
       public.mask_owner(platform_guid::text) AS masked_platform_guid, reward_calculated,
       public.mask_owner(pseudo_user_id) AS masked_pseudo, reward_amount, effort_score, faculty,
       status, is_settled, settled_at, public.mask_owner(user_id::text) AS masked_owner,
       public.mask_owner(sovereign_uuid::text) AS masked_sovereign,
       steps_count, heart_rate_variability_ms, duration_seconds,
       environmental_audio_exposure_db, walking_asymmetry_percentage, double_support_percentage,
       respiratory_rate, step_length_cm, walking_speed_kmh, uv_exposure_index, heart_rate,
       resting_heart_rate, blood_oxygen_percentage, walking_steadiness_percentage,
       active_energy_kcal, basal_energy_kcal, body_temperature_f, vo2_max,
       blood_pressure_systolic, blood_pressure_diastolic, sleep_analysis_value
FROM public.staged_health_data;

CREATE OR REPLACE VIEW public.staged_lifestyle_data_public WITH (security_invoker = true) AS
SELECT id, public.mask_owner(entity_id::text) AS masked_entity, public.mask_owner(user_id::text) AS masked_owner,
       aca_hash_key, event_type, event_category, session_duration, data_quality_score,
       synapse_weight_coefficient, reward_amount, reward_calculated, processed_at, created_at,
       public.mask_owner(pseudo_user_id::text) AS masked_pseudo
FROM public.staged_lifestyle_data;

CREATE OR REPLACE VIEW public.synapse_controller_public WITH (security_invoker = true) AS
SELECT id, public.mask_owner(user_id::text) AS masked_owner, raw_data, status, aca_hash_key, created_at
FROM public.synapse_controller;

CREATE OR REPLACE VIEW public.user_aca_records_public WITH (security_invoker = true) AS
SELECT id, public.mask_owner(platform_guid::text) AS masked_owner, aca_hash_key, consent_scope,
       created_at, source_id, consent_type, consumed_at, tx_hash
FROM public.user_aca_records;

DO $$
DECLARE v_name text;
BEGIN
  FOR v_name IN
    SELECT table_name FROM information_schema.views
    WHERE table_schema = 'public' AND table_name LIKE '%_public'
  LOOP
    EXECUTE format('REVOKE ALL ON public.%I FROM PUBLIC', v_name);
    EXECUTE format('REVOKE ALL ON public.%I FROM anon', v_name);
    EXECUTE format('GRANT SELECT ON public.%I TO authenticated', v_name);
  END LOOP;
END $$;

DO $$
DECLARE
  t text;
  tables text[] := ARRAY[
    'committee_applications','dao_proposals','dao_vetoes','dao_votes',
    'data_lineage_index','governance_ledger','hat_recall_petitions',
    'hat_recall_signatures','proposal_comments','proposal_signatures',
    'raw_app_data','raw_health_data','staged_health_data','staged_lifestyle_data',
    'synapse_controller','user_aca_records'
  ];
BEGIN
  FOREACH t IN ARRAY tables LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', 'Authenticated read ACA ' || t, t);
    EXECUTE format('CREATE POLICY %I ON public.%I FOR SELECT TO authenticated USING (true)', 'Authenticated read ACA ' || t, t);
  END LOOP;
END $$;
