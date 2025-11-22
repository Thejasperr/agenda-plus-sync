-- Criar tabela para relacionar agendamentos com múltiplos procedimentos
CREATE TABLE IF NOT EXISTS public.agendamento_procedimentos (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  agendamento_id UUID NOT NULL REFERENCES public.agendamentos(id) ON DELETE CASCADE,
  procedimento_id UUID NOT NULL REFERENCES public.servicos(id) ON DELETE CASCADE,
  ordem INTEGER NOT NULL DEFAULT 1,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  user_id UUID REFERENCES auth.users(id) DEFAULT auth.uid()
);

-- Habilitar RLS
ALTER TABLE public.agendamento_procedimentos ENABLE ROW LEVEL SECURITY;

-- Políticas RLS
CREATE POLICY "Users can only view their own agendamento_procedimentos"
  ON public.agendamento_procedimentos
  FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can only insert their own agendamento_procedimentos"
  ON public.agendamento_procedimentos
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can only update their own agendamento_procedimentos"
  ON public.agendamento_procedimentos
  FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can only delete their own agendamento_procedimentos"
  ON public.agendamento_procedimentos
  FOR DELETE
  USING (auth.uid() = user_id);

-- Criar índice para melhor performance
CREATE INDEX idx_agendamento_procedimentos_agendamento ON public.agendamento_procedimentos(agendamento_id);
CREATE INDEX idx_agendamento_procedimentos_user ON public.agendamento_procedimentos(user_id);

-- Migrar dados existentes (procedimentos únicos) para a nova tabela
INSERT INTO public.agendamento_procedimentos (agendamento_id, procedimento_id, ordem, user_id)
SELECT id, procedimento_id, 1, user_id
FROM public.agendamentos
WHERE procedimento_id IS NOT NULL;