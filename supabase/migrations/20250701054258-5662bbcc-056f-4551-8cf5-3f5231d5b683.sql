
-- Create data_connections table to track user's connected data sources
CREATE TABLE public.data_connections (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users NOT NULL,
  connection_type TEXT NOT NULL, -- 'strava', 'nike', etc.
  connection_name TEXT NOT NULL,
  access_token TEXT, -- encrypted access token
  refresh_token TEXT, -- encrypted refresh token
  token_expires_at TIMESTAMP WITH TIME ZONE,
  is_active BOOLEAN DEFAULT true,
  last_sync_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create user_wallets table to manage IDIA-USD balances
CREATE TABLE public.user_wallets (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users NOT NULL UNIQUE,
  idia_usd_balance DECIMAL(12,2) DEFAULT 0.00,
  total_earned DECIMAL(12,2) DEFAULT 0.00,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create raw_strava_data table for incoming webhook data
CREATE TABLE public.raw_strava_data (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users NOT NULL,
  connection_id UUID REFERENCES public.data_connections NOT NULL,
  activity_id BIGINT NOT NULL,
  raw_data JSONB NOT NULL,
  processed BOOLEAN DEFAULT false,
  received_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create staged_data table for anonymized, processed data
CREATE TABLE public.staged_data (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users NOT NULL,
  raw_data_id UUID REFERENCES public.raw_strava_data NOT NULL,
  activity_type TEXT NOT NULL,
  duration_seconds INTEGER,
  distance_meters DECIMAL(10,2),
  elevation_gain_meters DECIMAL(8,2),
  average_heartrate INTEGER,
  max_heartrate INTEGER,
  average_speed_mps DECIMAL(6,3),
  max_speed_mps DECIMAL(6,3),
  effort_score INTEGER,
  anonymized_location_zone TEXT, -- general area, not exact GPS
  weather_conditions JSONB,
  device_type TEXT, -- generic device category
  processed_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  reward_calculated BOOLEAN DEFAULT false,
  reward_amount DECIMAL(10,2)
);

-- Add indexes for better performance
CREATE INDEX idx_data_connections_user_id ON public.data_connections(user_id);
CREATE INDEX idx_data_connections_type_active ON public.data_connections(connection_type, is_active);
CREATE INDEX idx_raw_strava_data_user_id ON public.raw_strava_data(user_id);
CREATE INDEX idx_raw_strava_data_processed ON public.raw_strava_data(processed);
CREATE INDEX idx_raw_strava_data_activity_id ON public.raw_strava_data(activity_id);
CREATE INDEX idx_staged_data_user_id ON public.staged_data(user_id);
CREATE INDEX idx_staged_data_reward_calculated ON public.staged_data(reward_calculated);
CREATE INDEX idx_user_wallets_user_id ON public.user_wallets(user_id);

-- Enable Row Level Security
ALTER TABLE public.data_connections ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_wallets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.raw_strava_data ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.staged_data ENABLE ROW LEVEL SECURITY;

-- RLS Policies for data_connections
CREATE POLICY "Users can view their own data connections" 
  ON public.data_connections FOR SELECT 
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own data connections" 
  ON public.data_connections FOR INSERT 
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own data connections" 
  ON public.data_connections FOR UPDATE 
  USING (auth.uid() = user_id);

-- RLS Policies for user_wallets
CREATE POLICY "Users can view their own wallet" 
  ON public.user_wallets FOR SELECT 
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own wallet" 
  ON public.user_wallets FOR INSERT 
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own wallet" 
  ON public.user_wallets FOR UPDATE 
  USING (auth.uid() = user_id);

-- RLS Policies for raw_strava_data
CREATE POLICY "Users can view their own raw data" 
  ON public.raw_strava_data FOR SELECT 
  USING (auth.uid() = user_id);

CREATE POLICY "System can insert raw data" 
  ON public.raw_strava_data FOR INSERT 
  WITH CHECK (true); -- Edge functions will handle this

-- RLS Policies for staged_data
CREATE POLICY "Users can view their own staged data" 
  ON public.staged_data FOR SELECT 
  USING (auth.uid() = user_id);

CREATE POLICY "System can insert staged data" 
  ON public.staged_data FOR INSERT 
  WITH CHECK (true); -- Edge functions will handle this

CREATE POLICY "System can update staged data" 
  ON public.staged_data FOR UPDATE 
  USING (true); -- Edge functions will handle this

-- Create PostgreSQL function for processing staged data
CREATE OR REPLACE FUNCTION public.process_staged_data()
RETURNS TRIGGER AS $$
DECLARE
  base_reward DECIMAL(10,2) := 0.50; -- Base reward in IDIA-USD
  quality_multiplier DECIMAL(3,2) := 1.0;
  uniqueness_bonus DECIMAL(10,2) := 0.0;
  final_reward DECIMAL(10,2);
BEGIN
  -- Calculate quality multiplier based on data completeness
  IF NEW.average_heartrate IS NOT NULL AND NEW.elevation_gain_meters IS NOT NULL THEN
    quality_multiplier := quality_multiplier + 0.3;
  END IF;
  
  IF NEW.weather_conditions IS NOT NULL THEN
    quality_multiplier := quality_multiplier + 0.2;
  END IF;
  
  -- Calculate uniqueness bonus for rare activity types
  IF NEW.activity_type IN ('TrailRun', 'Hike', 'RockClimbing', 'Skiing') THEN
    uniqueness_bonus := 0.25;
  ELSIF NEW.activity_type IN ('Swim', 'Bike', 'CrossCountrySkiing') THEN
    uniqueness_bonus := 0.15;
  END IF;
  
  -- Calculate final reward
  final_reward := (base_reward * quality_multiplier) + uniqueness_bonus;
  
  -- Cap maximum reward per activity
  IF final_reward > 2.00 THEN
    final_reward := 2.00;
  END IF;
  
  -- Update the staged_data record with calculated reward
  UPDATE public.staged_data 
  SET 
    reward_amount = final_reward,
    reward_calculated = true
  WHERE id = NEW.id;
  
  -- Call edge function to credit user wallet
  PERFORM net.http_post(
    url := 'https://zxyngqciipcvveigrzqt.supabase.co/functions/v1/credit-user-wallet',
    headers := '{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inp4eW5ncWNpaXBjdnZlaWdyenF0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTEzMjIwNzYsImV4cCI6MjA2Njg5ODA3Nn0.w-fUxBsH8wZ5ewzQkGAO6sEooqPEYbYJI_vL5F36HSU"}'::jsonb,
    body := json_build_object(
      'user_id', NEW.user_id,
      'reward_amount', final_reward,
      'staged_data_id', NEW.id
    )::text
  );
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger for processing staged data
CREATE TRIGGER process_staged_data_trigger
  AFTER INSERT ON public.staged_data
  FOR EACH ROW
  EXECUTE FUNCTION public.process_staged_data();

-- Enable pg_net extension for HTTP requests from triggers
CREATE EXTENSION IF NOT EXISTS pg_net;
