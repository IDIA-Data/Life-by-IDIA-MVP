-- Clean up duplicate Apple Health connections for each user, keeping only the most recent one
WITH duplicates AS (
  SELECT id, user_id, connection_type,
         ROW_NUMBER() OVER (PARTITION BY user_id, connection_type ORDER BY created_at DESC) as rn
  FROM data_connections 
  WHERE connection_type IN ('apple_health', 'strava')
)
DELETE FROM data_connections 
WHERE id IN (
  SELECT id FROM duplicates WHERE rn > 1
);

-- Add unique constraint to prevent future duplicates
ALTER TABLE data_connections 
ADD CONSTRAINT unique_user_connection_type 
UNIQUE (user_id, connection_type);