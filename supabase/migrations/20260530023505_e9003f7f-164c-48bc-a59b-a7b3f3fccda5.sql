CREATE POLICY "Oversight and tophat can read committee applications"
ON public.committee_applications
FOR SELECT
TO authenticated
USING (
  public.has_hat(auth.uid(), 'oversight_chair')
  OR public.has_hat(auth.uid(), 'tophat')
);