-- Fix inconsistent raw_health_data processing status
UPDATE raw_health_data 
SET 
  processing_status = 'completed',
  processed = true,
  processing_completed_at = COALESCE(processing_completed_at, NOW())
WHERE processed = true AND processing_status = 'pending';

-- Reset any stuck processing records
UPDATE raw_health_data 
SET 
  processing_status = 'pending',
  processing_started_at = NULL,
  processed = false
WHERE processing_status = 'processing' 
  AND processing_started_at < NOW() - INTERVAL '10 minutes';