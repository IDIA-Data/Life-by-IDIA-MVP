
-- Create transactions table to store real transaction history
CREATE TABLE public.transactions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users NOT NULL,
  transaction_type TEXT NOT NULL, -- 'data_earnings', 'payment_sent', 'payment_received', 'payroll', etc.
  amount DECIMAL(10,2) NOT NULL,
  description TEXT NOT NULL,
  source TEXT, -- e.g., 'Nike Run Club - Fitness Analytics', 'Coffee Shop Downtown'
  status TEXT DEFAULT 'completed', -- 'pending', 'completed', 'failed'
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Add Row Level Security
ALTER TABLE public.transactions ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for transactions
CREATE POLICY "Users can view their own transactions" 
  ON public.transactions 
  FOR SELECT 
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own transactions" 
  ON public.transactions 
  FOR INSERT 
  WITH CHECK (auth.uid() = user_id);

-- Create index for better performance when querying user transactions
CREATE INDEX idx_transactions_user_id_created_at ON public.transactions(user_id, created_at DESC);
