
-- Create a table for storing user proposals
CREATE TABLE public.user_proposals (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users NOT NULL,
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  category TEXT NOT NULL,
  suggested_impact TEXT NOT NULL DEFAULT 'Medium',
  ai_validation_score NUMERIC DEFAULT NULL,
  ai_validation_feedback TEXT DEFAULT NULL,
  status TEXT NOT NULL DEFAULT 'pending_validation',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Add Row Level Security (RLS)
ALTER TABLE public.user_proposals ENABLE ROW LEVEL SECURITY;

-- Create policies for user proposals
CREATE POLICY "Users can view all proposals" 
  ON public.user_proposals 
  FOR SELECT 
  USING (true);

CREATE POLICY "Users can create their own proposals" 
  ON public.user_proposals 
  FOR INSERT 
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own proposals" 
  ON public.user_proposals 
  FOR UPDATE 
  USING (auth.uid() = user_id);

-- Create a table for password reset tokens
CREATE TABLE public.password_reset_tokens (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users NOT NULL,
  token TEXT NOT NULL UNIQUE,
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
  used BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Add Row Level Security for password reset tokens
ALTER TABLE public.password_reset_tokens ENABLE ROW LEVEL SECURITY;

-- Only allow system access to password reset tokens
CREATE POLICY "System can manage password reset tokens" 
  ON public.password_reset_tokens 
  FOR ALL 
  USING (false);
