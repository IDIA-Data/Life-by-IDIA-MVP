create or replace function public.governance_global_treasury_flows()
returns table (
  id uuid,
  entry_type text,
  amount numeric,
  description text,
  metadata jsonb,
  created_at timestamptz
)
language sql
stable
security definer
set search_path = public
as $$
  select id, entry_type, amount, description, metadata, created_at
  from public.synapse_credit_ledger
  where created_at >= now() - interval '30 days'
  order by created_at desc
  limit 1000
$$;

revoke all on function public.governance_global_treasury_flows() from public;
grant execute on function public.governance_global_treasury_flows() to authenticated;

create or replace function public.governance_global_egress_latency(p_since timestamptz)
returns table (
  id uuid,
  created_at timestamptz,
  settled_at timestamptz
)
language sql
stable
security definer
set search_path = public
as $$
  select id, created_at, settled_at
  from public.egress_logs
  where created_at >= p_since
    and settled_at is not null
  limit 1000
$$;

revoke all on function public.governance_global_egress_latency(timestamptz) from public;
grant execute on function public.governance_global_egress_latency(timestamptz) to authenticated;