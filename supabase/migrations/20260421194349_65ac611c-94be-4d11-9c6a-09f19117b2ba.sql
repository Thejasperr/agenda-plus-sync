-- Tornar bucket público (apenas leitura)
UPDATE storage.buckets SET public = true WHERE id = 'whatsapp-media';

-- Policies de storage para whatsapp-media
DROP POLICY IF EXISTS "WhatsApp media public read" ON storage.objects;
CREATE POLICY "WhatsApp media public read"
ON storage.objects FOR SELECT
USING (bucket_id = 'whatsapp-media');

DROP POLICY IF EXISTS "Users upload own whatsapp media" ON storage.objects;
CREATE POLICY "Users upload own whatsapp media"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'whatsapp-media'
  AND (auth.uid()::text = (storage.foldername(name))[1] OR auth.role() = 'service_role')
);

DROP POLICY IF EXISTS "Users update own whatsapp media" ON storage.objects;
CREATE POLICY "Users update own whatsapp media"
ON storage.objects FOR UPDATE
USING (
  bucket_id = 'whatsapp-media'
  AND (auth.uid()::text = (storage.foldername(name))[1] OR auth.role() = 'service_role')
);

DROP POLICY IF EXISTS "Users delete own whatsapp media" ON storage.objects;
CREATE POLICY "Users delete own whatsapp media"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'whatsapp-media'
  AND (auth.uid()::text = (storage.foldername(name))[1] OR auth.role() = 'service_role')
);

-- Service role bypass para INSERT pelo webhook
DROP POLICY IF EXISTS "Service role insert whatsapp media" ON storage.objects;
CREATE POLICY "Service role insert whatsapp media"
ON storage.objects FOR INSERT
TO service_role
WITH CHECK (bucket_id = 'whatsapp-media');

-- Índices úteis
CREATE INDEX IF NOT EXISTS idx_whatsapp_chats_user_remote ON public.whatsapp_chats(user_id, remote_jid);
CREATE INDEX IF NOT EXISTS idx_whatsapp_chats_user_lastmsg ON public.whatsapp_chats(user_id, last_message_at DESC);
CREATE INDEX IF NOT EXISTS idx_whatsapp_messages_chat_ts ON public.whatsapp_messages(chat_id, timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_whatsapp_messages_msgid ON public.whatsapp_messages(message_id);

-- Realtime
ALTER TABLE public.whatsapp_chats REPLICA IDENTITY FULL;
ALTER TABLE public.whatsapp_messages REPLICA IDENTITY FULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND tablename = 'whatsapp_chats'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.whatsapp_chats;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND tablename = 'whatsapp_messages'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.whatsapp_messages;
  END IF;
END $$;