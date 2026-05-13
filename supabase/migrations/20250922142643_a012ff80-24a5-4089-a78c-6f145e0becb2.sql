-- Create sync_logs table for monitoring daily sync operations
CREATE TABLE IF NOT EXISTS public.sync_logs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  sync_type TEXT NOT NULL,
  total_connections INTEGER NOT NULL DEFAULT 0,
  successful_syncs INTEGER NOT NULL DEFAULT 0,
  failed_syncs INTEGER NOT NULL DEFAULT 0,
  sync_results JSONB DEFAULT '[]'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS for sync_logs
ALTER TABLE public.sync_logs ENABLE ROW LEVEL SECURITY;

-- Create policy to allow authenticated users to view sync logs
CREATE POLICY "Allow authenticated read access to sync logs" 
ON public.sync_logs 
FOR SELECT 
USING (true);

-- Create policy for service role to manage sync logs
CREATE POLICY "Allow service role to manage sync logs" 
ON public.sync_logs 
FOR ALL 
USING (true)
WITH CHECK (true);

-- Add index for better performance on sync_logs
CREATE INDEX IF NOT EXISTS idx_sync_logs_created_at ON public.sync_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_sync_logs_sync_type ON public.sync_logs(sync_type);

-- Update data_connections table to track connection health
ALTER TABLE public.data_connections 
ADD COLUMN IF NOT EXISTS sync_failure_count INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS last_successful_sync TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS sync_status TEXT DEFAULT 'healthy';

-- Function to update connection health status
CREATE OR REPLACE FUNCTION public.update_connection_health()
RETURNS TRIGGER AS $$
BEGIN
  -- Update sync status based on failure count and last sync time
  IF NEW.sync_failure_count >= 3 THEN
    NEW.sync_status := 'failing';
  ELSIF NEW.sync_failure_count >= 7 THEN
    NEW.sync_status := 'disconnected';
  ELSIF NEW.last_sync_at IS NOT NULL AND NEW.last_sync_at > now() - INTERVAL '48 hours' THEN
    NEW.sync_status := 'healthy';
    NEW.sync_failure_count := 0;
  END IF;

  -- Track last successful sync
  IF NEW.last_sync_at > COALESCE(OLD.last_sync_at, '1970-01-01'::timestamp) THEN
    NEW.last_successful_sync := NEW.last_sync_at;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for connection health updates
DROP TRIGGER IF EXISTS trigger_update_connection_health ON public.data_connections;
CREATE TRIGGER trigger_update_connection_health
  BEFORE UPDATE ON public.data_connections
  FOR EACH ROW
  EXECUTE FUNCTION public.update_connection_health();