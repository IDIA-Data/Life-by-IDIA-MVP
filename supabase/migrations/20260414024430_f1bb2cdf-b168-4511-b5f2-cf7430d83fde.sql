ALTER TABLE public.user_aca_records 
ADD COLUMN IF NOT EXISTS source_id text NOT NULL DEFAULT 'unknown';

CREATE INDEX IF NOT EXISTS idx_user_aca_source ON public.user_aca_records(platform_guid, source_id);