CREATE TABLE public.insights_cache (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  tier TEXT NOT NULL CHECK (tier IN ('pro','pro_plus','pure_alpha')),
  payload JSONB NOT NULL,
  source_hash TEXT NOT NULL,
  model TEXT NOT NULL,
  generated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, tier, source_hash)
);

CREATE INDEX idx_insights_cache_user_tier_generated
  ON public.insights_cache (user_id, tier, generated_at DESC);

GRANT SELECT ON public.insights_cache TO authenticated;
GRANT ALL ON public.insights_cache TO service_role;

ALTER TABLE public.insights_cache ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users read own insights"
  ON public.insights_cache FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Service role manages insights"
  ON public.insights_cache FOR ALL
  TO service_role
  USING (true) WITH CHECK (true);

CREATE TRIGGER update_insights_cache_updated_at
  BEFORE UPDATE ON public.insights_cache
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();