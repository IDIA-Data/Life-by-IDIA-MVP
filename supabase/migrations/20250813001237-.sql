-- Fix wallet balance inconsistencies by updating to match actual transaction totals
UPDATE user_wallets 
SET total_earned = COALESCE((
  SELECT SUM(amount) 
  FROM transactions 
  WHERE transactions.user_id = user_wallets.user_id 
    AND transaction_type = 'reward'
), 0)
WHERE EXISTS (
  SELECT 1 FROM (
    SELECT 
      uw.user_id,
      uw.total_earned,
      COALESCE(SUM(t.amount), 0) as transaction_total
    FROM user_wallets uw
    LEFT JOIN transactions t ON t.user_id = uw.user_id AND t.transaction_type = 'reward'
    GROUP BY uw.user_id, uw.total_earned
    HAVING uw.total_earned != COALESCE(SUM(t.amount), 0)
  ) inconsistent_wallets
  WHERE inconsistent_wallets.user_id = user_wallets.user_id
);