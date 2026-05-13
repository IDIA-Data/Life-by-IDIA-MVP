-- PHASE 1: DATABASE OPERATION INTERCEPTION
-- Create universal database triggers to ensure ALL data flows through synapse

-- Trigger for user_proposals table
CREATE OR REPLACE FUNCTION public.trigger_proposal_synapse()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Send proposal data through synapse
  INSERT INTO public.device_events (
    user_id,
    event_type,
    data_category,
    json_payload,
    processing_status
  ) VALUES (
    NEW.user_id,
    'proposal_submission',
    'governance',
    jsonb_build_object(
      'proposal_id', NEW.id,
      'title', NEW.title,
      'description', NEW.description,
      'category', NEW.category,
      'suggested_impact', NEW.suggested_impact,
      'status', NEW.status
    ),
    'pending'
  );
  
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trigger_proposal_synapse ON public.user_proposals;
CREATE TRIGGER trigger_proposal_synapse
AFTER INSERT OR UPDATE ON public.user_proposals
FOR EACH ROW
EXECUTE FUNCTION public.trigger_proposal_synapse();

-- Trigger for data_connections table
CREATE OR REPLACE FUNCTION public.trigger_connection_synapse()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Send connection data through synapse
  INSERT INTO public.device_events (
    user_id,
    event_type,
    data_category,
    json_payload,
    processing_status
  ) VALUES (
    NEW.user_id,
    CASE 
      WHEN TG_OP = 'INSERT' THEN 'data_connection_created'
      WHEN TG_OP = 'UPDATE' THEN 'data_connection_updated'
      ELSE 'data_connection_modified'
    END,
    'data_integration',
    jsonb_build_object(
      'connection_id', NEW.id,
      'connection_type', NEW.connection_type,
      'connection_name', NEW.connection_name,
      'is_active', NEW.is_active,
      'last_sync_at', NEW.last_sync_at
    ),
    'pending'
  );
  
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trigger_connection_synapse ON public.data_connections;
CREATE TRIGGER trigger_connection_synapse
AFTER INSERT OR UPDATE ON public.data_connections
FOR EACH ROW
EXECUTE FUNCTION public.trigger_connection_synapse();

-- Trigger for user_votes table (create if not exists)
CREATE TABLE IF NOT EXISTS public.user_votes (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL,
  proposal_id uuid NOT NULL,
  vote_type text NOT NULL CHECK (vote_type IN ('for', 'against')),
  created_at timestamp with time zone DEFAULT now(),
  UNIQUE(user_id, proposal_id)
);

-- Enable RLS on user_votes
ALTER TABLE public.user_votes ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for user_votes
CREATE POLICY "Users can insert their own votes"
  ON public.user_votes FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can view their own votes"
  ON public.user_votes FOR SELECT
  USING (auth.uid() = user_id);

-- Trigger for user_votes table
CREATE OR REPLACE FUNCTION public.trigger_vote_synapse()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Send vote data through synapse
  INSERT INTO public.device_events (
    user_id,
    event_type,
    data_category,
    json_payload,
    processing_status
  ) VALUES (
    NEW.user_id,
    'vote_cast',
    'governance',
    jsonb_build_object(
      'vote_id', NEW.id,
      'proposal_id', NEW.proposal_id,
      'vote_type', NEW.vote_type
    ),
    'pending'
  );
  
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trigger_vote_synapse ON public.user_votes;
CREATE TRIGGER trigger_vote_synapse
AFTER INSERT ON public.user_votes
FOR EACH ROW
EXECUTE FUNCTION public.trigger_vote_synapse();

-- Trigger for profiles table to track profile changes
CREATE OR REPLACE FUNCTION public.trigger_profile_synapse()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Send profile data through synapse
  INSERT INTO public.device_events (
    user_id,
    event_type,
    data_category,
    json_payload,
    processing_status
  ) VALUES (
    NEW.user_id,
    CASE 
      WHEN TG_OP = 'INSERT' THEN 'profile_created'
      WHEN TG_OP = 'UPDATE' THEN 'profile_updated'
      ELSE 'profile_modified'
    END,
    'user_profile',
    jsonb_build_object(
      'profile_id', NEW.user_id,
      'first_name', NEW.first_name,
      'last_name', NEW.last_name,
      'avatar_url', NEW.avatar_url,
      'bio', NEW.bio
    ),
    'pending'
  );
  
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trigger_profile_synapse ON public.profiles;
CREATE TRIGGER trigger_profile_synapse
AFTER INSERT OR UPDATE ON public.profiles
FOR EACH ROW
EXECUTE FUNCTION public.trigger_profile_synapse();