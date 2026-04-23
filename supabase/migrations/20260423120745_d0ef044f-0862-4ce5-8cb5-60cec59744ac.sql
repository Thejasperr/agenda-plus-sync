-- Config: URL do webhook n8n para reestruturação de mensagens para grupos
CREATE TABLE public.grupos_mensagens_config (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL DEFAULT auth.uid(),
  webhook_url TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.grupos_mensagens_config ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own grupos_mensagens_config"
  ON public.grupos_mensagens_config FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users insert own grupos_mensagens_config"
  ON public.grupos_mensagens_config FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users update own grupos_mensagens_config"
  ON public.grupos_mensagens_config FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users delete own grupos_mensagens_config"
  ON public.grupos_mensagens_config FOR DELETE USING (auth.uid() = user_id);
CREATE POLICY "Service role manages grupos_mensagens_config"
  ON public.grupos_mensagens_config FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE TRIGGER grupos_mensagens_config_updated_at
  BEFORE UPDATE ON public.grupos_mensagens_config
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Histórico de mensagens reestruturadas
CREATE TABLE public.grupos_mensagens (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL DEFAULT auth.uid(),
  mensagem_original TEXT NOT NULL,
  mensagem_reestruturada TEXT,
  status TEXT NOT NULL DEFAULT 'gerando', -- gerando, pronto, enviando, enviado, erro
  erro TEXT,
  grupo_remote_jid TEXT,
  grupo_nome TEXT,
  enviado_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.grupos_mensagens ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own grupos_mensagens"
  ON public.grupos_mensagens FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users insert own grupos_mensagens"
  ON public.grupos_mensagens FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users update own grupos_mensagens"
  ON public.grupos_mensagens FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users delete own grupos_mensagens"
  ON public.grupos_mensagens FOR DELETE USING (auth.uid() = user_id);
CREATE POLICY "Service role manages grupos_mensagens"
  ON public.grupos_mensagens FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE TRIGGER grupos_mensagens_updated_at
  BEFORE UPDATE ON public.grupos_mensagens
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX idx_grupos_mensagens_user_created ON public.grupos_mensagens(user_id, created_at DESC);

-- Mídias anexadas (fotos/vídeos)
CREATE TABLE public.grupos_mensagens_midias (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL DEFAULT auth.uid(),
  mensagem_id UUID NOT NULL REFERENCES public.grupos_mensagens(id) ON DELETE CASCADE,
  media_type TEXT NOT NULL, -- image | video
  media_mime TEXT,
  media_url TEXT NOT NULL,
  media_filename TEXT,
  ordem INTEGER NOT NULL DEFAULT 1,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.grupos_mensagens_midias ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own grupos_mensagens_midias"
  ON public.grupos_mensagens_midias FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users insert own grupos_mensagens_midias"
  ON public.grupos_mensagens_midias FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users update own grupos_mensagens_midias"
  ON public.grupos_mensagens_midias FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users delete own grupos_mensagens_midias"
  ON public.grupos_mensagens_midias FOR DELETE USING (auth.uid() = user_id);
CREATE POLICY "Service role manages grupos_mensagens_midias"
  ON public.grupos_mensagens_midias FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE INDEX idx_grupos_mensagens_midias_msg ON public.grupos_mensagens_midias(mensagem_id, ordem);