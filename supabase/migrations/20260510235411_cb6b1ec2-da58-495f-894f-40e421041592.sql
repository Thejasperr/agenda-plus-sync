-- Add new columns to pacotes table
ALTER TABLE public.pacotes 
ADD COLUMN IF NOT EXISTS quantidade_sessoes INTEGER DEFAULT 1,
ADD COLUMN IF NOT EXISTS intervalo_dias INTEGER DEFAULT 0;

-- Create cliente_pacotes table
CREATE TABLE IF NOT EXISTS public.cliente_pacotes (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    cliente_id UUID REFERENCES public.clientes(id) ON DELETE CASCADE,
    pacote_id UUID REFERENCES public.pacotes(id) ON DELETE SET NULL,
    valor_pago NUMERIC(10, 2) NOT NULL DEFAULT 0,
    sessoes_totais INTEGER NOT NULL DEFAULT 1,
    sessoes_restantes INTEGER NOT NULL DEFAULT 1,
    status TEXT NOT NULL DEFAULT 'ativo' CHECK (status IN ('ativo', 'concluido', 'cancelado')),
    data_compra TIMESTAMP WITH TIME ZONE DEFAULT now(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Enable RLS for cliente_pacotes
ALTER TABLE public.cliente_pacotes ENABLE ROW LEVEL SECURITY;

-- Policies for cliente_pacotes
CREATE POLICY "Users can view their own client packages" 
ON public.cliente_pacotes FOR SELECT 
USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own client packages" 
ON public.cliente_pacotes FOR INSERT 
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own client packages" 
ON public.cliente_pacotes FOR UPDATE 
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own client packages" 
ON public.cliente_pacotes FOR DELETE 
USING (auth.uid() = user_id);

-- Add trigger for updated_at
CREATE TRIGGER update_cliente_pacotes_updated_at
BEFORE UPDATE ON public.cliente_pacotes
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Add columns to agendamentos to track package usage
ALTER TABLE public.agendamentos 
ADD COLUMN IF NOT EXISTS cliente_pacote_id UUID REFERENCES public.cliente_pacotes(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS sessao_numero INTEGER;
