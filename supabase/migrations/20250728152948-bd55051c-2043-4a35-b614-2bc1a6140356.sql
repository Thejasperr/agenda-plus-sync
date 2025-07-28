-- Criar tabela de transações
CREATE TABLE public.transacoes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tipo TEXT NOT NULL,
  data_transacao DATE NOT NULL DEFAULT CURRENT_DATE,
  tipo_operacao TEXT NOT NULL CHECK (tipo_operacao IN ('entrada', 'saida')),
  valor NUMERIC NOT NULL,
  agendamento_id UUID REFERENCES agendamentos(id),
  observacoes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Habilitar RLS
ALTER TABLE public.transacoes ENABLE ROW LEVEL SECURITY;

-- Criar política de acesso total
CREATE POLICY "Permitir acesso total a transacoes" 
ON public.transacoes 
FOR ALL 
USING (true);

-- Trigger para atualizar updated_at
CREATE TRIGGER update_transacoes_updated_at
  BEFORE UPDATE ON public.transacoes
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Função para criar transação automática quando agendamento for concluído
CREATE OR REPLACE FUNCTION public.criar_transacao_agendamento()
RETURNS TRIGGER AS $$
BEGIN
  -- Se o status mudou para 'Concluído' e não era 'Concluído' antes
  IF NEW.status = 'Concluído' AND (OLD.status IS NULL OR OLD.status != 'Concluído') THEN
    -- Calcular o valor final com desconto se houver
    DECLARE
      valor_final NUMERIC;
    BEGIN
      IF NEW.tem_desconto AND NEW.porcentagem_desconto IS NOT NULL THEN
        valor_final := NEW.preco * (1 - NEW.porcentagem_desconto / 100);
      ELSE
        valor_final := NEW.preco;
      END IF;
      
      -- Inserir transação de entrada
      INSERT INTO public.transacoes (
        tipo,
        data_transacao,
        tipo_operacao,
        valor,
        agendamento_id,
        observacoes
      ) VALUES (
        'Serviço',
        NEW.data_agendamento,
        'entrada',
        valor_final,
        NEW.id,
        'Receita de agendamento - ' || NEW.nome
      );
    END;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Criar trigger para executar a função
CREATE TRIGGER trigger_criar_transacao_agendamento
  AFTER UPDATE ON public.agendamentos
  FOR EACH ROW
  EXECUTE FUNCTION public.criar_transacao_agendamento();