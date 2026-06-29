-- Add canonical proposal reference accepting on-chain id or uuid
ALTER TABLE public.dao_votes ADD COLUMN IF NOT EXISTS proposal_ref text;

-- Backfill: prefer on_chain_id when the linked dao_proposals row has one
UPDATE public.dao_votes v
SET proposal_ref = COALESCE(p.on_chain_id, v.proposal_id::text)
FROM public.dao_proposals p
WHERE v.proposal_id = p.id AND v.proposal_ref IS NULL;

-- Catch any orphan rows
UPDATE public.dao_votes
SET proposal_ref = proposal_id::text
WHERE proposal_ref IS NULL AND proposal_id IS NOT NULL;

-- Enforce NOT NULL going forward
ALTER TABLE public.dao_votes ALTER COLUMN proposal_ref SET NOT NULL;

-- Allow legacy uuid column to be null for chain-only votes
ALTER TABLE public.dao_votes ALTER COLUMN proposal_id DROP NOT NULL;

-- Index for tally lookups
CREATE INDEX IF NOT EXISTS idx_dao_votes_proposal_ref ON public.dao_votes(proposal_ref);

-- Swap uniqueness from (proposal_id, user_id) -> (proposal_ref, user_id)
DO $$
DECLARE c text;
BEGIN
  FOR c IN
    SELECT conname FROM pg_constraint
    WHERE conrelid = 'public.dao_votes'::regclass
      AND contype = 'u'
      AND pg_get_constraintdef(oid) ILIKE '%(proposal_id, user_id)%'
  LOOP
    EXECUTE format('ALTER TABLE public.dao_votes DROP CONSTRAINT %I', c);
  END LOOP;
END $$;

ALTER TABLE public.dao_votes
  ADD CONSTRAINT dao_votes_ref_user_unique UNIQUE (proposal_ref, user_id);