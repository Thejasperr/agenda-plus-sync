import React from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Calendar, CreditCard } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { ClientePacotesManager } from './ClientePacotesManager';
import { useQuery } from '@tanstack/react-query';

interface ClientePerfilDialogProps {
  clienteId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export const ClientePerfilDialog = ({ clienteId, open, onOpenChange }: ClientePerfilDialogProps) => {
  const { data: cliente } = useQuery({
    queryKey: ['cliente', clienteId],
    queryFn: async () => {
      const { data, error } = await supabase.from('clientes').select('*').eq('id', clienteId).single();
      if (error) throw error;
      return data;
    },
    enabled: !!clienteId && open
  });

  const { data: agendamentos = [], refetch: refetchAgendamentos } = useQuery({
    queryKey: ['cliente-agendamentos', cliente?.telefone],
    queryFn: async () => {
      if (!cliente?.telefone) return [];
      const { data, error } = await supabase
        .from('agendamentos')
        .select('*')
        .eq('telefone', cliente.telefone)
        .order('data_agendamento', { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!cliente?.telefone && open
  });

  const formatDate = (dateString: string) => {
    const [year, month, day] = dateString.split('-').map(Number);
    return new Date(year, month - 1, day).toLocaleDateString('pt-BR');
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[95%] max-w-2xl mx-auto max-h-[90vh] overflow-hidden flex flex-col p-0">
        <DialogHeader className="p-4 border-b">
          <DialogTitle>Perfil do Cliente - {cliente?.nome || ''}</DialogTitle>
        </DialogHeader>
        
        <div className="flex-1 overflow-y-auto p-4">
          <Tabs defaultValue="agendamentos" className="w-full">
            <TabsList className="grid w-full grid-cols-2 mb-4">
              <TabsTrigger value="agendamentos" className="flex items-center gap-2">
                <Calendar className="h-4 w-4" /> Agendamentos
              </TabsTrigger>
              <TabsTrigger value="pacotes" className="flex items-center gap-2">
                <CreditCard className="h-4 w-4" /> Pacotes
              </TabsTrigger>
            </TabsList>

            <TabsContent value="agendamentos" className="space-y-3 mt-0">
              {agendamentos.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">Nenhum agendamento</div>
              ) : (
                agendamentos.map((ag) => (
                  <Card key={ag.id} className="mobile-card border-l-4 border-l-blue-500">
                    <CardContent className="p-3">
                      <div className="flex justify-between items-start mb-2">
                        <div>
                          <div className="font-medium">{formatDate(ag.data_agendamento)} às {ag.hora_agendamento}</div>
                          <div className="text-sm font-medium">R$ {ag.preco.toFixed(2)}</div>
                        </div>
                        <Badge variant="outline" className={
                          ag.status === 'Concluído' ? 'bg-green-500/10 text-green-700 border-green-200' : 
                          ag.status === 'Cancelado' ? 'bg-red-500/10 text-red-700 border-red-200' : 
                          'bg-blue-500/10 text-blue-700 border-blue-200'
                        }>
                          {ag.status}
                        </Badge>
                      </div>
                      {ag.observacoes && <div className="text-xs text-muted-foreground bg-muted/50 p-2 rounded"><strong>Obs:</strong> {ag.observacoes}</div>}
                    </CardContent>
                  </Card>
                ))
              )}
            </TabsContent>

            <TabsContent value="pacotes" className="space-y-3 mt-0">
              <ClientePacotesManager clienteId={clienteId} onUpdate={() => {
                refetchAgendamentos();
              }} />
            </TabsContent>
          </Tabs>
        </div>
      </DialogContent>
    </Dialog>
  );
};
