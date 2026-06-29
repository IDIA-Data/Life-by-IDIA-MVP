UPDATE public.wallets 
SET wallet_address = profiles.wallet_address 
FROM public.profiles 
WHERE wallets.user_id = profiles.id 
  AND profiles.wallet_address IS NOT NULL 
  AND wallets.wallet_address IS DISTINCT FROM profiles.wallet_address;