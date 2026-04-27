-- Função que mantém apenas as 500 mensagens mais recentes por usuário
CREATE OR REPLACE FUNCTION public.limitar_whatsapp_messages()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  DELETE FROM public.whatsapp_messages
  WHERE user_id = NEW.user_id
    AND id IN (
      SELECT id FROM public.whatsapp_messages
      WHERE user_id = NEW.user_id
      ORDER BY timestamp DESC, created_at DESC
      OFFSET 500
    );
  RETURN NEW;
END;
$$;

-- Trigger que executa após cada inserção
DROP TRIGGER IF EXISTS trg_limitar_whatsapp_messages ON public.whatsapp_messages;
CREATE TRIGGER trg_limitar_whatsapp_messages
AFTER INSERT ON public.whatsapp_messages
FOR EACH ROW
EXECUTE FUNCTION public.limitar_whatsapp_messages();

-- Índice para acelerar a ordenação por timestamp
CREATE INDEX IF NOT EXISTS idx_whatsapp_messages_user_timestamp
ON public.whatsapp_messages (user_id, timestamp DESC);