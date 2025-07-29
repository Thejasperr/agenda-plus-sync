-- Remover constraint de status que está causando erro
ALTER TABLE agendamentos DROP CONSTRAINT IF EXISTS agendamentos_status_check;

-- Adicionar constraint correta para status
ALTER TABLE agendamentos ADD CONSTRAINT agendamentos_status_check 
  CHECK (status IN ('Agendado', 'Concluído', 'Cancelado'));