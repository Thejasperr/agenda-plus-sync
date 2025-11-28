-- Criar tabela de configurações PIX
CREATE TABLE IF NOT EXISTS public.configuracoes_pix (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users NOT NULL DEFAULT auth.uid(),
  tipo_chave TEXT NOT NULL CHECK (tipo_chave IN ('cpf', 'cnpj', 'email', 'telefone', 'aleatoria')),
  chave_pix TEXT NOT NULL,
  nome_recebedor TEXT NOT NULL,
  cidade TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(user_id)
);

-- Habilitar RLS
ALTER TABLE public.configuracoes_pix ENABLE ROW LEVEL SECURITY;

-- Políticas RLS
CREATE POLICY "Users can only view their own configuracoes_pix"
  ON public.configuracoes_pix
  FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can only insert their own configuracoes_pix"
  ON public.configuracoes_pix
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can only update their own configuracoes_pix"
  ON public.configuracoes_pix
  FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can only delete their own configuracoes_pix"
  ON public.configuracoes_pix
  FOR DELETE
  USING (auth.uid() = user_id);

-- Trigger para updated_at
CREATE TRIGGER update_configuracoes_pix_updated_at
  BEFORE UPDATE ON public.configuracoes_pix
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();