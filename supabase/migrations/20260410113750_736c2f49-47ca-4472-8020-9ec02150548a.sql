
-- Add categoria column to servicos
ALTER TABLE public.servicos ADD COLUMN categoria text NOT NULL DEFAULT 'adulto';

-- Create pacotes table
CREATE TABLE public.pacotes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID DEFAULT auth.uid(),
  nome TEXT NOT NULL,
  descricao TEXT,
  valor_total NUMERIC NOT NULL,
  ativo BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.pacotes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can only view their own pacotes" ON public.pacotes FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can only insert their own pacotes" ON public.pacotes FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can only update their own pacotes" ON public.pacotes FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can only delete their own pacotes" ON public.pacotes FOR DELETE USING (auth.uid() = user_id);

CREATE TRIGGER update_pacotes_updated_at BEFORE UPDATE ON public.pacotes FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Create pacote_servicos junction table
CREATE TABLE public.pacote_servicos (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID DEFAULT auth.uid(),
  pacote_id UUID NOT NULL REFERENCES public.pacotes(id) ON DELETE CASCADE,
  servico_id UUID NOT NULL REFERENCES public.servicos(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.pacote_servicos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can only view their own pacote_servicos" ON public.pacote_servicos FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can only insert their own pacote_servicos" ON public.pacote_servicos FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can only update their own pacote_servicos" ON public.pacote_servicos FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can only delete their own pacote_servicos" ON public.pacote_servicos FOR DELETE USING (auth.uid() = user_id);
