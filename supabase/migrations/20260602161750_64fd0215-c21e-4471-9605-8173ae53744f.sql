GRANT SELECT ON public.dao_treasury_flows TO anon, authenticated;
GRANT ALL ON public.dao_treasury_flows TO service_role;

GRANT SELECT ON public.dao_msa_metrics TO anon, authenticated;
GRANT ALL ON public.dao_msa_metrics TO service_role;

GRANT SELECT, INSERT, UPDATE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;

DROP VIEW IF EXISTS public.member_wallet_directory;

CREATE VIEW public.member_wallet_directory
WITH (security_invoker = off) AS
  SELECT user_id, wallet_address
  FROM public.profiles
  WHERE wallet_address IS NOT NULL;

GRANT SELECT ON public.member_wallet_directory TO authenticated;