-- Phase 1: Core Database Schema Setup
-- User Management Tables
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  username TEXT UNIQUE,
  display_name TEXT,
  avatar_url TEXT,
  bio TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE public.user_connections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  provider TEXT NOT NULL, -- 'apple_health', 'google_fit', 'strava', 'nike'
  connection_status TEXT DEFAULT 'pending', -- 'pending', 'connected', 'disconnected', 'error'
  connection_data JSONB DEFAULT '{}',
  last_sync_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(user_id, provider)
);

CREATE TABLE public.user_wallets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE UNIQUE,
  balance DECIMAL(15,8) DEFAULT 0.0 CHECK (balance >= 0),
  total_earned DECIMAL(15,8) DEFAULT 0.0,
  total_spent DECIMAL(15,8) DEFAULT 0.0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Health Data Pipeline Tables
CREATE TABLE public.raw_health_data (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  data_source TEXT NOT NULL, -- 'apple_health', 'google_fit', etc.
  data_type TEXT NOT NULL, -- 'steps', 'heart_rate', 'sleep', etc.
  raw_data JSONB NOT NULL,
  recorded_at TIMESTAMP WITH TIME ZONE NOT NULL,
  processed BOOLEAN DEFAULT FALSE,
  processed_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE public.staged_health_data (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  raw_data_id UUID NOT NULL REFERENCES public.raw_health_data(id) ON DELETE CASCADE,
  pseudonym TEXT NOT NULL,
  anonymized_data JSONB NOT NULL,
  location_zone TEXT DEFAULT 'ZONE_DEFAULT',
  recorded_at TIMESTAMP WITH TIME ZONE NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE public.staged_data (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  raw_data_id UUID NOT NULL REFERENCES public.raw_health_data(id) ON DELETE CASCADE,
  data_type TEXT NOT NULL,
  step_count INTEGER,
  recorded_at TIMESTAMP WITH TIME ZONE NOT NULL,
  reward_amount DECIMAL(10,8) DEFAULT 0.0,
  processed BOOLEAN DEFAULT FALSE,
  processed_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE public.health_metrics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  metric_type TEXT NOT NULL, -- 'daily_steps', 'weekly_active_minutes', etc.
  metric_value DECIMAL(12,4) NOT NULL,
  unit TEXT NOT NULL,
  recorded_date DATE NOT NULL,
  source_data_ids UUID[] DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(user_id, metric_type, recorded_date)
);

-- Rewards & Social Tables
CREATE TABLE public.rewards (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  reward_type TEXT NOT NULL, -- 'step_bonus', 'consistency_bonus', 'social_impact'
  amount DECIMAL(10,8) NOT NULL CHECK (amount > 0),
  data_source TEXT NOT NULL,
  reference_id UUID, -- points to staged_data or other source
  description TEXT,
  earned_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE public.transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  transaction_type TEXT NOT NULL, -- 'earn', 'spend', 'transfer'
  amount DECIMAL(15,8) NOT NULL,
  description TEXT NOT NULL,
  reference_type TEXT, -- 'reward', 'purchase', 'governance'
  reference_id UUID,
  balance_after DECIMAL(15,8) NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE public.virtuous_cycle_impacts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  impact_type TEXT NOT NULL, -- 'carbon_offset', 'tree_planted', 'charity_donation'
  impact_value DECIMAL(12,4) NOT NULL,
  impact_unit TEXT NOT NULL,
  cost_in_tokens DECIMAL(10,8) NOT NULL,
  transaction_id UUID REFERENCES public.transactions(id),
  impact_date TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  metadata JSONB DEFAULT '{}'
);

CREATE TABLE public.governance_proposals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  proposal_type TEXT NOT NULL, -- 'reward_adjustment', 'new_feature', 'policy_change'
  status TEXT DEFAULT 'active', -- 'active', 'passed', 'rejected', 'expired'
  voting_ends_at TIMESTAMP WITH TIME ZONE NOT NULL,
  yes_votes INTEGER DEFAULT 0,
  no_votes INTEGER DEFAULT 0,
  total_tokens_voted DECIMAL(15,8) DEFAULT 0,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE public.governance_votes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  proposal_id UUID NOT NULL REFERENCES public.governance_proposals(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  vote TEXT NOT NULL CHECK (vote IN ('yes', 'no')),
  tokens_weight DECIMAL(15,8) NOT NULL,
  voted_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(proposal_id, user_id)
);

-- Enable Row Level Security on all tables
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_connections ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_wallets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.raw_health_data ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.staged_health_data ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.staged_data ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.health_metrics ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rewards ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.virtuous_cycle_impacts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.governance_proposals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.governance_votes ENABLE ROW LEVEL SECURITY;

-- Create RLS Policies for User Data
-- Profiles policies
CREATE POLICY "Users can view all profiles" ON public.profiles FOR SELECT USING (true);
CREATE POLICY "Users can update their own profile" ON public.profiles FOR UPDATE USING (auth.uid() = id);
CREATE POLICY "Users can insert their own profile" ON public.profiles FOR INSERT WITH CHECK (auth.uid() = id);

-- User connections policies  
CREATE POLICY "Users can manage their own connections" ON public.user_connections FOR ALL USING (auth.uid() = user_id);

-- User wallets policies
CREATE POLICY "Users can view their own wallet" ON public.user_wallets FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "System can manage wallets" ON public.user_wallets FOR ALL USING (auth.jwt() ->> 'role' = 'service_role');

-- Health data policies
CREATE POLICY "Users can manage their own health data" ON public.raw_health_data FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "Users can view their own staged health data" ON public.staged_health_data FOR SELECT USING (
  EXISTS (SELECT 1 FROM public.raw_health_data WHERE id = staged_health_data.raw_data_id AND user_id = auth.uid())
);
CREATE POLICY "Users can manage their own staged data" ON public.staged_data FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "Users can view their own health metrics" ON public.health_metrics FOR ALL USING (auth.uid() = user_id);

-- Rewards and transactions policies
CREATE POLICY "Users can view their own rewards" ON public.rewards FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can view their own transactions" ON public.transactions FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can view their own impacts" ON public.virtuous_cycle_impacts FOR SELECT USING (auth.uid() = user_id);

-- Governance policies
CREATE POLICY "Everyone can view active proposals" ON public.governance_proposals FOR SELECT USING (true);
CREATE POLICY "Users can create proposals" ON public.governance_proposals FOR INSERT WITH CHECK (auth.uid() = created_by);
CREATE POLICY "Users can view all votes" ON public.governance_votes FOR SELECT USING (true);
CREATE POLICY "Users can vote on proposals" ON public.governance_votes FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Create indexes for performance
CREATE INDEX idx_raw_health_data_user_id ON public.raw_health_data(user_id);
CREATE INDEX idx_raw_health_data_processed ON public.raw_health_data(processed);
CREATE INDEX idx_staged_data_user_id ON public.staged_data(user_id);
CREATE INDEX idx_staged_data_processed ON public.staged_data(processed);
CREATE INDEX idx_health_metrics_user_date ON public.health_metrics(user_id, recorded_date);
CREATE INDEX idx_rewards_user_id ON public.rewards(user_id);
CREATE INDEX idx_transactions_user_id ON public.transactions(user_id);

-- Create functions for automation
CREATE OR REPLACE FUNCTION public.generate_pseudonym()
RETURNS TEXT AS $$
BEGIN
  RETURN 'ANON_' || substr(md5(random()::text), 1, 12);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION public.anonymize_location()
RETURNS TEXT AS $$
DECLARE
  zones TEXT[] := ARRAY['ZONE_A', 'ZONE_B', 'ZONE_C', 'ZONE_D', 'ZONE_E'];
BEGIN
  RETURN zones[floor(random() * array_length(zones, 1) + 1)];
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to handle new user registration
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  -- Create profile
  INSERT INTO public.profiles (id, username, display_name)
  VALUES (
    NEW.id,
    NEW.raw_user_meta_data ->> 'username',
    NEW.raw_user_meta_data ->> 'display_name'
  );
  
  -- Create wallet
  INSERT INTO public.user_wallets (user_id)
  VALUES (NEW.id);
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger for new user setup
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Function to trigger IDIA Synapse orchestration
CREATE OR REPLACE FUNCTION public.trigger_idia_synapse_orchestration()
RETURNS TRIGGER AS $$
BEGIN
  PERFORM net.http_post(
    url := 'https://qltkclkghtziwipwxxxm.supabase.co/functions/v1/idia-synapse',
    headers := '{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFsdGtjbGtnaHR6aXdpcHd4eHhtIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTIzMDkzNTgsImV4cCI6MjA2Nzg4NTM1OH0.J3R68H8LkBTyX8qu7WPg37rTOjI1Jt56zX-MHkRt7VU"}'::jsonb,
    body := json_build_object(
      'raw_data_id', NEW.id,
      'orchestration_mode', true
    )::jsonb
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger for health data processing
DROP TRIGGER IF EXISTS trigger_health_data_processing ON public.raw_health_data;
CREATE TRIGGER trigger_health_data_processing
  AFTER INSERT ON public.raw_health_data
  FOR EACH ROW EXECUTE FUNCTION public.trigger_idia_synapse_orchestration();

-- Function to update timestamps
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Add timestamp triggers
CREATE TRIGGER update_profiles_updated_at BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_user_connections_updated_at BEFORE UPDATE ON public.user_connections FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_user_wallets_updated_at BEFORE UPDATE ON public.user_wallets FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();