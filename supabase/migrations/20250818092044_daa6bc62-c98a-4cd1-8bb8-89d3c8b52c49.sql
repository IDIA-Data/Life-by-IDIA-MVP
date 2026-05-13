-- Emergency repair: Process all raw health data that should have created staged_data
-- This fixes the payment pipeline break

-- First, let's see the scope of the problem
SELECT 
    rhd.id as raw_id,
    rhd.user_id,
    rhd.created_at,
    rhd.processed,
    rhd.processing_status,
    sd.id as staged_data_id
FROM raw_health_data rhd
LEFT JOIN staged_data sd ON sd.raw_data_id = rhd.id
WHERE rhd.created_at >= '2024-07-28'
    AND rhd.processed = true
    AND rhd.user_id IS NOT NULL
    AND sd.id IS NULL
ORDER BY rhd.created_at DESC
LIMIT 20;