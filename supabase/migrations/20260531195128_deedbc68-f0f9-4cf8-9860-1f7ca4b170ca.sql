-- Surgical purge of ghost dao_votes rows: off-chain intents inserted before
-- the chain-first refactor. These rows never landed on-chain (verified via
-- the live quorum logs showing forVotes=0 despite local "Voted FOR" state).
-- The biometric audit trail remains in user_aca_records — only the misleading
-- vote mirror is removed.
DELETE FROM public.dao_votes
WHERE proposal_ref IN (
  '',
  '11168644930714049645777079474563135834733570213886366841417644580910460450902',
  '113327313993728144652475928955112649854282118619292437473738087171957298494433',
  '4053374574738306206206836087761024395635812829057442115694208910164746350566',
  '8904442147255339241361713020670938230321302538115584754944681155728897401039'
);