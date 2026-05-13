-- Remove the problematic duplicate trigger on staged_data table
DROP TRIGGER IF EXISTS process_staged_data_trigger ON public.staged_data;

-- Verify our orchestration trigger is working correctly
-- (The trigger should already exist from previous migration, this just ensures it's clean)