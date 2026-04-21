-- ============= WhatsApp Chats Table =============
CREATE TABLE public.whatsapp_chats (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL DEFAULT auth.uid(),
  remote_jid TEXT NOT NULL,
  telefone TEXT NOT NULL,
  nome TEXT NOT NULL,
  cliente_id UUID REFERENCES public.clientes(id) ON DELETE SET NULL,
  profile_pic_url TEXT,
  last_message TEXT,
  last_message_at TIMESTAMP WITH TIME ZONE,
  unread_count INTEGER NOT NULL DEFAULT 0,
  archived BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE (user_id, remote_jid)
);

ALTER TABLE public.whatsapp_chats ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users select own chats" ON public.whatsapp_chats FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users insert own chats" ON public.whatsapp_chats FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users update own chats" ON public.whatsapp_chats FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users delete own chats" ON public.whatsapp_chats FOR DELETE USING (auth.uid() = user_id);
CREATE POLICY "Service role manages chats" ON public.whatsapp_chats FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE INDEX idx_whatsapp_chats_user_lastmsg ON public.whatsapp_chats(user_id, last_message_at DESC NULLS LAST);
CREATE INDEX idx_whatsapp_chats_remote_jid ON public.whatsapp_chats(user_id, remote_jid);

CREATE TRIGGER update_whatsapp_chats_updated_at
BEFORE UPDATE ON public.whatsapp_chats
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============= WhatsApp Messages Table =============
CREATE TABLE public.whatsapp_messages (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL DEFAULT auth.uid(),
  chat_id UUID NOT NULL REFERENCES public.whatsapp_chats(id) ON DELETE CASCADE,
  remote_jid TEXT NOT NULL,
  message_id TEXT,
  from_me BOOLEAN NOT NULL DEFAULT false,
  message_type TEXT NOT NULL DEFAULT 'text',
  content TEXT,
  media_url TEXT,
  media_mime_type TEXT,
  media_filename TEXT,
  media_duration INTEGER,
  caption TEXT,
  quoted_message_id TEXT,
  status TEXT NOT NULL DEFAULT 'sent',
  timestamp TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  raw_data JSONB,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE (user_id, message_id)
);

ALTER TABLE public.whatsapp_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users select own messages" ON public.whatsapp_messages FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users insert own messages" ON public.whatsapp_messages FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users update own messages" ON public.whatsapp_messages FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users delete own messages" ON public.whatsapp_messages FOR DELETE USING (auth.uid() = user_id);
CREATE POLICY "Service role manages messages" ON public.whatsapp_messages FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE INDEX idx_whatsapp_messages_chat_ts ON public.whatsapp_messages(chat_id, timestamp DESC);
CREATE INDEX idx_whatsapp_messages_user_jid ON public.whatsapp_messages(user_id, remote_jid);

-- Realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.whatsapp_messages;
ALTER PUBLICATION supabase_realtime ADD TABLE public.whatsapp_chats;
ALTER TABLE public.whatsapp_messages REPLICA IDENTITY FULL;
ALTER TABLE public.whatsapp_chats REPLICA IDENTITY FULL;

-- ============= Storage Bucket =============
INSERT INTO storage.buckets (id, name, public)
VALUES ('whatsapp-media', 'whatsapp-media', false)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Users read own whatsapp media"
ON storage.objects FOR SELECT
USING (bucket_id = 'whatsapp-media' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users insert own whatsapp media"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'whatsapp-media' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users update own whatsapp media"
ON storage.objects FOR UPDATE
USING (bucket_id = 'whatsapp-media' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users delete own whatsapp media"
ON storage.objects FOR DELETE
USING (bucket_id = 'whatsapp-media' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Service role manages whatsapp media"
ON storage.objects FOR ALL TO service_role
USING (bucket_id = 'whatsapp-media') WITH CHECK (bucket_id = 'whatsapp-media');