-- Remove dead pipeline health, diagnostics, recovery, backlog, and test functions from the database
DROP FUNCTION IF EXISTS public.check_pipeline_health() CASCADE;
DROP FUNCTION IF EXISTS public.check_health_data_pipeline_status() CASCADE;
DROP FUNCTION IF EXISTS public.process_backlog_data() CASCADE;
DROP FUNCTION IF EXISTS public.process_synapse_backlog() CASCADE;
DROP FUNCTION IF EXISTS public.recover_stuck_health_data() CASCADE;
DROP FUNCTION IF EXISTS public.recover_all_stuck_health_data() CASCADE;
DROP FUNCTION IF EXISTS public.cleanup_orphaned_queue_items() CASCADE;