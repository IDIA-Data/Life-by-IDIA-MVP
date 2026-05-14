
-- 1. user_proposals RLS
ALTER TABLE public.user_proposals ENABLE ROW LEVEL SECURITY;

-- 2. dao_proposals public read
DROP POLICY IF EXISTS "Sovereigns can read all proposals" ON public.dao_proposals;
CREATE POLICY "Sovereigns can read all proposals"
  ON public.dao_proposals FOR SELECT USING (true);

-- 3. dao_votes activation
ALTER TABLE public.dao_votes
  ADD COLUMN IF NOT EXISTS vote_weight integer NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS aca_hash_key text,
  ADD COLUMN IF NOT EXISTS aca_payload jsonb;

ALTER TABLE public.dao_votes DROP CONSTRAINT IF EXISTS dao_votes_unique_per_user;
ALTER TABLE public.dao_votes ADD CONSTRAINT dao_votes_unique_per_user UNIQUE (proposal_id, user_id);

DROP POLICY IF EXISTS "Sovereigns insert their own votes via ACA" ON public.dao_votes;
CREATE POLICY "Sovereigns insert their own votes via ACA"
  ON public.dao_votes FOR INSERT
  WITH CHECK (auth.uid() = user_id AND aca_hash_key IS NOT NULL);

DROP POLICY IF EXISTS "Sovereigns can read all votes" ON public.dao_votes;
CREATE POLICY "Sovereigns can read all votes"
  ON public.dao_votes FOR SELECT USING (true);

-- 4. veto uniqueness
ALTER TABLE public.dao_vetoes DROP CONSTRAINT IF EXISTS dao_vetoes_unique_per_user;
ALTER TABLE public.dao_vetoes ADD CONSTRAINT dao_vetoes_unique_per_user UNIQUE (action_id, user_id);

-- 5. committee_applications discipline
UPDATE public.committee_applications SET status='pending' WHERE status IS NULL;
ALTER TABLE public.committee_applications
  ALTER COLUMN status SET DEFAULT 'pending',
  ALTER COLUMN status SET NOT NULL;
ALTER TABLE public.committee_applications DROP CONSTRAINT IF EXISTS committee_applications_status_check;
ALTER TABLE public.committee_applications
  ADD CONSTRAINT committee_applications_status_check
    CHECK (status IN ('pending','approved','rejected','withdrawn'));
CREATE UNIQUE INDEX IF NOT EXISTS committee_applications_unique_pending
  ON public.committee_applications (user_id, committee_id) WHERE status='pending';

-- 6. dao_hats helpers
ALTER TABLE public.dao_hats ADD COLUMN IF NOT EXISTS granted_at timestamptz NOT NULL DEFAULT now();

CREATE OR REPLACE FUNCTION public.has_hat(_user_id uuid, _hat_type text)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.dao_hats
    WHERE user_id=_user_id AND hat_type=_hat_type
      AND eligibility_status='active' AND revoked_at IS NULL);
$$;

CREATE OR REPLACE FUNCTION public.grant_hat(_target_user uuid, _hat_type text)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_id uuid;
BEGIN
  IF NOT public.has_hat(auth.uid(), 'tophat') THEN
    RAISE EXCEPTION 'NOT_AUTHORIZED: Only Tophat holders can grant hats.';
  END IF;
  IF _hat_type NOT IN ('tophat','security_council','product_xr','legal_defense','sociorelational') THEN
    RAISE EXCEPTION 'INVALID_HAT_TYPE';
  END IF;
  INSERT INTO public.dao_hats (user_id, hat_type, eligibility_status, granted_at)
  VALUES (_target_user, _hat_type, 'active', now())
  ON CONFLICT DO NOTHING RETURNING id INTO v_id;
  RETURN v_id;
END;$$;

-- 7. governance_tokens column
ALTER TABLE public.wallets ADD COLUMN IF NOT EXISTS governance_tokens numeric NOT NULL DEFAULT 0;

-- 8. Realtime
ALTER TABLE public.dao_pending_actions REPLICA IDENTITY FULL;
ALTER TABLE public.dao_proposals REPLICA IDENTITY FULL;
ALTER TABLE public.dao_msa_metrics REPLICA IDENTITY FULL;
ALTER TABLE public.dao_treasury_flows REPLICA IDENTITY FULL;
ALTER TABLE public.dao_votes REPLICA IDENTITY FULL;

DO $$ BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.dao_pending_actions;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.dao_proposals;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.dao_msa_metrics;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.dao_treasury_flows;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.dao_votes;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
