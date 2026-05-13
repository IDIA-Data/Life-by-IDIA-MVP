-- Add missing activity_type column to raw_health_data table
ALTER TABLE public.raw_health_data 
ADD COLUMN IF NOT EXISTS activity_type TEXT DEFAULT 'health_metrics';

-- Add index for better performance on activity_type queries
CREATE INDEX IF NOT EXISTS idx_raw_health_data_activity_type 
ON public.raw_health_data(activity_type);

-- Update any existing records to have a default activity_type
UPDATE public.raw_health_data 
SET activity_type = 'health_metrics' 
WHERE activity_type IS NULL;