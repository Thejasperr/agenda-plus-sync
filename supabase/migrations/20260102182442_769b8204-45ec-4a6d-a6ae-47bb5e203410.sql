-- Criar tabela para assinaturas de Spa dos pés
CREATE TABLE public.spas_assinaturas (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  cliente_id uuid NOT NULL REFERENCES public.clientes(id) ON DELETE CASCADE,
  user_id uuid DEFAULT auth.uid(),
  data_inicio date NOT NULL DEFAULT CURRENT_DATE,
  dia_pagamento integer NOT NULL DEFAULT 1,
  valor_mensal numeric NOT NULL,
  ativa boolean NOT NULL DEFAULT true,
  observacoes text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE (cliente_id, user_id)
);

-- Criar tabela para sessões de Spa realizadas
CREATE TABLE public.spas_sessoes (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  assinatura_id uuid NOT NULL REFERENCES public.spas_assinaturas(id) ON DELETE CASCADE,
  user_id uuid DEFAULT auth.uid(),
  data_sessao date NOT NULL,
  hora_sessao time without time zone,
  realizada boolean NOT NULL DEFAULT false,
  observacoes text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Criar tabela para pagamentos de Spa
CREATE TABLE public.spas_pagamentos (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  assinatura_id uuid NOT NULL REFERENCES public.spas_assinaturas(id) ON DELETE CASCADE,
  user_id uuid DEFAULT auth.uid(),
  mes_referencia date NOT NULL,
  valor_pago numeric NOT NULL,
  data_pagamento date NOT NULL DEFAULT CURRENT_DATE,
  forma_pagamento text,
  pago boolean NOT NULL DEFAULT true,
  observacoes text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable RLS em todas as tabelas
ALTER TABLE public.spas_assinaturas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.spas_sessoes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.spas_pagamentos ENABLE ROW LEVEL SECURITY;

-- RLS policies para spas_assinaturas
CREATE POLICY "Users can only view their own spas_assinaturas" 
ON public.spas_assinaturas FOR SELECT 
USING (auth.uid() = user_id);

CREATE POLICY "Users can only insert their own spas_assinaturas" 
ON public.spas_assinaturas FOR INSERT 
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can only update their own spas_assinaturas" 
ON public.spas_assinaturas FOR UPDATE 
USING (auth.uid() = user_id);

CREATE POLICY "Users can only delete their own spas_assinaturas" 
ON public.spas_assinaturas FOR DELETE 
USING (auth.uid() = user_id);

-- RLS policies para spas_sessoes
CREATE POLICY "Users can only view their own spas_sessoes" 
ON public.spas_sessoes FOR SELECT 
USING (auth.uid() = user_id);

CREATE POLICY "Users can only insert their own spas_sessoes" 
ON public.spas_sessoes FOR INSERT 
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can only update their own spas_sessoes" 
ON public.spas_sessoes FOR UPDATE 
USING (auth.uid() = user_id);

CREATE POLICY "Users can only delete their own spas_sessoes" 
ON public.spas_sessoes FOR DELETE 
USING (auth.uid() = user_id);

-- RLS policies para spas_pagamentos
CREATE POLICY "Users can only view their own spas_pagamentos" 
ON public.spas_pagamentos FOR SELECT 
USING (auth.uid() = user_id);

CREATE POLICY "Users can only insert their own spas_pagamentos" 
ON public.spas_pagamentos FOR INSERT 
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can only update their own spas_pagamentos" 
ON public.spas_pagamentos FOR UPDATE 
USING (auth.uid() = user_id);

CREATE POLICY "Users can only delete their own spas_pagamentos" 
ON public.spas_pagamentos FOR DELETE 
USING (auth.uid() = user_id);

-- Trigger para updated_at
CREATE TRIGGER update_spas_assinaturas_updated_at
BEFORE UPDATE ON public.spas_assinaturas
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_spas_sessoes_updated_at
BEFORE UPDATE ON public.spas_sessoes
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_spas_pagamentos_updated_at
BEFORE UPDATE ON public.spas_pagamentos
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();