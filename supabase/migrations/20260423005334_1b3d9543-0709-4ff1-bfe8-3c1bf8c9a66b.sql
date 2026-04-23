-- 1. Adicionar colunas de mídia em disparos_massa
ALTER TABLE public.disparos_massa
  ADD COLUMN IF NOT EXISTS media_url text,
  ADD COLUMN IF NOT EXISTS media_type text,
  ADD COLUMN IF NOT EXISTS media_mime text,
  ADD COLUMN IF NOT EXISTS media_filename text,
  ADD COLUMN IF NOT EXISTS total_destinatarios integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS total_enviados integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS total_falhas integer NOT NULL DEFAULT 0;

-- 2. Tabela de envios individuais (1 linha por cliente do disparo)
CREATE TABLE IF NOT EXISTS public.disparos_massa_envios (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  disparo_id uuid NOT NULL REFERENCES public.disparos_massa(id) ON DELETE CASCADE,
  user_id uuid NOT NULL DEFAULT auth.uid(),
  cliente_id uuid,
  cliente_nome text NOT NULL,
  telefone text NOT NULL,
  variacao_id uuid,
  mensagem_enviada text,
  status text NOT NULL DEFAULT 'pendente', -- pendente | enviado | falha
  erro text,
  enviado_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_disparos_massa_envios_disparo ON public.disparos_massa_envios(disparo_id);
CREATE INDEX IF NOT EXISTS idx_disparos_massa_envios_user ON public.disparos_massa_envios(user_id);

ALTER TABLE public.disparos_massa_envios ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own envios" ON public.disparos_massa_envios
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users insert own envios" ON public.disparos_massa_envios
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users update own envios" ON public.disparos_massa_envios
  FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users delete own envios" ON public.disparos_massa_envios
  FOR DELETE USING (auth.uid() = user_id);
CREATE POLICY "Service role manages envios" ON public.disparos_massa_envios
  FOR ALL USING (true) WITH CHECK (true);

CREATE TRIGGER update_disparos_massa_envios_updated_at
  BEFORE UPDATE ON public.disparos_massa_envios
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Realtime
ALTER TABLE public.disparos_massa_envios REPLICA IDENTITY FULL;
ALTER TABLE public.disparos_massa REPLICA IDENTITY FULL;
ALTER PUBLICATION supabase_realtime ADD TABLE public.disparos_massa_envios;

-- 3. Bucket público para mídia dos disparos
INSERT INTO storage.buckets (id, name, public)
VALUES ('disparos-massa-media', 'disparos-massa-media', true)
ON CONFLICT (id) DO NOTHING;

-- Policies do bucket
CREATE POLICY "Disparos media public read"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'disparos-massa-media');

CREATE POLICY "Users upload own disparo media"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'disparos-massa-media'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

CREATE POLICY "Users update own disparo media"
  ON storage.objects FOR UPDATE
  USING (
    bucket_id = 'disparos-massa-media'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

CREATE POLICY "Users delete own disparo media"
  ON storage.objects FOR DELETE
  USING (
    bucket_id = 'disparos-massa-media'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );