CREATE POLICY "Allow authenticated read access on api_metrics"
ON public.api_metrics
FOR SELECT
TO authenticated
USING (true);