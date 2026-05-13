-- Remove the overly permissive public read policy that exposes all users' health data
DROP POLICY IF EXISTS "Allow public read access to raw health data for dashboard" ON public.raw_health_data;

-- Remove the redundant/duplicate user policy (keep the cleaner one)
DROP POLICY IF EXISTS "Users can view their own raw health data v2" ON public.raw_health_data;

-- Ensure the correct user-scoped SELECT policy exists
DROP POLICY IF EXISTS "Users can view their own raw health data" ON public.raw_health_data;
CREATE POLICY "Users can view their own raw health data"
  ON public.raw_health_data
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);