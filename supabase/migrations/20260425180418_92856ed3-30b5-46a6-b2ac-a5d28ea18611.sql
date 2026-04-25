CREATE TABLE IF NOT EXISTS public.disparos_massa_testes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid(),
  disparo_id uuid NOT NULL,
  telefone_teste text NOT NULL,
  quantidade_total integer NOT NULL,
  enviadas integer NOT NULL DEFAULT 0,
  falhas integer NOT NULL DEFAULT 0,
  proximo_indice integer NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'pendente',
  ultimo_erro text,
  log_envios jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  finalizado_at timestamptz
);

ALTER TABLE public.disparos_massa_testes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own testes" ON public.disparos_massa_testes
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users insert own testes" ON public.disparos_massa_testes
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users update own testes" ON public.disparos_massa_testes
  FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users delete own testes" ON public.disparos_massa_testes
  FOR DELETE USING (auth.uid() = user_id);
CREATE POLICY "Service role manages testes" ON public.disparos_massa_testes
  FOR ALL USING (true) WITH CHECK (true);

CREATE INDEX IF NOT EXISTS idx_dm_testes_user_status ON public.disparos_massa_testes (user_id, status, created_at DESC);

CREATE TRIGGER update_disparos_massa_testes_updated_at
BEFORE UPDATE ON public.disparos_massa_testes
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();