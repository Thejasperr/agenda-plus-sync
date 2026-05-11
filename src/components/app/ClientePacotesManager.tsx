import React, { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Package, Trash2, CheckCircle2, AlertCircle, Calendar, Plus, DollarSign } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface ClientePacote {
  id: string;
  cliente_id: string;
  pacote_id: string;
  sessoes_totais: number;
  sessoes_restantes: number;
  valor_pago: number;
  status: string;
  pago: boolean;
  created_at: string;
  pacote?: {
    nome: string;
  };
}

interface Agendamento {
  id: string;
  data_agendamento: string;
  hora_agendamento: string;
  preco: number;
  status: string;
  cliente_pacote_id: string | null;
}

interface ClientePacotesManagerProps {
  clienteId: string;
  onUpdate?: () => void;
}

export const ClientePacotesManager = ({ clienteId, onUpdate }: ClientePacotesManagerProps) => {
  const [pacotes, setPacotes] = useState<ClientePacote[]>([]);
  const [agendamentosSemPacote, setAgendamentosSemPacote] = useState<Agendamento[]>([]);
  const [loading, setLoading] = useState(true);
  const [linkingPacote, setLinkingPacote] = useState<ClientePacote | null>(null);
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
    }
  };

  const fetchAgendamentosSemPacote = async () => {
    try {
      // Primeiro buscamos o telefone do cliente
      const { data: cliente } = await supabase
        .from('clientes')
        .select('telefone')
        .eq('id', clienteId)
        .single();

      if (!cliente) return;

      const { data, error } = await supabase
        .from('agendamentos')
        .select('id, data_agendamento, hora_agendamento, preco, status, cliente_pacote_id')
        .eq('telefone', cliente.telefone)
        .is('cliente_pacote_id', null)
        .order('data_agendamento', { ascending: false });

      if (error) throw error;
      setAgendamentosSemPacote(data || []);
    } catch (error: any) {
      console.error('Erro ao buscar agendamentos sem pacote:', error);
    }
  };

  const fetchData = async () => {
    setLoading(true);
    await Promise.all([fetchPacotes(), fetchAgendamentosSemPacote()]);
    setLoading(false);
  };

  useEffect(() => {
    if (clienteId) fetchData();
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
      fetchData();
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
      fetchData();
      if (onUpdate) onUpdate();
    } catch (error: any) {
      toast({ title: "Erro", description: error.message, variant: "destructive" });
    }
  };

  const handleTogglePago = async (id: string, currentPago: boolean) => {
    try {
      const { error } = await supabase
        .from('cliente_pacotes')
        .update({ pago: !currentPago })
        .eq('id', id);

      if (error) throw error;
      
      toast({ title: "Sucesso", description: !currentPago ? "Pacote marcado como pago." : "Pagamento removido." });
      fetchData();
      if (onUpdate) onUpdate();
    } catch (error: any) {
      toast({ title: "Erro", description: error.message, variant: "destructive" });
    }
  };

  const vincularAgendamentoAoPacote = async (agendamento: Agendamento, pacote: ClientePacote) => {
    if (pacote.sessoes_restantes <= 0) {
      toast({ title: "Erro", description: "Este pacote não possui sessões restantes.", variant: "destructive" });
      return;
    }

    try {
      // 1. Atualizar agendamento
      const { error: agError } = await supabase
        .from('agendamentos')
        .update({
          cliente_pacote_id: pacote.id,
          sessao_numero: (pacote.sessoes_totais - pacote.sessoes_restantes) + 1,
          preco: 0 // Preço é zerado quando faz parte do pacote
        })
        .eq('id', agendamento.id);

      if (agError) throw agError;

      // 2. Deduzir sessão do pacote
      const { error: pacError } = await supabase
        .from('cliente_pacotes')
        .update({
          sessoes_restantes: pacote.sessoes_restantes - 1
        })
        .eq('id', pacote.id);

      if (pacError) throw pacError;

      toast({ title: "Sucesso", description: "Agendamento vinculado ao pacote e sessão descontada!" });
      setLinkingPacote(null);
      fetchData();
      if (onUpdate) onUpdate();
    } catch (error: any) {
      toast({ title: "Erro", description: error.message, variant: "destructive" });
    }
  };

  const formatDate = (dateString: string) => {
    const [year, month, day] = dateString.split('-').map(Number);
    return new Date(year, month - 1, day).toLocaleDateString('pt-BR');
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
                  {cp.pago ? (
                    <Badge variant="outline" className="bg-blue-500/10 text-blue-700 border-blue-200">Pago</Badge>
                  ) : (
                    <Badge variant="outline" className="bg-red-500/10 text-red-700 border-red-200">Pendente</Badge>
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
              {cp.status === 'ativo' && cp.sessoes_restantes > 0 && (
                <Button 
                  variant="outline" 
                  size="sm" 
                  className="flex-1 h-8 text-xs gap-1 text-primary border-primary/20 bg-primary/5 hover:bg-primary/10"
                  onClick={() => setLinkingPacote(cp)}
                >
                  <Plus className="h-3 w-3" /> Vincular Agendamento
                </Button>
              )}
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

      <Dialog open={!!linkingPacote} onOpenChange={() => setLinkingPacote(null)}>
        <DialogContent className="w-[90%] max-w-md mx-auto">
          <DialogHeader>
            <DialogTitle>Vincular Agendamento ao Pacote</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <p className="text-sm text-muted-foreground">
              Selecione um agendamento já realizado para descontar deste pacote.
              O preço do agendamento será zerado e o saldo do pacote atualizado.
            </p>
            <div className="space-y-2 max-h-[300px] overflow-y-auto pr-2">
              {agendamentosSemPacote.length > 0 ? (
                agendamentosSemPacote.map(ag => (
                  <div 
                    key={ag.id} 
                    className="flex items-center justify-between p-3 border rounded-lg hover:bg-muted/50 transition-colors cursor-pointer"
                    onClick={() => linkingPacote && vincularAgendamentoAoPacote(ag, linkingPacote)}
                  >
                    <div>
                      <div className="font-medium flex items-center gap-2">
                        <Calendar className="h-3 w-3" />
                        {formatDate(ag.data_agendamento)} às {ag.hora_agendamento}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        Valor original: R$ {ag.preco.toFixed(2)} • Status: {ag.status}
                      </div>
                    </div>
                    <Button size="sm" variant="ghost" className="text-primary h-8 w-8 p-0">
                      <Plus className="h-4 w-4" />
                    </Button>
                  </div>
                ))
              ) : (
                <div className="text-center py-6 text-muted-foreground text-sm">
                  Nenhum agendamento sem pacote encontrado para este cliente.
                </div>
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};
