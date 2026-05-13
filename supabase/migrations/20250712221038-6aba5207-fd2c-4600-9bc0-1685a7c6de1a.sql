-- Fix wallet balances to show only earned amounts, removing hardcoded $100 initial balance
UPDATE user_wallets 
SET idia_usd_balance = total_earned
WHERE idia_usd_balance > total_earned;