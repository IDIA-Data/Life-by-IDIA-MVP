-- Phase 1: Enable pg_net extension for database triggers to make HTTP calls
-- This is critical for the trigger_idia_synapse_orchestration function to work
CREATE EXTENSION IF NOT EXISTS pg_net;