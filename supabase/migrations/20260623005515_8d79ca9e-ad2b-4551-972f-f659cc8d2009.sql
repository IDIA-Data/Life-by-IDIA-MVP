
ALTER VIEW public.member_wallet_directory SET (security_invoker = on);

DROP POLICY IF EXISTS "Authenticated read ACA raw_app_data" ON public.raw_app_data;
DROP POLICY IF EXISTS "Users can read own raw_app_data" ON public.raw_app_data;
CREATE POLICY "Users can read own raw_app_data"
  ON public.raw_app_data FOR SELECT TO authenticated
  USING (pseudo_user_id = auth.uid()::text);

DROP POLICY IF EXISTS "Authenticated read ACA raw_health_data" ON public.raw_health_data;
DROP POLICY IF EXISTS "System can update raw health data" ON public.raw_health_data;
DROP POLICY IF EXISTS "System can insert raw health data" ON public.raw_health_data;
DROP POLICY IF EXISTS "service_role manages raw_health_data writes" ON public.raw_health_data;
CREATE POLICY "service_role manages raw_health_data writes"
  ON public.raw_health_data FOR ALL TO service_role
  USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Service role can insert payments" ON public.usdc_payments;
DROP POLICY IF EXISTS "service_role inserts usdc_payments" ON public.usdc_payments;
CREATE POLICY "service_role inserts usdc_payments"
  ON public.usdc_payments FOR INSERT TO service_role
  WITH CHECK (true);

DROP POLICY IF EXISTS "Authenticated read contributions" ON public.funding_contributions;
DROP POLICY IF EXISTS "service_role reads funding_contributions" ON public.funding_contributions;
CREATE POLICY "service_role reads funding_contributions"
  ON public.funding_contributions FOR SELECT TO service_role
  USING (true);

DROP POLICY IF EXISTS "Authenticated read distributions" ON public.funding_distributions;
DROP POLICY IF EXISTS "service_role reads funding_distributions" ON public.funding_distributions;
CREATE POLICY "service_role reads funding_distributions"
  ON public.funding_distributions FOR SELECT TO service_role
  USING (true);

DROP POLICY IF EXISTS "Authenticated read vesting" ON public.vesting_pushes;
DROP POLICY IF EXISTS "service_role reads vesting_pushes" ON public.vesting_pushes;
CREATE POLICY "service_role reads vesting_pushes"
  ON public.vesting_pushes FOR SELECT TO service_role
  USING (true);

DO $$
DECLARE r record;
BEGIN
  FOR r IN
    SELECT n.nspname, p.proname, pg_get_function_identity_arguments(p.oid) AS args
    FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.prokind = 'f'
      AND NOT EXISTS (
        SELECT 1 FROM unnest(coalesce(p.proconfig, ARRAY[]::text[])) c
        WHERE c LIKE 'search_path=%'
      )
  LOOP
    EXECUTE format('ALTER FUNCTION %I.%I(%s) SET search_path = public', r.nspname, r.proname, r.args);
  END LOOP;
END$$;

DO $$
DECLARE r record;
  keep_authenticated text[] := ARRAY[
    'has_hat','has_role','has_business_access',
    'is_business_leadership','is_business_manager','is_business_member',
    'is_csuite','is_org_admin',
    'get_user_business_access','get_user_business_role',
    'revoke_employee','increment_wallet_balance'
  ];
BEGIN
  FOR r IN
    SELECT n.nspname, p.proname, pg_get_function_identity_arguments(p.oid) AS args
    FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.prosecdef = true
  LOOP
    EXECUTE format('REVOKE EXECUTE ON FUNCTION %I.%I(%s) FROM PUBLIC, anon', r.nspname, r.proname, r.args);
    IF NOT (r.proname = ANY(keep_authenticated)) THEN
      EXECUTE format('REVOKE EXECUTE ON FUNCTION %I.%I(%s) FROM authenticated', r.nspname, r.proname, r.args);
    END IF;
  END LOOP;
END$$;
