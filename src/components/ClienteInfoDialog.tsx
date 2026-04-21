import React, { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Calendar, Clock, Wallet, AlertCircle, History, CalendarCheck, TrendingUp, CheckCircle2, Plus } from 'lucide-react';
import { format, parseISO, isToday, isFuture, isPast, startOfDay } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { useToast } from '@/hooks/use-toast';
import FormaPagamentoDialog from './FormaPagamentoDialog';

interface ClienteInfoDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  telefone: string;
  nome: string;
}

interface Agendamento {
  id: string;
  nome: string;
  data_agendamento: string;
  hora_agendamento: string;
  preco: number;
  status: string;
  tem_desconto: boolean | null;
  porcentagem_desconto: number | null;
  observacoes: string | null;
  forma_pagamento: string | null;
  pagamento_antecipado: boolean | null;
  porcentagem_pagamento_antecipado: number | null;
}

interface Cliente {
  id: string;
  nome: string;
  telefone: string;
  saldo_credito: number;
}

const ClienteInfoDialog: React.FC<ClienteInfoDialogProps> = ({ open, onOpenChange, telefone, nome }) => {
  const [loading, setLoading] = useState(true);
  const [cliente, setCliente] = useState<Cliente | null>(null);
  const [agendamentos, setAgendamentos] = useState<Agendamento[]>([]);
  const [pagamentoAg, setPagamentoAg] = useState<Agendamento | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const digits = telefone.replace(/\D/g, '');

    const [{ data: clientes }, { data: ags }] = await Promise.all([
      supabase
        .from('clientes')
        .select('id, nome, telefone, saldo_credito')
        .or(`telefone.eq.${telefone},telefone.eq.${digits},telefone.ilike.%${digits.slice(-8)}%`)
        .limit(1),
      supabase
        .from('agendamentos')
        .select('*')
        .or(`telefone.eq.${telefone},telefone.eq.${digits},telefone.ilike.%${digits.slice(-8)}%`)
        .order('data_agendamento', { ascending: false })
        .order('hora_agendamento', { ascending: false }),
    ]);

    setCliente((clientes?.[0] as Cliente) || null);
    setAgendamentos((ags || []) as Agendamento[]);
    setLoading(false);
  }, [telefone]);

  useEffect(() => {
    if (open && telefone) load();
  }, [open, telefone, load]);

  const calcValorFinal = (a: Agendamento) => {
    let v = Number(a.preco) || 0;
    if (a.tem_desconto && a.porcentagem_desconto) {
      v = v * (1 - Number(a.porcentagem_desconto) / 100);
    }
    return v;
  };

  const ativosHoje = agendamentos.filter(a => {
    const d = parseISO(a.data_agendamento);
    return isToday(d) && a.status !== 'Cancelado' && a.status !== 'Concluído';
  });

  const futuros = agendamentos.filter(a => {
    const d = parseISO(a.data_agendamento);
    return isFuture(d) && !isToday(d) && a.status !== 'Cancelado';
  });

  const historico = agendamentos.filter(a => {
    const d = parseISO(a.data_agendamento);
    return ((isPast(d) && !isToday(d)) || a.status === 'Concluído' || a.status === 'Cancelado');
  });

  const concluidos = agendamentos.filter(a => a.status === 'Concluído');
  const totalGasto = concluidos.reduce((sum, a) => sum + calcValorFinal(a), 0);

  // Pendências em agendamento (não concluídos no passado)
  const devendoList = agendamentos.filter(a => {
    const d = parseISO(a.data_agendamento);
    return isPast(d) && !isToday(d) && a.status !== 'Concluído' && a.status !== 'Cancelado';
  });

  // Saldo: positivo = crédito a haver; negativo = está devendo
  const saldo = Number(cliente?.saldo_credito || 0);
  const credito = saldo > 0 ? saldo : 0;
  const devendoSaldo = saldo < 0 ? Math.abs(saldo) : 0;

  const podeConfirmar = (a: Agendamento) => a.status !== 'Concluído' && a.status !== 'Cancelado';

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'Concluído': return 'bg-green-500/10 text-green-700 border-green-500/30';
      case 'Cancelado': return 'bg-red-500/10 text-red-700 border-red-500/30';
      case 'Confirmado': return 'bg-blue-500/10 text-blue-700 border-blue-500/30';
      default: return 'bg-amber-500/10 text-amber-700 border-amber-500/30';
    }
  };

  const renderAgendamento = (a: Agendamento) => (
    <Card key={a.id} className="p-3">
      <div className="flex items-start justify-between gap-2 mb-1.5">
        <div className="flex items-center gap-2 text-sm font-medium text-foreground flex-wrap">
          <Calendar className="h-3.5 w-3.5 text-primary" />
          {format(parseISO(a.data_agendamento), "dd 'de' MMM yyyy", { locale: ptBR })}
          <Clock className="h-3.5 w-3.5 text-muted-foreground ml-1" />
          {a.hora_agendamento?.slice(0, 5)}
        </div>
        <Badge variant="outline" className={`${getStatusColor(a.status)} text-[10px]`}>{a.status}</Badge>
      </div>
      <div className="flex items-center justify-between text-xs">
        <span className="text-muted-foreground">
          R$ {calcValorFinal(a).toFixed(2)}
          {a.tem_desconto && a.porcentagem_desconto ? ` (${a.porcentagem_desconto}% off)` : ''}
        </span>
        {a.forma_pagamento && <span className="text-muted-foreground">{a.forma_pagamento}</span>}
      </div>
      {a.observacoes && <p className="text-xs text-muted-foreground mt-1.5 italic">{a.observacoes}</p>}
      {podeConfirmar(a) && (
        <Button
          size="sm"
          className="w-full mt-2 h-8 text-xs"
          onClick={() => setPagamentoAg(a)}
        >
          <CheckCircle2 className="h-3.5 w-3.5 mr-1" />
          Confirmar pagamento
        </Button>
      )}
    </Card>
  );

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-lg max-h-[85vh] p-0 gap-0 flex flex-col">
          <DialogHeader className="p-4 pb-3 border-b border-border shrink-0">
            <DialogTitle className="text-base">{nome}</DialogTitle>
            <p className="text-xs text-muted-foreground">{telefone}</p>
          </DialogHeader>

          <ScrollArea className="flex-1 min-h-0">
            <div className="p-4 space-y-4">
              {loading ? (
                <p className="text-center text-sm text-muted-foreground py-8">Carregando...</p>
              ) : (
                <>
                  <div className="grid grid-cols-3 gap-2">
                    <Card className="p-3">
                      <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground mb-1">
                        <TrendingUp className="h-3 w-3" /> Total gasto
                      </div>
                      <p className="text-sm font-bold text-foreground">R$ {totalGasto.toFixed(2)}</p>
                      <p className="text-[10px] text-muted-foreground">{concluidos.length} atendimento(s)</p>
                    </Card>
                    <Card className="p-3">
                      <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground mb-1">
                        <Wallet className="h-3 w-3" /> Crédito
                      </div>
                      <p className={`text-sm font-bold ${credito > 0 ? 'text-green-600' : 'text-foreground'}`}>
                        R$ {credito.toFixed(2)}
                      </p>
                      <p className="text-[10px] text-muted-foreground">a haver</p>
                    </Card>
                    <Card className="p-3">
                      <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground mb-1">
                        <AlertCircle className="h-3 w-3" /> Devendo
                      </div>
                      <p className={`text-sm font-bold ${devendoSaldo > 0 || devendoList.length > 0 ? 'text-destructive' : 'text-foreground'}`}>
                        R$ {devendoSaldo.toFixed(2)}
                      </p>
                      <p className="text-[10px] text-muted-foreground">{devendoList.length} pendente(s)</p>
                    </Card>
                  </div>

                  {!cliente && (
                    <div className="text-xs text-muted-foreground bg-muted/40 rounded-lg p-2 text-center">
                      Contato ainda não cadastrado como cliente.
                    </div>
                  )}

                  <section>
                    <h3 className="text-xs font-semibold text-foreground mb-2 flex items-center gap-1.5">
                      <CalendarCheck className="h-3.5 w-3.5 text-primary" />
                      Agendamentos de hoje ({ativosHoje.length})
                    </h3>
                    {ativosHoje.length === 0 ? (
                      <p className="text-xs text-muted-foreground italic">Nenhum agendamento hoje.</p>
                    ) : (
                      <div className="space-y-2">{ativosHoje.map(renderAgendamento)}</div>
                    )}
                  </section>

                  <section>
                    <h3 className="text-xs font-semibold text-foreground mb-2 flex items-center gap-1.5">
                      <Calendar className="h-3.5 w-3.5 text-primary" />
                      Próximos agendamentos ({futuros.length})
                    </h3>
                    {futuros.length === 0 ? (
                      <p className="text-xs text-muted-foreground italic">Nenhum agendamento futuro.</p>
                    ) : (
                      <div className="space-y-2">{futuros.map(renderAgendamento)}</div>
                    )}
                  </section>

                  {devendoList.length > 0 && (
                    <section>
                      <h3 className="text-xs font-semibold text-destructive mb-2 flex items-center gap-1.5">
                        <AlertCircle className="h-3.5 w-3.5" />
                        Pendências de pagamento ({devendoList.length})
                      </h3>
                      <div className="space-y-2">{devendoList.map(renderAgendamento)}</div>
                    </section>
                  )}

                  <section>
                    <h3 className="text-xs font-semibold text-foreground mb-2 flex items-center gap-1.5">
                      <History className="h-3.5 w-3.5 text-muted-foreground" />
                      Histórico ({historico.length})
                    </h3>
                    {historico.length === 0 ? (
                      <p className="text-xs text-muted-foreground italic">Sem histórico.</p>
                    ) : (
                      <div className="space-y-2">{historico.slice(0, 20).map(renderAgendamento)}</div>
                    )}
                    {historico.length > 20 && (
                      <p className="text-[10px] text-muted-foreground text-center mt-2">
                        Mostrando últimos 20 de {historico.length}
                      </p>
                    )}
                  </section>
                </>
              )}
            </div>
          </ScrollArea>
        </DialogContent>
      </Dialog>

      {pagamentoAg && (
        <FormaPagamentoDialog
          open={!!pagamentoAg}
          onOpenChange={(o) => { if (!o) setPagamentoAg(null); }}
          agendamentoId={pagamentoAg.id}
          valorServico={calcValorFinal(pagamentoAg)}
          clienteTelefone={telefone}
          onConfirm={() => {
            setPagamentoAg(null);
            load();
          }}
        />
      )}
    </>
  );
};

export default ClienteInfoDialog;
