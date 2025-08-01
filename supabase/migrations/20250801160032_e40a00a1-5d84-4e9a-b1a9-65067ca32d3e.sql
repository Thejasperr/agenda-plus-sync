-- Adicionar foreign key constraint com cascade delete para permitir exclusão de agendamentos
-- Primeiro, vamos remover a constraint existente
ALTER TABLE public.transacoes 
DROP CONSTRAINT IF EXISTS transacoes_agendamento_id_fkey;

-- Agora adicionar a nova constraint com ON DELETE CASCADE
ALTER TABLE public.transacoes 
ADD CONSTRAINT transacoes_agendamento_id_fkey 
FOREIGN KEY (agendamento_id) 
REFERENCES public.agendamentos(id) 
ON DELETE CASCADE;