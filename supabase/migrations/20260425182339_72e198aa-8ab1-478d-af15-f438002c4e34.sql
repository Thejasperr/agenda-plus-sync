ALTER TABLE public.disparos_massa
  ADD COLUMN IF NOT EXISTS iniciado_at timestamptz,
  ADD COLUMN IF NOT EXISTS finalizado_at timestamptz;

ALTER TABLE public.disparos_massa_testes
  ADD COLUMN IF NOT EXISTS iniciado_at timestamptz;