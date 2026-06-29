ALTER TABLE public.dao_proposals
  ADD COLUMN IF NOT EXISTS proposal_targets text[],
  ADD COLUMN IF NOT EXISTS proposal_values text[],
  ADD COLUMN IF NOT EXISTS proposal_calldatas text[];