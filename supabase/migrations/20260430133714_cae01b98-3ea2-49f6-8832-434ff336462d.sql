-- Phase 2: Connection ratings table (Zero-PII: only UUIDs + integer score)
CREATE TABLE IF NOT EXISTS public.connection_ratings (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  rater_id UUID NOT NULL,
  ratee_id UUID NOT NULL,
  stars INTEGER NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Stars must be 1..5 (validation trigger, not CHECK constraint per project rules)
CREATE OR REPLACE FUNCTION public.validate_connection_rating()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.stars < 1 OR NEW.stars > 5 THEN
    RAISE EXCEPTION 'Stars must be between 1 and 5';
  END IF;
  IF NEW.rater_id = NEW.ratee_id THEN
    RAISE EXCEPTION 'Cannot rate yourself';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_validate_connection_rating
BEFORE INSERT OR UPDATE ON public.connection_ratings
FOR EACH ROW EXECUTE FUNCTION public.validate_connection_rating();

CREATE INDEX IF NOT EXISTS idx_connection_ratings_ratee ON public.connection_ratings(ratee_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_connection_ratings_rater ON public.connection_ratings(rater_id, created_at DESC);

ALTER TABLE public.connection_ratings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can insert their own ratings"
ON public.connection_ratings FOR INSERT
WITH CHECK (auth.uid() = rater_id);

CREATE POLICY "Users can view ratings they gave"
ON public.connection_ratings FOR SELECT
USING (auth.uid() = rater_id);

CREATE POLICY "Users can view ratings they received"
ON public.connection_ratings FOR SELECT
USING (auth.uid() = ratee_id);

CREATE POLICY "Users can update their own ratings"
ON public.connection_ratings FOR UPDATE
USING (auth.uid() = rater_id);

-- Aggregate function for ratee to see average score safely
CREATE OR REPLACE FUNCTION public.get_average_rating(p_ratee_id UUID)
RETURNS NUMERIC
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(AVG(stars), 0)::NUMERIC FROM public.connection_ratings WHERE ratee_id = p_ratee_id;
$$;

-- Phase 3 prep: trust score history snapshots
CREATE TABLE IF NOT EXISTS public.trust_score_history (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  score INTEGER NOT NULL,
  recorded_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_trust_score_history_user ON public.trust_score_history(user_id, recorded_at DESC);

ALTER TABLE public.trust_score_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own score history"
ON public.trust_score_history FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own score snapshots"
ON public.trust_score_history FOR INSERT
WITH CHECK (auth.uid() = user_id);