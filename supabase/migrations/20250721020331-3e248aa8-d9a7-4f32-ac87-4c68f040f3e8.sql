
-- Phase 1: Database Architecture Enhancement (Angelic XR Integration)

-- AR Experience Management Tables
CREATE TABLE public.ar_experiences (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  business_id UUID REFERENCES public.businesses(id) NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  experience_type TEXT NOT NULL DEFAULT 'menu_visualization',
  content_version INTEGER NOT NULL DEFAULT 1,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  spatial_anchor_data JSONB,
  interaction_triggers JSONB DEFAULT '[]'::jsonb,
  performance_metrics JSONB DEFAULT '{}'::jsonb
);

CREATE TABLE public.ar_content_assets (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  ar_experience_id UUID REFERENCES public.ar_experiences(id) ON DELETE CASCADE,
  asset_type TEXT NOT NULL, -- '3d_model', 'texture', 'audio', 'animation'
  asset_url TEXT NOT NULL,
  file_size_bytes BIGINT,
  asset_metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  is_active BOOLEAN DEFAULT true
);

CREATE TABLE public.ar_placement_zones (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  business_id UUID REFERENCES public.businesses(id) NOT NULL,
  location_id UUID REFERENCES public.business_locations(id),
  zone_name TEXT NOT NULL,
  geospatial_bounds JSONB NOT NULL, -- coordinates, radius, etc.
  ar_experience_id UUID REFERENCES public.ar_experiences(id),
  placement_rules JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  is_active BOOLEAN DEFAULT true
);

CREATE TABLE public.ar_user_interactions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id),
  ar_experience_id UUID REFERENCES public.ar_experiences(id),
  interaction_type TEXT NOT NULL, -- 'view', 'tap', 'gesture', 'purchase'
  interaction_data JSONB NOT NULL,
  session_id TEXT,
  duration_seconds INTEGER,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  location_data JSONB,
  device_info JSONB DEFAULT '{}'::jsonb
);

-- Affiliate Marketing & Creator Economy
CREATE TABLE public.affiliate_campaigns (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  business_id UUID REFERENCES public.businesses(id) NOT NULL,
  campaign_name TEXT NOT NULL,
  campaign_type TEXT NOT NULL DEFAULT 'ar_activation',
  target_audience JSONB DEFAULT '{}'::jsonb,
  budget_allocation NUMERIC(10,2),
  commission_rate NUMERIC(5,4) DEFAULT 0.05,
  start_date TIMESTAMP WITH TIME ZONE NOT NULL,
  end_date TIMESTAMP WITH TIME ZONE,
  status TEXT DEFAULT 'active',
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE public.creator_profiles (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) NOT NULL,
  creator_handle TEXT UNIQUE NOT NULL,
  verification_status TEXT DEFAULT 'pending',
  follower_count INTEGER DEFAULT 0,
  engagement_rate NUMERIC(5,4) DEFAULT 0.0,
  specialty_categories TEXT[] DEFAULT '{}',
  performance_rating NUMERIC(3,2) DEFAULT 0.0,
  total_earnings NUMERIC(10,2) DEFAULT 0.0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  profile_metadata JSONB DEFAULT '{}'::jsonb
);

CREATE TABLE public.affiliate_transactions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  campaign_id UUID REFERENCES public.affiliate_campaigns(id) NOT NULL,
  creator_id UUID REFERENCES public.creator_profiles(id) NOT NULL,
  transaction_type TEXT NOT NULL, -- 'click', 'view', 'conversion'
  transaction_value NUMERIC(10,2),
  commission_amount NUMERIC(10,2),
  tracking_code TEXT,
  user_id UUID REFERENCES auth.users(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  metadata JSONB DEFAULT '{}'::jsonb
);

CREATE TABLE public.performance_metrics (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  entity_type TEXT NOT NULL, -- 'campaign', 'creator', 'ar_experience'
  entity_id UUID NOT NULL,
  metric_type TEXT NOT NULL, -- 'impressions', 'clicks', 'conversions', 'revenue'
  metric_value NUMERIC(15,2) NOT NULL,
  time_period TEXT NOT NULL, -- 'hourly', 'daily', 'weekly', 'monthly'
  recorded_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  additional_data JSONB DEFAULT '{}'::jsonb
);

-- Urban Flow Data System
CREATE TABLE public.urban_flow_events (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  event_type TEXT NOT NULL, -- 'foot_traffic', 'ar_engagement', 'transaction', 'dwell_time'
  location_id UUID REFERENCES public.business_locations(id),
  user_id UUID REFERENCES auth.users(id),
  event_data JSONB NOT NULL,
  geospatial_data JSONB,
  timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  session_id TEXT,
  device_type TEXT,
  anonymized_user_id TEXT -- For privacy compliance
);

