CREATE TABLE public.evolution_config (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL UNIQUE,
  api_url TEXT NOT NULL,
  instance_name TEXT NOT NULL,
  api_key TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.evolution_config ENABLE ROW LEVEL SECURITY;

CREATE POLICY "own select" ON public.evolution_config FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "own insert" ON public.evolution_config FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "own update" ON public.evolution_config FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "own delete" ON public.evolution_config FOR DELETE USING (auth.uid() = user_id);

CREATE TRIGGER trg_evolution_config_updated
BEFORE UPDATE ON public.evolution_config
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();