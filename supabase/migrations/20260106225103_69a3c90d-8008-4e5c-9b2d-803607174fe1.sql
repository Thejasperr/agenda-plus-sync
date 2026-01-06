-- Criar tabela de procedimentos de spa
CREATE TABLE public.spas_procedimentos (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID DEFAULT auth.uid(),
  nome TEXT NOT NULL,
  descricao TEXT,
  duracao_minutos INTEGER DEFAULT 30,
  valor NUMERIC,
  ativo BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable Row Level Security
ALTER TABLE public.spas_procedimentos ENABLE ROW LEVEL SECURITY;

-- Create policies for user access
CREATE POLICY "Users can only view their own spas_procedimentos" 
ON public.spas_procedimentos 
FOR SELECT 
USING (auth.uid() = user_id);

CREATE POLICY "Users can only insert their own spas_procedimentos" 
ON public.spas_procedimentos 
FOR INSERT 
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can only update their own spas_procedimentos" 
ON public.spas_procedimentos 
FOR UPDATE 
USING (auth.uid() = user_id);

CREATE POLICY "Users can only delete their own spas_procedimentos" 
ON public.spas_procedimentos 
FOR DELETE 
USING (auth.uid() = user_id);

-- Adicionar coluna de procedimento na tabela de assinaturas
ALTER TABLE public.spas_assinaturas 
ADD COLUMN procedimento_id UUID REFERENCES public.spas_procedimentos(id);

-- Trigger para updated_at
CREATE TRIGGER update_spas_procedimentos_updated_at
BEFORE UPDATE ON public.spas_procedimentos
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();