CREATE TABLE public.geospatial_analytics (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  analysis_type TEXT NOT NULL, -- 'heat_map', 'flow_pattern', 'dwell_analysis'
  geographic_bounds JSONB NOT NULL,
  analysis_period JSONB NOT NULL, -- start_time, end_time
  results JSONB NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE public.demographic_clusters (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  cluster_name TEXT NOT NULL,
  geographic_bounds JSONB NOT NULL,
  demographic_profile JSONB NOT NULL,
  behavior_patterns JSONB NOT NULL,
  cluster_size INTEGER,
  confidence_score NUMERIC(3,2),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE public.economic_impact_metrics (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  business_id UUID REFERENCES public.businesses(id),
  location_id UUID REFERENCES public.business_locations(id),
  metric_category TEXT NOT NULL, -- 'revenue_impact', 'foot_traffic_correlation', 'conversion_rate'
  metric_value NUMERIC(15,2) NOT NULL,
  comparison_period JSONB NOT NULL,
  calculated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  methodology TEXT,
  confidence_interval JSONB
);

-- Enhanced existing tables for AR integration
ALTER TABLE public.menu_items ADD COLUMN ar_model_url TEXT;
ALTER TABLE public.menu_items ADD COLUMN ar_placement_data JSONB DEFAULT '{}'::jsonb;
ALTER TABLE public.menu_items ADD COLUMN ar_interaction_count INTEGER DEFAULT 0;

ALTER TABLE public.pos_transactions ADD COLUMN ar_experience_id UUID REFERENCES public.ar_experiences(id);
ALTER TABLE public.pos_transactions ADD COLUMN initiated_via_ar BOOLEAN DEFAULT false;

-- Add RLS policies for AR tables
ALTER TABLE public.ar_experiences ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ar_content_assets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ar_placement_zones ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ar_user_interactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.affiliate_campaigns ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.creator_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.affiliate_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.performance_metrics ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.urban_flow_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.geospatial_analytics ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.demographic_clusters ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.economic_impact_metrics ENABLE ROW LEVEL SECURITY;

-- RLS Policies for AR experiences
CREATE POLICY "Business users can manage their AR experiences" 
ON public.ar_experiences 
FOR ALL 
USING (business_id IN (
  SELECT business_id FROM business_users 
  WHERE user_id = auth.uid() AND is_active = true
));

-- RLS Policies for AR content assets
CREATE POLICY "Business users can manage their AR content" 
ON public.ar_content_assets 
FOR ALL 
USING (ar_experience_id IN (
  SELECT id FROM ar_experiences 
  WHERE business_id IN (
    SELECT business_id FROM business_users 
    WHERE user_id = auth.uid() AND is_active = true
  )
));

-- RLS Policies for AR user interactions
CREATE POLICY "Users can view their own AR interactions" 
ON public.ar_user_interactions 
FOR SELECT 
USING (auth.uid() = user_id);

CREATE POLICY "System can insert AR interactions" 
ON public.ar_user_interactions 
FOR INSERT 
WITH CHECK (true);

-- RLS Policies for creator profiles
CREATE POLICY "Users can manage their creator profile" 
ON public.creator_profiles 
FOR ALL 
USING (auth.uid() = user_id);

CREATE POLICY "Public can view verified creator profiles" 
ON public.creator_profiles 
FOR SELECT 
USING (verification_status = 'verified');

-- RLS Policies for affiliate campaigns
CREATE POLICY "Business users can manage their affiliate campaigns" 
ON public.affiliate_campaigns 
FOR ALL 
USING (business_id IN (
  SELECT business_id FROM business_users 
  WHERE user_id = auth.uid() AND is_active = true
));

-- RLS Policies for performance metrics
CREATE POLICY "Business users can view their performance metrics" 
ON public.performance_metrics 
FOR SELECT 
USING (
  entity_id IN (
    SELECT id FROM ar_experiences 
    WHERE business_id IN (
      SELECT business_id FROM business_users 
      WHERE user_id = auth.uid() AND is_active = true
    )
  ) OR
  entity_id IN (
    SELECT id FROM affiliate_campaigns 
    WHERE business_id IN (
      SELECT business_id FROM business_users 
      WHERE user_id = auth.uid() AND is_active = true
    )
  )
);

-- RLS Policies for urban flow events
CREATE POLICY "Users can view their urban flow data" 
ON public.urban_flow_events 
FOR SELECT 
USING (auth.uid() = user_id OR user_id IS NULL);

CREATE POLICY "System can insert urban flow events" 
ON public.urban_flow_events 
FOR INSERT 
WITH CHECK (true);

-- Create indexes for performance
CREATE INDEX idx_ar_experiences_business_id ON public.ar_experiences(business_id);
CREATE INDEX idx_ar_user_interactions_user_id ON public.ar_user_interactions(user_id);
CREATE INDEX idx_ar_user_interactions_experience_id ON public.ar_user_interactions(ar_experience_id);
CREATE INDEX idx_affiliate_campaigns_business_id ON public.affiliate_campaigns(business_id);
CREATE INDEX idx_creator_profiles_user_id ON public.creator_profiles(user_id);
CREATE INDEX idx_urban_flow_events_location_id ON public.urban_flow_events(location_id);
CREATE INDEX idx_urban_flow_events_timestamp ON public.urban_flow_events(timestamp);
CREATE INDEX idx_performance_metrics_entity ON public.performance_metrics(entity_type, entity_id);
