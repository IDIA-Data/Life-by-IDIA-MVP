
CREATE TABLE public.consent_registry (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  consent_type text NOT NULL,
  decision text NOT NULL CHECK (decision IN ('accepted','declined')),
  document_version text NOT NULL,
  aca_hash_key text,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX consent_registry_user_type_version_uidx
  ON public.consent_registry (user_id, consent_type, document_version);

CREATE INDEX consent_registry_user_idx
  ON public.consent_registry (user_id);

GRANT SELECT, INSERT ON public.consent_registry TO authenticated;
GRANT ALL ON public.consent_registry TO service_role;

ALTER TABLE public.consent_registry ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own consent records"
  ON public.consent_registry
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own consent records"
  ON public.consent_registry
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);
