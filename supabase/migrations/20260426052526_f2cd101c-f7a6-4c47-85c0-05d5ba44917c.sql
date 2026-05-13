-- Redirect all legacy functions from user_wallets → wallets (sole authority)

CREATE OR REPLACE FUNCTION public.community_pool_ledger(p_fiat_amount numeric, p_pseudo_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
BEGIN
  UPDATE public.wallets
  SET 
    cash_balance = COALESCE(cash_balance, 0) + p_fiat_amount,
    total_earned = COALESCE(total_earned, 0) + p_fiat_amount,
    updated_at = now()
  WHERE platform_guid = p_pseudo_id;

  INSERT INTO public.transactions (user_id, transaction_type, amount, description, source)
  VALUES (p_pseudo_id, 'earn', p_fiat_amount, 'Synapse Data Yield (30%)', 'fbo_dissemination');
END;
$function$;

CREATE OR REPLACE FUNCTION public.increment_wallet_cash(p_user_id uuid, p_amount numeric)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
BEGIN
  INSERT INTO public.wallets (user_id, cash_balance, total_earned)
  VALUES (p_user_id, p_amount, p_amount)
  ON CONFLICT (user_id) DO UPDATE SET
    cash_balance = COALESCE(public.wallets.cash_balance, 0) + EXCLUDED.cash_balance,
    total_earned = COALESCE(public.wallets.total_earned, 0) + EXCLUDED.total_earned,
    updated_at = now();
END;
$function$;

CREATE OR REPLACE FUNCTION public.increment_idia_life_balance(p_fiat_amount numeric, p_pseudo_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
BEGIN
  UPDATE public.wallets
  SET 
    cash_balance = COALESCE(cash_balance, 0) + p_fiat_amount,
    total_earned = COALESCE(total_earned, 0) + p_fiat_amount,
    updated_at = now()
  WHERE platform_guid = p_pseudo_id OR user_id = p_pseudo_id;
END;
$function$;

CREATE OR REPLACE FUNCTION public.distribute_data_royalty(p_user_id uuid, p_amount numeric, p_description text, p_metadata jsonb)
 RETURNS numeric
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE
    v_new_balance NUMERIC;
BEGIN
    INSERT INTO public.wallets (user_id, cash_balance, total_earned, updated_at)
    VALUES (p_user_id, p_amount, p_amount, NOW())
    ON CONFLICT (user_id)
    DO UPDATE SET 
        cash_balance = COALESCE(public.wallets.cash_balance, 0) + p_amount,
        total_earned = COALESCE(public.wallets.total_earned, 0) + p_amount,
        updated_at = NOW()
    RETURNING cash_balance INTO v_new_balance;

    INSERT INTO public.transactions (
        user_id, transaction_type, amount, description, source, status, metadata
    ) VALUES (
        p_user_id, 'earn', p_amount, p_description, 'idia_hub_data_sale', 'completed', p_metadata
    );

    RETURN v_new_balance;
END;
$function$;

-- Drop the legacy table if it ever resurfaces (idempotent)
DROP TABLE IF EXISTS public.user_wallets CASCADE;