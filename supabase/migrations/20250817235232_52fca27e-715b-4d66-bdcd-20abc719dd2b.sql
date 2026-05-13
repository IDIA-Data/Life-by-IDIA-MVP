-- Update total_earned to match current idia_usd_balance for existing users
UPDATE user_wallets 
SET total_earned = idia_usd_balance 
WHERE total_earned = 0 AND idia_usd_balance > 0;