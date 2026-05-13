ALTER TABLE public.account_conversion_requests ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can submit their own conversion requests"
  ON public.account_conversion_requests;
CREATE POLICY "Users can submit their own conversion requests"
  ON public.account_conversion_requests
  FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "Users can view their own conversion requests"
  ON public.account_conversion_requests;
CREATE POLICY "Users can view their own conversion requests"
  ON public.account_conversion_requests
  FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());