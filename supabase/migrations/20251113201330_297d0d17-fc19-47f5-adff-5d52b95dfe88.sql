-- Adicionar campo de observações à tabela clientes
ALTER TABLE public.clientes 
ADD COLUMN IF NOT EXISTS observacoes TEXT;