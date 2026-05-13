-- Enforce: profiles.platform_guid === user_id (Auth ID === Platform GUID)
-- This guarantees deterministic identity across Auth, DB, and pseudonym generation.
-- No PII is added to public schema — PII remains in device Secure Enclave + auth.users.user_metadata.

-- 1. Drop the legacy trigger that mints random GUIDs (drift source)
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

-- 2. Replace handle_new_user() so it can never mint a random GUID again.
--    Keep as a safe alias of handle_new_user_genesis (GUID := user_id).
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (
    id, user_id, platform_guid, account_type, ai_assistant_name, kyc_tier
  ) VALUES (
    NEW.id, NEW.id, NEW.id, 'individual', 'Friend', 1
  )
  ON CONFLICT (user_id) DO NOTHING;
  RETURN NEW;
END;
$$;

-- 3. Re-create the auth trigger pointing at the genesis function (single source of truth)
DROP TRIGGER IF EXISTS on_auth_user_created_genesis ON auth.users;
CREATE TRIGGER on_auth_user_created_genesis
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user_genesis();

-- 4. Backfill: heal any drifted rows so platform_guid === user_id
UPDATE public.profiles
SET platform_guid = user_id
WHERE platform_guid IS DISTINCT FROM user_id;

-- 5. Enforcement trigger: forcibly bind platform_guid to user_id on every write
CREATE OR REPLACE FUNCTION public.enforce_platform_guid_equals_user_id()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.platform_guid := NEW.user_id;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_enforce_platform_guid ON public.profiles;
CREATE TRIGGER trg_enforce_platform_guid
  BEFORE INSERT OR UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_platform_guid_equals_user_id();