
ALTER TABLE public.dao_proposals
  ADD COLUMN IF NOT EXISTS committee_id text,
  ADD COLUMN IF NOT EXISTS author_id uuid,
  ADD COLUMN IF NOT EXISTS aca_hash_key text,
  ADD COLUMN IF NOT EXISTS aca_payload jsonb;

CREATE INDEX IF NOT EXISTS idx_dao_proposals_committee_id
  ON public.dao_proposals(committee_id);
CREATE INDEX IF NOT EXISTS idx_dao_proposals_author_id
  ON public.dao_proposals(author_id);
