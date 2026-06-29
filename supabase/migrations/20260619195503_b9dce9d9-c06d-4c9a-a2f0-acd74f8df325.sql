CREATE TABLE public.wallet_provisioning_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  wallet_address text NOT NULL UNIQUE,
  tx_hash text NOT NULL,
  amount_eth text NOT NULL,
  status text NOT NULL DEFAULT 'broadcasted',
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.wallet_provisioning_logs TO authenticated;
GRANT ALL ON public.wallet_provisioning_logs TO service_role;
ALTER TABLE public.wallet_provisioning_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "service role manages drips" ON public.wallet_provisioning_logs
  FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE INDEX idx_wallet_provisioning_logs_address ON public.wallet_provisioning_logs(wallet_address);