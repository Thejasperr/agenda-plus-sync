-- Garantir REPLICA IDENTITY FULL para que UPDATEs enviem o registro completo via Realtime
ALTER TABLE public.agendamentos REPLICA IDENTITY FULL;
ALTER TABLE public.transacoes REPLICA IDENTITY FULL;
ALTER TABLE public.clientes REPLICA IDENTITY FULL;

-- Adicionar tabelas à publicação supabase_realtime para que mudanças sejam transmitidas em tempo real
ALTER PUBLICATION supabase_realtime ADD TABLE public.agendamentos;
ALTER PUBLICATION supabase_realtime ADD TABLE public.transacoes;
ALTER PUBLICATION supabase_realtime ADD TABLE public.clientes;