-- Habilitar realtime para tabelas de disparos
ALTER TABLE public.disparos_massa REPLICA IDENTITY FULL;
ALTER TABLE public.disparos_massa_envios REPLICA IDENTITY FULL;
ALTER TABLE public.disparos_massa_variacoes REPLICA IDENTITY FULL;

-- Adicionar à publicação realtime (ignora erro se já existir)
DO $$
BEGIN
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.disparos_massa;
  EXCEPTION WHEN duplicate_object THEN NULL;
  END;
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.disparos_massa_envios;
  EXCEPTION WHEN duplicate_object THEN NULL;
  END;
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.disparos_massa_variacoes;
  EXCEPTION WHEN duplicate_object THEN NULL;
  END;
END $$;