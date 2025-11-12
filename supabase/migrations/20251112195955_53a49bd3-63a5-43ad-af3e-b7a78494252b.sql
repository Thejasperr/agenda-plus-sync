-- Adicionar campos para pagamento antecipado na tabela agendamentos
ALTER TABLE public.agendamentos 
ADD COLUMN IF NOT EXISTS pagamento_antecipado boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS porcentagem_pagamento_antecipado numeric;