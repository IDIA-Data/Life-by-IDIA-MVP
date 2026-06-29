CREATE POLICY "Proposer can delete own proposal if no votes"
ON public.dao_proposals
FOR DELETE
TO authenticated
USING (
  proposer_id = auth.uid()
  AND NOT EXISTS (SELECT 1 FROM public.dao_votes WHERE proposal_id = dao_proposals.id)
);