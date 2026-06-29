
ALTER TABLE public.dao_pending_actions
  ADD COLUMN IF NOT EXISTS tx_hash text,
  ADD COLUMN IF NOT EXISTS processed_at timestamptz,
  ADD COLUMN IF NOT EXISTS onchain_proposal_id bigint,
  ADD COLUMN IF NOT EXISTS escrow_target text;
