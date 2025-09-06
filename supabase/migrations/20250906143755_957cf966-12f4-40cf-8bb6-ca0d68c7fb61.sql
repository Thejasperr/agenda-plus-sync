-- Atualizar o trigger para incluir a forma de pagamento na transação
CREATE OR REPLACE FUNCTION public.criar_transacao_agendamento()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  -- Se o status mudou para 'Concluído' e não era 'Concluído' antes
  IF NEW.status = 'Concluído' AND (OLD.status IS NULL OR OLD.status != 'Concluído') THEN
    -- Calcular o valor final com desconto se houver
    DECLARE
      valor_final NUMERIC;
      nome_procedimento TEXT := '';
    BEGIN
      IF NEW.tem_desconto AND NEW.porcentagem_desconto IS NOT NULL THEN
        valor_final := NEW.preco * (1 - NEW.porcentagem_desconto / 100);
      ELSE
        valor_final := NEW.preco;
      END IF;
      
      -- Buscar o nome do procedimento se existe
      IF NEW.procedimento_id IS NOT NULL THEN
        SELECT s.nome_procedimento INTO nome_procedimento
        FROM public.servicos s
        WHERE s.id = NEW.procedimento_id;
      END IF;
      
      -- Verificar se já existe uma transação para este agendamento
      IF NOT EXISTS (
        SELECT 1 FROM public.transacoes 
        WHERE agendamento_id = NEW.id
      ) THEN
        -- Inserir transação de entrada com user_id e forma de pagamento
        INSERT INTO public.transacoes (
          tipo,
          data_transacao,
          tipo_operacao,
          valor,
          agendamento_id,
          user_id,
          forma_pagamento,
          observacoes
        ) VALUES (
          'Serviço',
          NEW.data_agendamento,
          'entrada',
          valor_final,
          NEW.id,
          NEW.user_id,
          NEW.forma_pagamento,
          'Receita de agendamento - ' || NEW.nome || 
          CASE 
            WHEN nome_procedimento != '' THEN ' - Procedimento: ' || nome_procedimento
            ELSE ''
          END
        );
      END IF;
    END;
  END IF;
  
  RETURN NEW;
END;
$function$