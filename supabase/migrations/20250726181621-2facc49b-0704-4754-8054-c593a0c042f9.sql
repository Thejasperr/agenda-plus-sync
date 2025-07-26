-- Adicionar campo de observações na tabela agendamentos
ALTER TABLE public.agendamentos 
ADD COLUMN observacoes TEXT;

-- Criar índice para melhor performance na busca por observações
CREATE INDEX idx_agendamentos_observacoes ON public.agendamentos USING gin(to_tsvector('portuguese', observacoes));