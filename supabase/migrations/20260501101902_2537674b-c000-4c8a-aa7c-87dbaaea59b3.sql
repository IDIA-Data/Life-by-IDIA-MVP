-- A. Zero-PII: drop the plaintext contact name
ALTER TABLE public.account_conversion_requests
  DROP COLUMN IF EXISTS contact_name;

-- B. Identity anchor: GUID is the sole binding
ALTER TABLE public.account_conversion_requests
  ALTER COLUMN user_id SET NOT NULL;
CREATE INDEX IF NOT EXISTS idx_acr_user_id
  ON public.account_conversion_requests(user_id);

-- C. New KYB intake fields. Taxonomy IDs are TEXT (matching taxonomy_verticals.id / taxonomy_submodules.id).
ALTER TABLE public.account_conversion_requests
  ADD COLUMN IF NOT EXISTS ein              text,
  ADD COLUMN IF NOT EXISTS entity_type      text,
  ADD COLUMN IF NOT EXISTS vertical_id      text REFERENCES public.taxonomy_verticals(id),
  ADD COLUMN IF NOT EXISTS submodule_id     text REFERENCES public.taxonomy_submodules(id),
  ADD COLUMN IF NOT EXISTS address_street1  text,
  ADD COLUMN IF NOT EXISTS address_street2  text,
  ADD COLUMN IF NOT EXISTS address_city     text,
  ADD COLUMN IF NOT EXISTS address_state    text,
  ADD COLUMN IF NOT EXISTS address_zip      text,
  ADD COLUMN IF NOT EXISTS document_paths   text[] NOT NULL DEFAULT '{}'::text[];

-- D. Structural validation (no PII checks)
DO $$ BEGIN
  ALTER TABLE public.account_conversion_requests
    ADD CONSTRAINT acr_ein_format
      CHECK (ein IS NULL OR ein ~ '^\d{2}-\d{7}$');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE public.account_conversion_requests
    ADD CONSTRAINT acr_entity_type_valid
      CHECK (entity_type IS NULL OR entity_type IN ('C-Corp','S-Corp','LLC','Sole','Non-Profit'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE public.account_conversion_requests
    ADD CONSTRAINT acr_state_valid
      CHECK (address_state IS NULL OR address_state ~ '^[A-Z]{2}$');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE public.account_conversion_requests
    ADD CONSTRAINT acr_zip_valid
      CHECK (address_zip IS NULL OR address_zip ~ '^\d{5}(-\d{4})?$');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- E. Storage bucket (private, GUID-isolated)
INSERT INTO storage.buckets (id, name, public)
VALUES ('business-kyb-docs', 'business-kyb-docs', false)
ON CONFLICT (id) DO NOTHING;

-- Path convention: {auth.uid()}/{request_uuid}/{slot}.pdf
DROP POLICY IF EXISTS "kyb_docs_owner_select" ON storage.objects;
CREATE POLICY "kyb_docs_owner_select"
ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id = 'business-kyb-docs'
  AND auth.uid()::text = (storage.foldername(name))[1]
);

DROP POLICY IF EXISTS "kyb_docs_owner_insert" ON storage.objects;
CREATE POLICY "kyb_docs_owner_insert"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'business-kyb-docs'
  AND auth.uid()::text = (storage.foldername(name))[1]
);