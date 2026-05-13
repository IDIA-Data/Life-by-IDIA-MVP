-- Extend device_events table for comprehensive app data collection
ALTER TABLE public.device_events 
ADD COLUMN IF NOT EXISTS data_category TEXT DEFAULT 'general',
ADD COLUMN IF NOT EXISTS session_id TEXT,
ADD COLUMN IF NOT EXISTS processing_status TEXT DEFAULT 'pending',
ADD COLUMN IF NOT EXISTS anonymized_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS bundled_at TIMESTAMPTZ;

-- Update comment to reflect new purpose
COMMENT ON TABLE public.device_events IS 'Stores all app-generated events including health, social, wallet, AI interactions, voting, shopping, and general app activity.';
COMMENT ON COLUMN public.device_events.data_category IS 'Category of data: health, social, wallet, ai_interaction, voting, shopping, ar_experience, general';
COMMENT ON COLUMN public.device_events.event_type IS 'Specific event type within the category, e.g., friend_request, wallet_transaction, ai_query, vote_cast, etc.';

-- Create comprehensive staged app data table for anonymized events
CREATE TABLE IF NOT EXISTS public.staged_app_data (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    pseudo_user_id TEXT NOT NULL,
    data_category TEXT NOT NULL,
    event_type TEXT NOT NULL,
    anonymized_payload JSONB NOT NULL,
    processed_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    data_quality_score NUMERIC DEFAULT 0.5,
    location_zone TEXT,
    session_context JSONB,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS for staged app data
ALTER TABLE public.staged_app_data ENABLE ROW LEVEL SECURITY;

-- Create policy for system access to staged app data
CREATE POLICY "System can manage staged app data"
ON public.staged_app_data FOR ALL
USING (true);

-- Create comprehensive data bundles table
CREATE TABLE IF NOT EXISTS public.universal_data_bundles (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    bundle_category TEXT NOT NULL, -- behavioral, social, financial, ai_patterns, civic, commerce
    data_types JSONB NOT NULL, -- array of data categories included
    bundle_metadata JSONB NOT NULL,
    quality_score NUMERIC DEFAULT 0.5,
    market_value NUMERIC DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    expires_at TIMESTAMPTZ,
    bundle_size_bytes BIGINT,
    unique_users_count INTEGER DEFAULT 0
);

-- Enable RLS for universal data bundles
ALTER TABLE public.universal_data_bundles ENABLE ROW LEVEL SECURITY;

-- Create policy for authenticated users to view bundles
CREATE POLICY "Authenticated users can view data bundles"
ON public.universal_data_bundles FOR SELECT
TO authenticated
USING (true);

-- Add indexes for performance (using existing columns only)
CREATE INDEX IF NOT EXISTS idx_device_events_category_type ON public.device_events(data_category, event_type);
CREATE INDEX IF NOT EXISTS idx_device_events_processing ON public.device_events(processing_status, event_timestamp);
CREATE INDEX IF NOT EXISTS idx_staged_app_data_category ON public.staged_app_data(data_category, event_type);
CREATE INDEX IF NOT EXISTS idx_staged_app_data_processed ON public.staged_app_data(processed_at);
CREATE INDEX IF NOT EXISTS idx_universal_bundles_category ON public.universal_data_bundles(bundle_category);