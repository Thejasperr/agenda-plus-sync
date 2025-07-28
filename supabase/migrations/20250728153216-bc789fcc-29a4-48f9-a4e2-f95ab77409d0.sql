-- Corrigir função com search_path seguro
CREATE OR REPLACE FUNCTION public.criar_transacao_agendamento()
RETURNS TRIGGER 
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
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
$$;