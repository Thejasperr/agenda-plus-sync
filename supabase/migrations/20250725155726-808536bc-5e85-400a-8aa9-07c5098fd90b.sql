-- Criar tabela de Clientes
CREATE TABLE public.clientes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  nome TEXT NOT NULL,
  telefone TEXT NOT NULL UNIQUE,
  ultimo_atendimento TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Criar tabela de Serviços
CREATE TABLE public.servicos (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  nome_procedimento TEXT NOT NULL,
  valor DECIMAL(10,2) NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Criar tabela de Agendamentos
CREATE TABLE public.agendamentos (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  nome TEXT NOT NULL,
  telefone TEXT NOT NULL,
  procedimento_id UUID REFERENCES public.servicos(id),
  preco DECIMAL(10,2) NOT NULL,
  tem_desconto BOOLEAN DEFAULT FALSE,
  porcentagem_desconto DECIMAL(5,2),
  data_agendamento DATE NOT NULL,
  hora_agendamento TIME NOT NULL,
  tem_retorno BOOLEAN DEFAULT FALSE,
  data_retorno TIMESTAMP WITH TIME ZONE,
  preco_retorno DECIMAL(10,2),
  status TEXT NOT NULL DEFAULT 'A fazer' CHECK (status IN ('A fazer', 'Concluído', 'Cancelado')),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Criar tabela de Estoque
CREATE TABLE public.estoque (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  nome_item TEXT NOT NULL,
  quantidade INTEGER NOT NULL DEFAULT 0,
  categoria TEXT,
  observacoes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Habilitar RLS em todas as tabelas
ALTER TABLE public.clientes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.servicos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.agendamentos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.estoque ENABLE ROW LEVEL SECURITY;

-- Criar políticas RLS (para acesso público por enquanto, mas preparado para autenticação futura)
CREATE POLICY "Permitir acesso total a clientes" ON public.clientes FOR ALL USING (true);
CREATE POLICY "Permitir acesso total a servicos" ON public.servicos FOR ALL USING (true);
CREATE POLICY "Permitir acesso total a agendamentos" ON public.agendamentos FOR ALL USING (true);
CREATE POLICY "Permitir acesso total a estoque" ON public.estoque FOR ALL USING (true);

-- Função para atualizar updated_at automaticamente
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Triggers para atualização automática de timestamps
CREATE TRIGGER update_clientes_updated_at
  BEFORE UPDATE ON public.clientes
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_servicos_updated_at
  BEFORE UPDATE ON public.servicos
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_agendamentos_updated_at
  BEFORE UPDATE ON public.agendamentos
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_estoque_updated_at
  BEFORE UPDATE ON public.estoque
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Inserir alguns serviços padrão
INSERT INTO public.servicos (nome_procedimento, valor) VALUES
  ('Corte Masculino', 30.00),
  ('Corte Feminino', 45.00),
  ('Barba', 20.00),
  ('Escova', 25.00),
  ('Coloração', 80.00),
  ('Manicure', 15.00),
  ('Pedicure', 20.00);