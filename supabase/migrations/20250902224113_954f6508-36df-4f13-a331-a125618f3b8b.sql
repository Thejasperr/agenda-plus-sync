-- Drop existing overly permissive RLS policies
DROP POLICY IF EXISTS "Permitir acesso total a agendamentos" ON public.agendamentos;
DROP POLICY IF EXISTS "Permitir acesso total a clientes" ON public.clientes;
DROP POLICY IF EXISTS "Permitir acesso total a estoque" ON public.estoque;
DROP POLICY IF EXISTS "Permitir acesso total a servicos" ON public.servicos;
DROP POLICY IF EXISTS "Permitir acesso total a transacoes" ON public.transacoes;

-- Create secure RLS policies for agendamentos table
CREATE POLICY "Authenticated users can view agendamentos"
ON public.agendamentos FOR SELECT
USING (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can insert agendamentos"
ON public.agendamentos FOR INSERT
WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can update agendamentos"
ON public.agendamentos FOR UPDATE
USING (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can delete agendamentos"
ON public.agendamentos FOR DELETE
USING (auth.uid() IS NOT NULL);

-- Create secure RLS policies for clientes table
CREATE POLICY "Authenticated users can view clientes"
ON public.clientes FOR SELECT
USING (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can insert clientes"
ON public.clientes FOR INSERT
WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can update clientes"
ON public.clientes FOR UPDATE
USING (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can delete clientes"
ON public.clientes FOR DELETE
USING (auth.uid() IS NOT NULL);

-- Create secure RLS policies for estoque table
CREATE POLICY "Authenticated users can view estoque"
ON public.estoque FOR SELECT
USING (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can insert estoque"
ON public.estoque FOR INSERT
WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can update estoque"
ON public.estoque FOR UPDATE
USING (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can delete estoque"
ON public.estoque FOR DELETE
USING (auth.uid() IS NOT NULL);

-- Create secure RLS policies for servicos table
CREATE POLICY "Authenticated users can view servicos"
ON public.servicos FOR SELECT
USING (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can insert servicos"
ON public.servicos FOR INSERT
WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can update servicos"
ON public.servicos FOR UPDATE
USING (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can delete servicos"
ON public.servicos FOR DELETE
USING (auth.uid() IS NOT NULL);

-- Create secure RLS policies for transacoes table
CREATE POLICY "Authenticated users can view transacoes"
ON public.transacoes FOR SELECT
USING (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can insert transacoes"
ON public.transacoes FOR INSERT
WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can update transacoes"
ON public.transacoes FOR UPDATE
USING (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can delete transacoes"
ON public.transacoes FOR DELETE
USING (auth.uid() IS NOT NULL);