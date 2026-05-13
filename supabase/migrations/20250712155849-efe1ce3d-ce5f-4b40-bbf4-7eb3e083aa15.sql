-- Deactivate duplicate Apple Health connections for each user, keeping only the most recent one
WITH ranked_connections AS (
  SELECT id, user_id, connection_type, created_at,
         ROW_NUMBER() OVER (PARTITION BY user_id, connection_type ORDER BY created_at DESC) as rn
  FROM data_connections 
  WHERE connection_type = 'apple_health' AND is_active = true
)
UPDATE data_connections 
SET is_active = false 
WHERE id IN (
  SELECT id FROM ranked_connections WHERE rn > 1
);

-- Also deactivate all test Strava connections with 'test_access_token'
UPDATE data_connections 
SET is_active = false 
WHERE connection_type = 'strava' AND access_token = 'test_access_token';