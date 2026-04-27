CREATE OR REPLACE FUNCTION public.limitar_whatsapp_messages()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  DELETE FROM public.whatsapp_messages
  WHERE chat_id = NEW.chat_id
    AND id IN (
      SELECT id FROM public.whatsapp_messages
      WHERE chat_id = NEW.chat_id
      ORDER BY timestamp DESC, created_at DESC
      OFFSET 20
    );
  RETURN NEW;
END;
$$;

CREATE INDEX IF NOT EXISTS idx_whatsapp_messages_chat_timestamp
ON public.whatsapp_messages (chat_id, timestamp DESC);