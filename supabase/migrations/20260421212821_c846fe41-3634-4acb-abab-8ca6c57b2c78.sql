UPDATE public.agendamentos
SET status = 'Concluído',
    updated_at = now()
WHERE data_agendamento < CURRENT_DATE
  AND status NOT IN ('Concluído', 'Cancelado');