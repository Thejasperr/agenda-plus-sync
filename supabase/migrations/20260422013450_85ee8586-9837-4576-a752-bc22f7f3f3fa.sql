CREATE TABLE public.disparos_massa_config (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL DEFAULT auth.uid() UNIQUE,
  webhook_url TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.disparos_massa_config ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own disparos_massa_config"
  ON public.disparos_massa_config FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own disparos_massa_config"
  ON public.disparos_massa_config FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own disparos_massa_config"
  ON public.disparos_massa_config FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own disparos_massa_config"
  ON public.disparos_massa_config FOR DELETE
  USING (auth.uid() = user_id);

CREATE POLICY "Service role manages disparos_massa_config"
  ON public.disparos_massa_config FOR ALL
  TO service_role
  USING (true) WITH CHECK (true);

CREATE TRIGGER update_disparos_massa_config_updated_at
  BEFORE UPDATE ON public.disparos_massa_config
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();