
-- Execution Tracker: post-timelock lifecycle for approved proposals
CREATE TABLE public.dao_execution_tasks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  proposal_id uuid NOT NULL,
  onchain_proposal_id text,
  title text NOT NULL,
  category text,
  execution_deadline_at timestamptz,
  initial_deadline_at timestamptz,
  granted_extension_seconds bigint NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'ready',
  assignee_id uuid,
  execution_tx_hash text,
  failure_reason text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX dao_execution_tasks_proposal_uq ON public.dao_execution_tasks(proposal_id);

GRANT SELECT ON public.dao_execution_tasks TO authenticated;
GRANT ALL ON public.dao_execution_tasks TO service_role;
ALTER TABLE public.dao_execution_tasks ENABLE ROW LEVEL SECURITY;

-- All authenticated users may view the tracker
CREATE POLICY "Execution tasks viewable by authenticated"
  ON public.dao_execution_tasks FOR SELECT
  TO authenticated USING (true);

-- Writes go through the edge function (service role); block direct writes from clients.
-- (No INSERT/UPDATE/DELETE policies = denied for anon/authenticated.)

CREATE TABLE public.dao_execution_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id uuid NOT NULL REFERENCES public.dao_execution_tasks(id) ON DELETE CASCADE,
  actor_id uuid,
  event_type text NOT NULL,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX dao_execution_events_task_idx ON public.dao_execution_events(task_id, created_at DESC);

GRANT SELECT ON public.dao_execution_events TO authenticated;
GRANT ALL ON public.dao_execution_events TO service_role;
ALTER TABLE public.dao_execution_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Execution events viewable by authenticated"
  ON public.dao_execution_events FOR SELECT
  TO authenticated USING (true);

CREATE TABLE public.dao_execution_extensions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id uuid NOT NULL REFERENCES public.dao_execution_tasks(id) ON DELETE CASCADE,
  extension_proposal_id uuid,
  extension_onchain_id text,
  requested_seconds bigint NOT NULL,
  reason text NOT NULL,
  state text NOT NULL DEFAULT 'pending',
  created_at timestamptz NOT NULL DEFAULT now(),
  resolved_at timestamptz
);
CREATE INDEX dao_execution_extensions_task_idx ON public.dao_execution_extensions(task_id);

GRANT SELECT ON public.dao_execution_extensions TO authenticated;
GRANT ALL ON public.dao_execution_extensions TO service_role;
ALTER TABLE public.dao_execution_extensions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Execution extensions viewable by authenticated"
  ON public.dao_execution_extensions FOR SELECT
  TO authenticated USING (true);

-- updated_at trigger
CREATE OR REPLACE FUNCTION public.tg_dao_execution_tasks_touch()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;

CREATE TRIGGER dao_execution_tasks_touch
BEFORE UPDATE ON public.dao_execution_tasks
FOR EACH ROW EXECUTE FUNCTION public.tg_dao_execution_tasks_touch();
