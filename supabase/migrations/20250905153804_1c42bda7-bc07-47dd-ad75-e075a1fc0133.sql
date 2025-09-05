-- Adicionar campo forma_pagamento na tabela agendamentos
ALTER TABLE public.agendamentos 
ADD COLUMN forma_pagamento TEXT;

-- Criar tabela formas_pagamento
CREATE TABLE public.formas_pagamento (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  nome TEXT NOT NULL,
  ativa BOOLEAN NOT NULL DEFAULT true,
  qr_code_pix TEXT,
  user_id UUID DEFAULT auth.uid(),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.formas_pagamento ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can only view their own formas_pagamento"
ON public.formas_pagamento 
FOR SELECT 
USING (auth.uid() = user_id);

CREATE POLICY "Users can only insert their own formas_pagamento"
ON public.formas_pagamento 
FOR INSERT 
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can only update their own formas_pagamento"
ON public.formas_pagamento 
FOR UPDATE 
USING (auth.uid() = user_id);

CREATE POLICY "Users can only delete their own formas_pagamento"
ON public.formas_pagamento 
FOR DELETE 
USING (auth.uid() = user_id);

-- Trigger para updated_at
CREATE TRIGGER update_formas_pagamento_updated_at
  BEFORE UPDATE ON public.formas_pagamento
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();