-- Focus modes table for labeled focus profiles
CREATE TABLE public.focus_modes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  label TEXT NOT NULL,
  quiet_hours_start TEXT NOT NULL DEFAULT '22:00',
  quiet_hours_end TEXT NOT NULL DEFAULT '08:00',
  is_active BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.focus_modes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users select own focus modes" ON public.focus_modes
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users insert own focus modes" ON public.focus_modes
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users update own focus modes" ON public.focus_modes
  FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users delete own focus modes" ON public.focus_modes
  FOR DELETE USING (auth.uid() = user_id);

CREATE UNIQUE INDEX focus_modes_one_active_per_user
  ON public.focus_modes (user_id) WHERE is_active = true;

CREATE TRIGGER update_focus_modes_updated_at
  BEFORE UPDATE ON public.focus_modes
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Push tokens table
CREATE TABLE public.push_tokens (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  token TEXT NOT NULL,
  platform TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE (user_id, token)
);

ALTER TABLE public.push_tokens ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users select own push tokens" ON public.push_tokens
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users insert own push tokens" ON public.push_tokens
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users update own push tokens" ON public.push_tokens
  FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users delete own push tokens" ON public.push_tokens
  FOR DELETE USING (auth.uid() = user_id);

CREATE TRIGGER update_push_tokens_updated_at
  BEFORE UPDATE ON public.push_tokens
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();