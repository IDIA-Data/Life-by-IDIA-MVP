
-- Add logo_path to business intake requests
ALTER TABLE public.account_conversion_requests
  ADD COLUMN IF NOT EXISTS logo_path text;

-- Create public business-logos storage bucket for intake logo uploads
INSERT INTO storage.buckets (id, name, public)
VALUES ('business-logos', 'business-logos', true)
ON CONFLICT (id) DO NOTHING;

-- RLS: anyone can read (public bucket), authenticated users can upload to their own folder
DROP POLICY IF EXISTS "Business logos are publicly accessible" ON storage.objects;
CREATE POLICY "Business logos are publicly accessible"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'business-logos');

DROP POLICY IF EXISTS "Users can upload their own business logos" ON storage.objects;
CREATE POLICY "Users can upload their own business logos"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'business-logos'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

DROP POLICY IF EXISTS "Users can update their own business logos" ON storage.objects;
CREATE POLICY "Users can update their own business logos"
  ON storage.objects FOR UPDATE
  USING (
    bucket_id = 'business-logos'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );
