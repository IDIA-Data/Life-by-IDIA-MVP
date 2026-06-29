
ALTER TABLE public.business_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.businesses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.data_connections ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.gift_cards ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.health_metrics ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.hri_scores ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.password_reset_tokens ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.security_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.remediation_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.security_preferences ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.system_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_preferences ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow anon upsert for device provisioning" ON public.device_provisioning_blueprints;
DROP POLICY IF EXISTS "Enable upsert for all users" ON public.idia_schema_manifest_vault;
DROP POLICY IF EXISTS "Anonymized Public Access" ON public.staged_health_data;
DROP POLICY IF EXISTS "PRODUCTION_FIX_STITCHED_ID" ON public.staged_health_data;
DROP POLICY IF EXISTS "Hub Monitor" ON public.synapse_credit_ledger;
DROP POLICY IF EXISTS "Hub Pulse Visibility" ON public.synapse_credit_ledger;
DROP POLICY IF EXISTS "Users manage own ledger" ON public.synapse_credit_ledger;
DROP POLICY IF EXISTS "Users can view their own consent records" ON public.user_aca_records;
DROP POLICY IF EXISTS "System can manage wallets" ON public.wallets;
DROP POLICY IF EXISTS "Public read access for treasury telemetry" ON public.dao_treasury_flows;
DROP POLICY IF EXISTS "Sovereigns can read treasury flows telemetry" ON public.dao_treasury_flows;
DROP POLICY IF EXISTS "Authenticated users can view security events" ON public.security_events;
DROP POLICY IF EXISTS "System can insert security events" ON public.security_events;
DROP POLICY IF EXISTS "Authenticated users can view remediation plans" ON public.remediation_plans;
DROP POLICY IF EXISTS "System can manage remediation plans" ON public.remediation_plans;
DROP POLICY IF EXISTS "Public Development Access" ON public.hri_scores;

DROP POLICY IF EXISTS "Users can view their own staged health data" ON public.staged_health_data;
CREATE POLICY "Users can view their own staged health data"
  ON public.staged_health_data FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert their own ledger entries" ON public.synapse_credit_ledger;
CREATE POLICY "Users can insert their own ledger entries"
  ON public.synapse_credit_ledger FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Authenticated users can view treasury flows" ON public.dao_treasury_flows;
CREATE POLICY "Authenticated users can view treasury flows"
  ON public.dao_treasury_flows FOR SELECT TO authenticated
  USING (true);

DROP POLICY IF EXISTS "Users can view their own security prefs" ON public.security_preferences;
CREATE POLICY "Users can view their own security prefs"
  ON public.security_preferences FOR SELECT TO authenticated
  USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "Users can upsert their own security prefs" ON public.security_preferences;
CREATE POLICY "Users can upsert their own security prefs"
  ON public.security_preferences FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "Users can update their own security prefs" ON public.security_preferences;
CREATE POLICY "Users can update their own security prefs"
  ON public.security_preferences FOR UPDATE TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Business members can manage gift cards" ON public.gift_cards;
CREATE POLICY "Business members can manage gift cards"
  ON public.gift_cards FOR ALL TO authenticated
  USING (business_id IN (
    SELECT business_id FROM public.business_users
    WHERE user_id = auth.uid() AND is_active = true))
  WITH CHECK (business_id IN (
    SELECT business_id FROM public.business_users
    WHERE user_id = auth.uid() AND is_active = true));

DROP POLICY IF EXISTS "Service role manages security events" ON public.security_events;
CREATE POLICY "Service role manages security events"
  ON public.security_events FOR ALL TO service_role
  USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Service role manages remediation plans" ON public.remediation_plans;
CREATE POLICY "Service role manages remediation plans"
  ON public.remediation_plans FOR ALL TO service_role
  USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Service role manages system settings" ON public.system_settings;
CREATE POLICY "Service role manages system settings"
  ON public.system_settings FOR ALL TO service_role
  USING (true) WITH CHECK (true);
