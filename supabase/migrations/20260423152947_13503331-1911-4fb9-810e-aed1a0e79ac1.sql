-- Tabela de reações
CREATE TABLE public.whatsapp_reactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL DEFAULT auth.uid(),
  chat_id UUID NOT NULL,
  message_id TEXT NOT NULL,
  reactor_jid TEXT NOT NULL,
  from_me BOOLEAN NOT NULL DEFAULT false,
  emoji TEXT,
  timestamp TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, message_id, reactor_jid)
);

CREATE INDEX idx_whatsapp_reactions_message ON public.whatsapp_reactions(user_id, message_id);
CREATE INDEX idx_whatsapp_reactions_chat ON public.whatsapp_reactions(chat_id);

ALTER TABLE public.whatsapp_reactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role manages reactions"
ON public.whatsapp_reactions FOR ALL
TO service_role USING (true) WITH CHECK (true);

CREATE POLICY "Users select own reactions"
ON public.whatsapp_reactions FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users insert own reactions"
ON public.whatsapp_reactions FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users update own reactions"
ON public.whatsapp_reactions FOR UPDATE
USING (auth.uid() = user_id);

CREATE POLICY "Users delete own reactions"
ON public.whatsapp_reactions FOR DELETE
USING (auth.uid() = user_id);

CREATE TRIGGER update_whatsapp_reactions_updated_at
BEFORE UPDATE ON public.whatsapp_reactions
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Realtime
ALTER TABLE public.whatsapp_reactions REPLICA IDENTITY FULL;
ALTER PUBLICATION supabase_realtime ADD TABLE public.whatsapp_reactions;