-- Phase 5: Evidence-Based Good Deeds — private storage bucket for evidence files

INSERT INTO storage.buckets (id, name, public)
VALUES ('deed-evidence', 'deed-evidence', false)
ON CONFLICT (id) DO NOTHING;

-- Owners can read their own evidence files (path prefix = auth.uid())
CREATE POLICY "Users can view their own deed evidence"
ON storage.objects
FOR SELECT
TO authenticated
USING (
  bucket_id = 'deed-evidence'
  AND auth.uid()::text = (storage.foldername(name))[1]
);

-- Owners can upload to their own folder
CREATE POLICY "Users can upload their own deed evidence"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'deed-evidence'
  AND auth.uid()::text = (storage.foldername(name))[1]
);

-- Owners can replace their own evidence file
CREATE POLICY "Users can update their own deed evidence"
ON storage.objects
FOR UPDATE
TO authenticated
USING (
  bucket_id = 'deed-evidence'
  AND auth.uid()::text = (storage.foldername(name))[1]
);

-- Owners can delete their own evidence file
CREATE POLICY "Users can delete their own deed evidence"
ON storage.objects
FOR DELETE
TO authenticated
USING (
  bucket_id = 'deed-evidence'
  AND auth.uid()::text = (storage.foldername(name))[1]
);
