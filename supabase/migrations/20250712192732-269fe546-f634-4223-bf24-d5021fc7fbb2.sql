-- Fix the foreign key constraint issue in staged_health_data
-- Remove the problematic foreign key constraint that only references raw_strava_data
-- This allows staged_health_data to reference different raw data sources

-- Drop the existing foreign key constraint
ALTER TABLE public.staged_health_data 
DROP CONSTRAINT IF EXISTS staged_health_data_raw_data_id_fkey;

-- The raw_data_id column will now be a generic UUID that can reference 
-- different source tables (raw_health_data, raw_strava_data, etc.)
-- We'll maintain data integrity through application logic instead