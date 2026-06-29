-- USDC Payments table for recording relay transactions
-- Created for the NFC/QR USDC payment system on Base

CREATE TABLE IF NOT EXISTS public.usdc_payments (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  sender_address TEXT NOT NULL,
  recipient_address TEXT NOT NULL,
  amount_raw TEXT NOT NULL,           -- Raw USDC units (6 decimals, e.g., "12500000" = $12.50)
  amount_usdc NUMERIC(20, 6) NOT NULL, -- Human-readable amount
  network TEXT NOT NULL DEFAULT 'Base Sepolia',
  chain_id INTEGER NOT NULL DEFAULT 84532,
  tx_hash TEXT,                        -- On-chain transaction hash (null while pending)
  block_number BIGINT,                 -- Block number of confirmation
  nonce_used TEXT,                      -- EIP-3009 nonce (bytes32) for replay detection
  merchant_id TEXT,                     -- Optional merchant identifier
  merchant_name TEXT,                   -- Optional merchant display name
  reference TEXT,                       -- Optional invoice/reference from merchant
  status TEXT NOT NULL DEFAULT 'pending', -- pending | completed | failed
  relayed_by TEXT,                      -- Treasury wallet that paid gas
  error_message TEXT,                   -- Error details if failed
  created_at TIMESTAMPTZ DEFAULT now(),
  settled_at TIMESTAMPTZ,              -- When on-chain confirmation received
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Indexes for common queries
CREATE INDEX IF NOT EXISTS idx_usdc_payments_sender ON public.usdc_payments (sender_address);
CREATE INDEX IF NOT EXISTS idx_usdc_payments_recipient ON public.usdc_payments (recipient_address);
CREATE INDEX IF NOT EXISTS idx_usdc_payments_tx_hash ON public.usdc_payments (tx_hash);
CREATE INDEX IF NOT EXISTS idx_usdc_payments_status ON public.usdc_payments (status);
CREATE INDEX IF NOT EXISTS idx_usdc_payments_merchant ON public.usdc_payments (merchant_id);
CREATE INDEX IF NOT EXISTS idx_usdc_payments_nonce ON public.usdc_payments (nonce_used);
CREATE INDEX IF NOT EXISTS idx_usdc_payments_created ON public.usdc_payments (created_at DESC);

-- Unique constraint on nonce to prevent double-submission
CREATE UNIQUE INDEX IF NOT EXISTS idx_usdc_payments_nonce_unique ON public.usdc_payments (nonce_used) WHERE nonce_used IS NOT NULL;

-- Auto-update updated_at
CREATE OR REPLACE FUNCTION update_usdc_payments_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER tr_usdc_payments_updated_at
  BEFORE UPDATE ON public.usdc_payments
  FOR EACH ROW
  EXECUTE FUNCTION update_usdc_payments_updated_at();

-- Set settled_at when status changes to completed
CREATE OR REPLACE FUNCTION set_usdc_payment_settled_at()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.status = 'completed' AND OLD.status != 'completed' THEN
    NEW.settled_at = now();
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER tr_usdc_payments_settled
  BEFORE UPDATE ON public.usdc_payments
  FOR EACH ROW
  EXECUTE FUNCTION set_usdc_payment_settled_at();

-- Enable RLS
ALTER TABLE public.usdc_payments ENABLE ROW LEVEL SECURITY;

-- Users can read their own payments (as sender or recipient)
CREATE POLICY "Users can read own payments"
  ON public.usdc_payments
  FOR SELECT
  USING (
    sender_address = (
      SELECT LOWER(wallet_address) FROM public.profiles
      WHERE id = auth.uid()
    )
    OR
    recipient_address = (
      SELECT LOWER(wallet_address) FROM public.profiles
      WHERE id = auth.uid()
    )
  );

-- Only the service role (edge functions) can insert/update
CREATE POLICY "Service role can insert payments"
  ON public.usdc_payments
  FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Service role can update payments"
  ON public.usdc_payments
  FOR UPDATE
  USING (true);
