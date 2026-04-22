-- Tabela principal de disparos em massa
CREATE TABLE public.disparos_massa (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL DEFAULT auth.uid(),
  mensagem_sugestao TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pendente',
  observacoes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.disparos_massa ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own disparos_massa"
  ON public.disparos_massa FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own disparos_massa"
  ON public.disparos_massa FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own disparos_massa"
  ON public.disparos_massa FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own disparos_massa"
  ON public.disparos_massa FOR DELETE
  USING (auth.uid() = user_id);

CREATE TRIGGER update_disparos_massa_updated_at
  BEFORE UPDATE ON public.disparos_massa
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Tabela das variações geradas pelo webhook
CREATE TABLE public.disparos_massa_variacoes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL DEFAULT auth.uid(),
  disparo_id UUID NOT NULL REFERENCES public.disparos_massa(id) ON DELETE CASCADE,
  estilo TEXT,
  mensagem TEXT NOT NULL,
  ordem INTEGER NOT NULL DEFAULT 1,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.disparos_massa_variacoes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own disparos_massa_variacoes"
  ON public.disparos_massa_variacoes FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Service role manages variacoes"
  ON public.disparos_massa_variacoes FOR ALL
  TO service_role
  USING (true) WITH CHECK (true);

CREATE POLICY "Users can insert their own disparos_massa_variacoes"
  ON public.disparos_massa_variacoes FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own disparos_massa_variacoes"
  ON public.disparos_massa_variacoes FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own disparos_massa_variacoes"
  ON public.disparos_massa_variacoes FOR DELETE
  USING (auth.uid() = user_id);

CREATE TRIGGER update_disparos_massa_variacoes_updated_at
  BEFORE UPDATE ON public.disparos_massa_variacoes
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX idx_disparos_massa_user ON public.disparos_massa(user_id, created_at DESC);
CREATE INDEX idx_disparos_variacoes_disparo ON public.disparos_massa_variacoes(disparo_id, ordem);