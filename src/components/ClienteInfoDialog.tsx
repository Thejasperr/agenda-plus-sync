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
import { Calendar, Clock, Wallet, AlertCircle, History, CalendarCheck, TrendingUp, CheckCircle2, Plus, Pencil, ChevronDown, Sparkles, Edit2, Trash2 } from 'lucide-react';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { format, parseISO, isToday, isFuture, isPast, startOfDay, isSameMonth } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { useToast } from '@/hooks/use-toast';
import FormaPagamentoDialog from './FormaPagamentoDialog';
import { useAgendamentosRealtime } from '@/hooks/useAgendamentosRealtime';

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
  procedimento_id: string | null;
  procedimentos_nomes?: string;
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
  const [creditoOpen, setCreditoOpen] = useState(false);
  const [creditoValor, setCreditoValor] = useState('');
  const [creditoObs, setCreditoObs] = useState('');
  const [savingCredito, setSavingCredito] = useState(false);
  const [editarCreditoOpen, setEditarCreditoOpen] = useState(false);
  const [novoSaldoEdit, setNovoSaldoEdit] = useState('');
  const [editObs, setEditObs] = useState('');
  const [savingEdit, setSavingEdit] = useState(false);
  const { toast } = useToast();

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

    const agList = (ags || []) as Agendamento[];

    // Buscar nomes dos procedimentos (multi via agendamento_procedimentos + legado via procedimento_id)
    if (agList.length > 0) {
      const ids = agList.map(a => a.id);
      const procIdsLegado = agList.map(a => a.procedimento_id).filter(Boolean) as string[];

      const [{ data: links }, { data: servicosLegado }] = await Promise.all([
        supabase
          .from('agendamento_procedimentos')
          .select('agendamento_id, ordem, servicos:procedimento_id(nome_procedimento)')
          .in('agendamento_id', ids)
          .order('ordem', { ascending: true }),
        procIdsLegado.length
          ? supabase.from('servicos').select('id, nome_procedimento').in('id', procIdsLegado)
          : Promise.resolve({ data: [] as any[] }),
      ]);

      const linksMap: Record<string, string[]> = {};
      (links || []).forEach((l: any) => {
        const nm = l.servicos?.nome_procedimento;
        if (!nm) return;
        if (!linksMap[l.agendamento_id]) linksMap[l.agendamento_id] = [];
        linksMap[l.agendamento_id].push(nm);
      });
      const servMap: Record<string, string> = {};
      (servicosLegado || []).forEach((s: any) => { servMap[s.id] = s.nome_procedimento; });

      agList.forEach(a => {
        if (linksMap[a.id]?.length) {
          a.procedimentos_nomes = linksMap[a.id].join(' + ');
        } else if (a.procedimento_id && servMap[a.procedimento_id]) {
          a.procedimentos_nomes = servMap[a.procedimento_id];
        }
      });
    }

    setCliente((clientes?.[0] as Cliente) || null);
    setAgendamentos(agList);
    setLoading(false);
  }, [telefone]);

  useEffect(() => {
    if (open && telefone) load();
  }, [open, telefone, load]);

  // Sincronização em tempo real: se algo mudar enquanto o modal está aberto, recarrega
  useAgendamentosRealtime(() => {
    if (open && telefone) load();
  });

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

  // Pendências em agendamento (não concluídos no passado) — excluindo o mês atual
  const hojeRef = new Date();
  const devendoList = agendamentos.filter(a => {
    const d = parseISO(a.data_agendamento);
    return isPast(d) && !isToday(d) && !isSameMonth(d, hojeRef) && a.status !== 'Concluído' && a.status !== 'Cancelado';
  });

  // Saldo: positivo = crédito a haver; negativo = está devendo
  const saldo = Number(cliente?.saldo_credito || 0);
  const credito = saldo > 0 ? saldo : 0;
  const devendoSaldo = saldo < 0 ? Math.abs(saldo) : 0;

  const podeConfirmar = (a: Agendamento) => a.status !== 'Concluído' && a.status !== 'Cancelado';

  const handleAdicionarCredito = async () => {
    const valor = parseFloat(creditoValor);
    if (isNaN(valor) || valor <= 0) {
      toast({ title: 'Valor inválido', description: 'Informe um valor maior que zero.', variant: 'destructive' });
      return;
    }
    setSavingCredito(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Usuário não autenticado');

      let clienteId = cliente?.id;
      let saldoAtual = Number(cliente?.saldo_credito || 0);

      // Se ainda não existe cliente, cria com o telefone/nome do contato
      if (!clienteId) {
        const { data: novoCli, error: errCli } = await supabase
          .from('clientes')
          .insert([{ nome, telefone, saldo_credito: 0, user_id: user.id }])
          .select('id, saldo_credito')
          .single();
        if (errCli) throw errCli;
        clienteId = novoCli.id;
        saldoAtual = Number(novoCli.saldo_credito || 0);
      }

      const novoSaldo = saldoAtual + valor;
      const { error: errUpd } = await supabase
        .from('clientes')
        .update({ saldo_credito: novoSaldo })
        .eq('id', clienteId);
      if (errUpd) throw errUpd;

      // Registrar transação de entrada (crédito antecipado)
      await supabase.from('transacoes').insert([{
        tipo: 'Crédito antecipado',
        tipo_operacao: 'entrada',
        valor,
        data_transacao: format(new Date(), 'yyyy-MM-dd'),
        observacoes: `Crédito adicionado para ${nome}${creditoObs ? ` — ${creditoObs}` : ''}`,
        user_id: user.id,
      }]);

      toast({ title: 'Crédito adicionado', description: `R$ ${valor.toFixed(2)} adicionado ao saldo de ${nome}.` });
      setCreditoOpen(false);
      setCreditoValor('');
      setCreditoObs('');
      load();
    } catch (e: any) {
      console.error('Erro ao adicionar crédito:', e);
      toast({ title: 'Erro', description: e.message || 'Não foi possível adicionar o crédito.', variant: 'destructive' });
    } finally {
      setSavingCredito(false);
    }
  };

  const handleEditarCredito = async () => {
    const novo = parseFloat(novoSaldoEdit);
    if (isNaN(novo) || novo < 0) {
      toast({ title: 'Valor inválido', description: 'Informe um valor válido (0 ou maior).', variant: 'destructive' });
      return;
    }
    if (!cliente?.id) {
      toast({ title: 'Cliente não cadastrado', description: 'Use "Adicionar" para criar o saldo.', variant: 'destructive' });
      return;
    }
    setSavingEdit(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Usuário não autenticado');

      const saldoAtual = Number(cliente.saldo_credito || 0);
      const diferenca = novo - saldoAtual;

      const { error: errUpd } = await supabase
        .from('clientes')
        .update({ saldo_credito: novo })
        .eq('id', cliente.id);
      if (errUpd) throw errUpd;

      if (diferenca !== 0) {
        await supabase.from('transacoes').insert([{
          tipo: 'Ajuste de crédito',
          tipo_operacao: diferenca > 0 ? 'entrada' : 'saida',
          valor: Math.abs(diferenca),
          data_transacao: format(new Date(), 'yyyy-MM-dd'),
          observacoes: `Ajuste manual de saldo de ${nome} (de R$ ${saldoAtual.toFixed(2)} para R$ ${novo.toFixed(2)})${editObs ? ` — ${editObs}` : ''}`,
          user_id: user.id,
        }]);
      }

      toast({ title: 'Saldo atualizado', description: `Novo saldo: R$ ${novo.toFixed(2)}` });
      setEditarCreditoOpen(false);
      setNovoSaldoEdit('');
      setEditObs('');
      load();
    } catch (e: any) {
      console.error('Erro ao editar crédito:', e);
      toast({ title: 'Erro', description: e.message || 'Não foi possível atualizar o saldo.', variant: 'destructive' });
    } finally {
      setSavingEdit(false);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'Concluído': return 'bg-green-500/10 text-green-700 border-green-500/30';
      case 'Cancelado': return 'bg-red-500/10 text-red-700 border-red-500/30';
      case 'Confirmado': return 'bg-blue-500/10 text-blue-700 border-blue-500/30';
      default: return 'bg-amber-500/10 text-amber-700 border-amber-500/30';
    }
  };

  const handleCancelar = async (a: Agendamento) => {
    if (!confirm(`Cancelar o agendamento de ${a.procedimentos_nomes || 'procedimento'} em ${format(parseISO(a.data_agendamento), "dd/MM/yyyy", { locale: ptBR })} às ${a.hora_agendamento?.slice(0, 5)}?`)) return;
    const { error } = await supabase
      .from('agendamentos')
      .update({ status: 'Cancelado' })
      .eq('id', a.id);
    if (error) {
      toast({ title: 'Erro', description: error.message, variant: 'destructive' });
      return;
    }
    toast({ title: 'Agendamento cancelado' });
    load();
  };

  const renderAgendamento = (a: Agendamento) => (
    <Card key={a.id} className="p-3 space-y-2">
      {/* 1. Procedimento + valor */}
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-start gap-1.5 min-w-0 flex-1">
          <Sparkles className="h-3.5 w-3.5 text-primary shrink-0 mt-0.5" />
          <p className="text-sm font-semibold text-foreground leading-tight">
            {a.procedimentos_nomes || 'Procedimento'}
          </p>
        </div>
        <Badge variant="outline" className={`${getStatusColor(a.status)} text-[10px] shrink-0`}>{a.status}</Badge>
      </div>

      <p className="text-base font-bold text-primary">
        R$ {calcValorFinal(a).toFixed(2)}
        {a.tem_desconto && a.porcentagem_desconto ? (
          <span className="text-[10px] font-normal text-muted-foreground ml-1.5">({a.porcentagem_desconto}% off)</span>
        ) : null}
      </p>

      {/* 2. Data e horário */}
      <div className="flex items-center gap-2 text-xs text-muted-foreground flex-wrap">
        <span className="inline-flex items-center gap-1">
          <Calendar className="h-3.5 w-3.5" />
          {format(parseISO(a.data_agendamento), "dd 'de' MMM yyyy", { locale: ptBR })}
        </span>
        <span className="inline-flex items-center gap-1">
          <Clock className="h-3.5 w-3.5" />
          {a.hora_agendamento?.slice(0, 5)}
        </span>
        {a.forma_pagamento && <span className="ml-auto">{a.forma_pagamento}</span>}
      </div>

      {a.observacoes && <p className="text-xs text-muted-foreground italic">{a.observacoes}</p>}

      {/* 3. Ações */}
      {podeConfirmar(a) && (
        <div className="flex flex-wrap gap-2 pt-1">
          <Button
            size="sm"
            className="flex-1 min-w-[110px] h-8 text-xs"
            onClick={() => setPagamentoAg(a)}
          >
            <CheckCircle2 className="h-3.5 w-3.5 mr-1" />
            Confirmar
          </Button>
          <Button
            size="sm"
            variant="outline"
            className="flex-1 min-w-[90px] h-8 text-xs"
            onClick={() => {
              onOpenChange(false);
              window.dispatchEvent(new CustomEvent('app:navigate', { detail: { tab: 'calendario' } }));
              setTimeout(() => {
                window.dispatchEvent(new CustomEvent('whatsapp:editar', { detail: { id: a.id } }));
              }, 150);
            }}
          >
            <Edit2 className="h-3.5 w-3.5 mr-1" />
            Editar
          </Button>
          <Button
            size="sm"
            variant="outline"
            className="flex-1 min-w-[90px] h-8 text-xs text-destructive border-destructive/40 hover:bg-destructive/10 hover:text-destructive"
            onClick={() => handleCancelar(a)}
          >
            <XCircle className="h-3.5 w-3.5 mr-1" />
            Cancelar
          </Button>
        </div>
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
                    <Card className="p-3 relative">
                      <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground mb-1">
                        <Wallet className="h-3 w-3" /> Crédito
                      </div>
                      <p className={`text-sm font-bold ${credito > 0 ? 'text-green-600' : 'text-foreground'}`}>
                        R$ {credito.toFixed(2)}
                      </p>
                      <p className="text-[10px] text-muted-foreground">a haver</p>
                      <div className="flex gap-1 mt-2">
                        <Button
                          size="sm"
                          variant="outline"
                          className="flex-1 h-7 text-[10px] gap-1 px-1"
                          onClick={() => setCreditoOpen(true)}
                        >
                          <Plus className="h-3 w-3" /> Add
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          className="flex-1 h-7 text-[10px] gap-1 px-1"
                          onClick={() => {
                            setNovoSaldoEdit(credito.toFixed(2));
                            setEditObs('');
                            setEditarCreditoOpen(true);
                          }}
                          disabled={!cliente}
                        >
                          <Pencil className="h-3 w-3" /> Editar
                        </Button>
                      </div>
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
                        Pendências de meses anteriores ({devendoList.length})
                      </h3>
                      <div className="space-y-2">{devendoList.map(renderAgendamento)}</div>
                    </section>
                  )}

                  <Collapsible>
                    <CollapsibleTrigger className="w-full flex items-center justify-between text-xs font-semibold text-foreground mb-2 hover:text-primary transition-colors group">
                      <span className="flex items-center gap-1.5">
                        <History className="h-3.5 w-3.5 text-muted-foreground" />
                        Histórico ({historico.length})
                      </span>
                      <ChevronDown className="h-4 w-4 text-muted-foreground transition-transform group-data-[state=open]:rotate-180" />
                    </CollapsibleTrigger>
                    <CollapsibleContent className="data-[state=open]:animate-accordion-down data-[state=closed]:animate-accordion-up overflow-hidden">
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
                    </CollapsibleContent>
                  </Collapsible>
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

      <Dialog open={creditoOpen} onOpenChange={setCreditoOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Adicionar crédito</DialogTitle>
            <p className="text-xs text-muted-foreground">
              Lance um valor pago antecipadamente para <span className="font-medium text-foreground">{nome}</span>.
              O crédito será aplicado automaticamente como desconto em agendamentos futuros.
            </p>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div>
              <Label htmlFor="credito_valor">Valor (R$) *</Label>
              <Input
                id="credito_valor"
                type="number"
                step="0.01"
                min="0"
                placeholder="0.00"
                value={creditoValor}
                onChange={(e) => setCreditoValor(e.target.value)}
                autoFocus
              />
              {credito > 0 && (
                <p className="text-[11px] text-muted-foreground mt-1">
                  Saldo atual: R$ {credito.toFixed(2)}
                </p>
              )}
            </div>
            <div>
              <Label htmlFor="credito_obs">Observação (opcional)</Label>
              <Textarea
                id="credito_obs"
                rows={2}
                placeholder="Ex.: pago pela mãe para a filha"
                value={creditoObs}
                onChange={(e) => setCreditoObs(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setCreditoOpen(false)} disabled={savingCredito}>
              Cancelar
            </Button>
            <Button onClick={handleAdicionarCredito} disabled={savingCredito}>
              {savingCredito ? 'Salvando...' : 'Adicionar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={editarCreditoOpen} onOpenChange={setEditarCreditoOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Editar saldo de crédito</DialogTitle>
            <p className="text-xs text-muted-foreground">
              Ajuste manualmente o saldo de <span className="font-medium text-foreground">{nome}</span>.
              A diferença será registrada como ajuste nas transações.
            </p>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div>
              <Label htmlFor="edit_saldo">Novo saldo (R$) *</Label>
              <Input
                id="edit_saldo"
                type="number"
                step="0.01"
                min="0"
                placeholder="0.00"
                value={novoSaldoEdit}
                onChange={(e) => setNovoSaldoEdit(e.target.value)}
                autoFocus
              />
              <p className="text-[11px] text-muted-foreground mt-1">
                Saldo atual: R$ {credito.toFixed(2)}
              </p>
            </div>
            <div>
              <Label htmlFor="edit_obs">Motivo do ajuste (opcional)</Label>
              <Textarea
                id="edit_obs"
                rows={2}
                placeholder="Ex.: correção de lançamento"
                value={editObs}
                onChange={(e) => setEditObs(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setEditarCreditoOpen(false)} disabled={savingEdit}>
              Cancelar
            </Button>
            <Button onClick={handleEditarCredito} disabled={savingEdit}>
              {savingEdit ? 'Salvando...' : 'Salvar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
};

export default ClienteInfoDialog;
