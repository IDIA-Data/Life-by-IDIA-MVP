-- Allow users to withdraw their own pending committee applications
CREATE POLICY "Users can update their own committee applications"
ON public.committee_applications
FOR UPDATE
TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- Allow users to revoke (resign) their own active DAO hats
CREATE POLICY "Users can revoke their own dao hats"
ON public.dao_hats
FOR UPDATE
TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);