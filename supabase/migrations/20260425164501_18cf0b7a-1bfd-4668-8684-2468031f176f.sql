
ALTER TABLE public.disparos_massa_config
  ADD COLUMN IF NOT EXISTS delay_min integer NOT NULL DEFAULT 5,
  ADD COLUMN IF NOT EXISTS delay_max integer NOT NULL DEFAULT 15;

-- Índice para selecionar pendentes rapidamente
CREATE INDEX IF NOT EXISTS idx_dm_envios_disparo_status
  ON public.disparos_massa_envios (disparo_id, status);

-- Índice para histórico de variações já enviadas a um cliente
CREATE INDEX IF NOT EXISTS idx_dm_envios_cliente_variacao
  ON public.disparos_massa_envios (user_id, cliente_id, variacao_id)
  WHERE status = 'enviado';
