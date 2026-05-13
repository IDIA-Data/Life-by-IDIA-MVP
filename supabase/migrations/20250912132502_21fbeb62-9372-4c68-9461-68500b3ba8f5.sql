-- Add calories_burned column to staged_data table for reward calculation
ALTER TABLE public.staged_data 
ADD COLUMN calories_burned INTEGER;