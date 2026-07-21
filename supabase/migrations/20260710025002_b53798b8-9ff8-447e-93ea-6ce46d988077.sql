ALTER TABLE public.dao_pending_actions
ALTER COLUMN onchain_proposal_id TYPE text
USING onchain_proposal_id::text;