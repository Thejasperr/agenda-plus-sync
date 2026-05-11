import React, { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Package, Trash2, CheckCircle2, AlertCircle } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface ClientePacote {
  id: string;
  cliente_id: string;
  pacote_id: string;
  sessoes_totais: number;
  sessoes_restantes: number;
  valor_pago: number;
  status: string;
  created_at: string;
  pacote?: {
    nome: string;
  };
}

interface ClientePacotesManagerProps {
  clienteId: string;
  onUpdate?: () => void;
}

export const ClientePacotesManager = ({ clienteId, onUpdate }: ClientePacotesManagerProps) => {
  const [pacotes, setPacotes] = useState<ClientePacote[]>([]);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  const fetchPacotes = async () => {
    try {
      const { data, error } = await supabase
        .from('cliente_pacotes')
        .select('*, pacote:pacotes(nome)')
        .eq('cliente_id', clienteId)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setPacotes(data || []);
    } catch (error: any) {
      console.error('Erro ao buscar pacotes do cliente:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (clienteId) fetchPacotes();
  }, [clienteId]);

  const handleDelete = async (id: string) => {
    if (!window.confirm('Tem certeza que deseja excluir este pacote do cliente?')) return;
    
    try {
      const { error } = await supabase
        .from('cliente_pacotes')
        .delete()
        .eq('id', id);

      if (error) throw error;
      
      toast({ title: "Sucesso", description: "Pacote removido com sucesso." });
      fetchPacotes();
      if (onUpdate) onUpdate();
    } catch (error: any) {
      toast({ title: "Erro", description: error.message, variant: "destructive" });
    }
  };

  const handleFinalizar = async (id: string) => {
    try {
      const { error } = await supabase
        .from('cliente_pacotes')
        .update({ status: 'finalizado' })
        .eq('id', id);

      if (error) throw error;
      
      toast({ title: "Sucesso", description: "Pacote finalizado." });
      fetchPacotes();
      if (onUpdate) onUpdate();
    } catch (error: any) {
      toast({ title: "Erro", description: error.message, variant: "destructive" });
    }
  };

  if (loading) return <div className="text-center py-4 text-sm text-muted-foreground">Carregando pacotes...</div>;

  if (pacotes.length === 0) {
    return (
      <div className="text-center py-8 border-2 border-dashed rounded-xl opacity-60">
        <Package className="h-8 w-8 mx-auto mb-2 text-muted-foreground" />
        <p className="text-sm">Nenhum pacote ativo para este cliente.</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {pacotes.map((cp) => (
        <Card key={cp.id} className={`overflow-hidden border-l-4 ${cp.status === 'ativo' ? 'border-l-primary' : 'border-l-muted opacity-80'}`}>
          <CardContent className="p-4">
            <div className="flex justify-between items-start mb-3">
              <div>
                <h4 className="font-bold text-foreground flex items-center gap-2">
                  {cp.pacote?.nome || 'Pacote Personalizado'}
                  {cp.status === 'ativo' ? (
                    <Badge variant="outline" className="bg-green-500/10 text-green-700 border-green-200">Ativo</Badge>
                  ) : (
                    <Badge variant="secondary">Finalizado</Badge>
                  )}
                </h4>
                <p className="text-xs text-muted-foreground">Comprado em {new Date(cp.created_at).toLocaleDateString('pt-BR')}</p>
              </div>
              <div className="text-right">
                <div className="text-lg font-bold text-primary">R$ {cp.valor_pago.toFixed(2)}</div>
                <p className="text-[10px] text-muted-foreground uppercase font-semibold">Valor Total</p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4 mb-4">
              <div className="bg-muted/30 p-2 rounded-lg text-center">
                <div className="text-xl font-bold">{cp.sessoes_totais}</div>
                <div className="text-[10px] text-muted-foreground uppercase">Sessões Totais</div>
              </div>
              <div className={`p-2 rounded-lg text-center ${cp.sessoes_restantes > 0 ? 'bg-primary/10 text-primary' : 'bg-muted text-muted-foreground'}`}>
                <div className="text-xl font-bold">{cp.sessoes_restantes}</div>
                <div className="text-[10px] uppercase font-semibold">Restantes</div>
              </div>
            </div>

            <div className="flex gap-2">
              {cp.status === 'ativo' && (
                <Button 
                  variant="outline" 
                  size="sm" 
                  className="flex-1 h-8 text-xs gap-1"
                  onClick={() => handleFinalizar(cp.id)}
                >
                  <CheckCircle2 className="h-3 w-3" /> Finalizar
                </Button>
              )}
              <Button 
                variant="outline" 
                size="sm" 
                className="h-8 w-8 p-0 text-destructive hover:text-destructive hover:bg-destructive/10"
                onClick={() => handleDelete(cp.id)}
              >
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
};
