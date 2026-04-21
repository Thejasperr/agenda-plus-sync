import React, { useState, useEffect } from 'react';
import { ChevronLeft, ChevronRight, Edit2, MessageCircle, Check, X, Clock4, CalendarIcon, Clock, DollarSign, Trash2, Plus, Wallet } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Calendar } from '@/components/ui/calendar';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { useIsMobile } from '@/hooks/use-mobile';
import { format, isSameDay, addDays } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import FormaPagamentoDialog from '@/components/FormaPagamentoDialog';
import PagamentoAntecipadoDialog from '@/components/PagamentoAntecipadoDialog';
import { useAgendamentosRealtime } from '@/hooks/useAgendamentosRealtime';
interface Agendamento {
  id: string;
  nome: string;
  telefone: string;
  procedimento_id: string | null;
  preco: number;
  tem_desconto: boolean;
  porcentagem_desconto: number | null;
  pagamento_antecipado: boolean;
  porcentagem_pagamento_antecipado: number | null;
  data_agendamento: string;
  hora_agendamento: string;
  tem_retorno: boolean;
  data_retorno: string | null;
  preco_retorno: number | null;
  status: string;
  observacoes: string | null;
  forma_pagamento: string | null;
  created_at: string;
}


const CalendarioPage = () => {
  const [agendamentos, setAgendamentos] = useState<Agendamento[]>([]);
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(new Date());
  const [servicos, setServicos] = useState<{
    id: string;
    nome_procedimento: string;
    valor: number;
    duracao_minutos: number | null;
  }[]>([]);
  const [clientes, setClientes] = useState<{
    telefone: string;
    nome: string;
  }[]>([]);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingAgendamento, setEditingAgendamento] = useState<Agendamento | null>(null);
  const [selectedTimeSlot, setSelectedTimeSlot] = useState<string>('');
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [filteredClientes, setFilteredClientes] = useState<{
    telefone: string;
    nome: string;
  }[]>([]);
  const [formaPagamentoDialogOpen, setFormaPagamentoDialogOpen] = useState(false);
  const [agendamentoConcluindo, setAgendamentoConcluindo] = useState<string | null>(null);
  const [pagamentoAntecipadoDialogOpen, setPagamentoAntecipadoDialogOpen] = useState(false);
  const [agendamentoAdiantamento, setAgendamentoAdiantamento] = useState<Agendamento | null>(null);
  const [formasPagamento, setFormasPagamento] = useState<{
    id: string;
    nome: string;
    ativa: boolean;
  }[]>([]);
  
  
  const { toast } = useToast();
  const isMobile = useIsMobile();

  const fetchFormasPagamento = async () => {
    try {
      const { data, error } = await supabase
        .from('formas_pagamento')
        .select('*')
        .eq('ativa', true)
        .order('nome');
      
      if (error) throw error;
      setFormasPagamento(data || []);
    } catch (error) {
      console.error('Erro ao buscar formas de pagamento:', error);
    }
  };
  const [formData, setFormData] = useState({
    nome: '',
    telefone: '',
    procedimento_ids: [] as string[],
    preco: 0,
    tem_desconto: false,
    porcentagem_desconto: 0,
    pagamento_antecipado: false,
    porcentagem_pagamento_antecipado: 0,
    data_agendamento: format(new Date(), 'yyyy-MM-dd'),
    hora_agendamento: '',
    tem_retorno: false,
    data_retorno: '',
    preco_retorno: 0,
    status: 'Agendado',
    observacoes: ''
  });

  // Calcular automaticamente o preço total quando os procedimentos mudam
  useEffect(() => {
    if (formData.procedimento_ids.length > 0) {
      const total = formData.procedimento_ids.reduce((sum, procId) => {
        const servico = servicos.find(s => s.id === procId);
        return sum + (servico?.valor || 0);
      }, 0);
      setFormData(prev => ({ ...prev, preco: total }));
    }
  }, [formData.procedimento_ids, servicos]);
  const fetchAgendamentos = async () => {
    try {
      const { data, error } = await supabase
        .from('agendamentos')
        .select(`
          *,
          agendamento_procedimentos (
            id,
            procedimento_id,
            ordem
          )
        `)
        .order('data_agendamento', { ascending: true })
        .order('hora_agendamento', { ascending: true });
      
      if (error) throw error;
      setAgendamentos(data || []);
    } catch (error) {
      console.error('Erro ao carregar agendamentos:', error);
    }
  };
  const fetchServicos = async () => {
    try {
      const {
        data,
        error
      } = await supabase.from('servicos').select('*').order('nome_procedimento');
      if (error) throw error;
      setServicos(data || []);
    } catch (error) {
      console.error('Erro ao buscar serviços:', error);
    }
  };
  const fetchClientes = async () => {
    try {
      const {
        data,
        error
      } = await supabase.from('clientes').select('telefone, nome');
      if (error) throw error;
      setClientes(data || []);
    } catch (error) {
      console.error('Erro ao buscar clientes:', error);
    }
  };

  useEffect(() => {
    fetchAgendamentos();
    fetchServicos();
    fetchClientes();
    fetchFormasPagamento();
  }, []);

  // Sincronização em tempo real entre telas
  useAgendamentosRealtime(() => {
    fetchAgendamentos();
  });

  // Prefill vindo do WhatsApp: abre dialog com nome/telefone
  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent).detail as { nome?: string; telefone?: string } | undefined;
      if (!detail) return;
      const today = new Date();
      setSelectedDate(today);
      setEditingAgendamento(null);
      setSelectedTimeSlot('');
      setFormData({
        nome: detail.nome || '',
        telefone: detail.telefone || '',
        procedimento_ids: [],
        preco: 0,
        tem_desconto: false,
        porcentagem_desconto: 0,
        pagamento_antecipado: false,
        porcentagem_pagamento_antecipado: 0,
        data_agendamento: format(today, 'yyyy-MM-dd'),
        hora_agendamento: '',
        tem_retorno: false,
        data_retorno: '',
        preco_retorno: 0,
        status: 'Agendado',
        observacoes: ''
      });
      setDialogOpen(true);
    };
    window.addEventListener('whatsapp:agendar', handler);
    return () => window.removeEventListener('whatsapp:agendar', handler);
  }, []);
  const getStatusColor = (status: string) => {
    switch (status) {
      case 'Agendado':
        return 'bg-blue-500';
      case 'Concluído':
        return 'bg-green-500';
      case 'Cancelado':
        return 'bg-red-500';
      default:
        return 'bg-gray-500';
    }
  };
  const agendamentosDodia = selectedDate ? agendamentos.filter(agendamento => {
    // Corrigir comparação de datas garantindo que seja local
    const agendamentoDateStr = agendamento.data_agendamento;
    const selectedDateStr = format(selectedDate, 'yyyy-MM-dd');
    console.log('Comparando datas:', agendamentoDateStr, 'vs', selectedDateStr);
    return agendamentoDateStr === selectedDateStr;
  }) : [];



  const hasAgendamentos = (date: Date) => {
    return agendamentos.some(agendamento => {
      const agendamentoDate = new Date(agendamento.data_agendamento + 'T00:00:00');
      return isSameDay(agendamentoDate, date);
    });
  };

  const hasAgendamentosPast = (date: Date) => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const compareDate = new Date(date);
    compareDate.setHours(0, 0, 0, 0);
    
    return compareDate < today && hasAgendamentos(date);
  };

  const hasAgendamentosFuture = (date: Date) => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const compareDate = new Date(date);
    compareDate.setHours(0, 0, 0, 0);
    
    return compareDate >= today && hasAgendamentos(date);
  };

  const getAgendadosCount = (date: Date) => {
    return agendamentos.filter(agendamento => {
      const agendamentoDate = new Date(agendamento.data_agendamento + 'T00:00:00');
      return isSameDay(agendamentoDate, date);
    }).length;
  };

  // Gerar horários disponíveis
  const generateTimeSlots = () => {
    const slots = [];

    // Horários normais (11:00 - 20:00) - hora em hora e meia hora
    for (let hour = 11; hour <= 20; hour++) {
      // Hora exata
      const timeStringHour = `${hour.toString().padStart(2, '0')}:00`;
      slots.push({
        time: timeStringHour,
        isSpecial: false
      });
      
      // Meia hora (apenas se não for o último horário)
      if (hour < 20) {
        const timeStringHalf = `${hour.toString().padStart(2, '0')}:30`;
        slots.push({
          time: timeStringHalf,
          isSpecial: false
        });
      }
    }

    // Horários especiais (antes de 11:00 e depois de 20:00) - hora em hora e meia hora
    for (let hour = 8; hour < 11; hour++) {
      const timeStringHour = `${hour.toString().padStart(2, '0')}:00`;
      slots.push({
        time: timeStringHour,
        isSpecial: true
      });
      
      const timeStringHalf = `${hour.toString().padStart(2, '0')}:30`;
      slots.push({
        time: timeStringHalf,
        isSpecial: true
      });
    }
    
    for (let hour = 21; hour <= 22; hour++) {
      const timeStringHour = `${hour.toString().padStart(2, '0')}:00`;
      slots.push({
        time: timeStringHour,
        isSpecial: true
      });
      
      if (hour < 22) {
        const timeStringHalf = `${hour.toString().padStart(2, '0')}:30`;
        slots.push({
          time: timeStringHalf,
          isSpecial: true
        });
      }
    }
    
    return slots.sort((a, b) => a.time.localeCompare(b.time));
  };
  // Filtrar serviços que cabem no horário disponível
  const getServicosDisponiveis = () => {
    if (!selectedTimeSlot || !selectedDate) return servicos;
    
    const [horaSlot, minutoSlot] = selectedTimeSlot.split(':').map(Number);
    const slotTotalMinutos = horaSlot * 60 + minutoSlot;
    
    return servicos.filter(servico => {
      const duracaoMinutos = servico.duracao_minutos || 60;
      const fimServicoMinutos = slotTotalMinutos + duracaoMinutos;
      
      // Verificar se o serviço termina antes das 23:00 (1380 minutos)
      if (fimServicoMinutos > 1380) return false;
      
      // Verificar se não colide com outros agendamentos
      const dateStr = format(selectedDate, 'yyyy-MM-dd');
      const agendamentosDodia = agendamentos.filter(ag => ag.data_agendamento === dateStr);
      
      for (const agendamento of agendamentosDodia) {
        const agendamentoHora = agendamento.hora_agendamento.substring(0, 5);
        
        // Calcular duração total de todos os procedimentos do agendamento
        const procedimentosAgendamento = (agendamento as any).agendamento_procedimentos || [];
        const duracaoAgendado = procedimentosAgendamento.reduce((total: number, proc: any) => {
          const servico = servicos.find(s => s.id === proc.procedimento_id);
          return total + (servico?.duracao_minutos || 60);
        }, 0) || 60; // Default 60 minutos se não houver procedimentos
        
        const [horaAgendado, minutoAgendado] = agendamentoHora.split(':').map(Number);
        const inicioAgendado = horaAgendado * 60 + minutoAgendado;
        const fimAgendado = inicioAgendado + duracaoAgendado;
        
        // Verificar se há sobreposição
        if (!(fimServicoMinutos <= inicioAgendado || slotTotalMinutos >= fimAgendado)) {
          return false;
        }
      }
      
      return true;
    });
  };
  // Função para verificar se um serviço cabe em um horário específico
  const canFitService = (startTime: string, dateStr: string, duracaoMinutos: number) => {
    const agendamentosDodia = agendamentos.filter(ag => ag.data_agendamento === dateStr);
    
    const [horaInicio, minutoInicio] = startTime.split(':').map(Number);
    const slotTotalMinutos = horaInicio * 60 + minutoInicio;
    const fimServicoMinutos = slotTotalMinutos + duracaoMinutos;
    
    // Verificar se não há conflito com agendamentos existentes
    for (const agendamento of agendamentosDodia) {
      const agendamentoHora = agendamento.hora_agendamento.substring(0, 5);
      
      // Calcular duração total de todos os procedimentos do agendamento
      const procedimentosAgendamento = (agendamento as any).agendamento_procedimentos || [];
      const duracaoAgendado = procedimentosAgendamento.reduce((total: number, proc: any) => {
        const servico = servicos.find(s => s.id === proc.procedimento_id);
        return total + (servico?.duracao_minutos || 60);
      }, 0) || 60; // Default 60 minutos se não houver procedimentos
      
      const [horaAgendado, minutoAgendado] = agendamentoHora.split(':').map(Number);
      const inicioAgendado = horaAgendado * 60 + minutoAgendado;
      const fimAgendado = inicioAgendado + duracaoAgendado;
      
      // Verificar se há sobreposição
      if (!(fimServicoMinutos <= inicioAgendado || slotTotalMinutos >= fimAgendado)) {
        return false;
      }
    }
    
    return true;
  };

  const getAvailableTimeSlots = () => {
    if (!selectedDate) return generateTimeSlots();
    const dateStr = format(selectedDate, 'yyyy-MM-dd');
    const agendamentosDodia = agendamentos.filter(ag => ag.data_agendamento === dateStr);
    
    return generateTimeSlots().map(slot => {
      let isOccupied = false;
      
      // Verificar se este horário está ocupado por algum agendamento
      for (const agendamento of agendamentosDodia) {
        const agendamentoHora = agendamento.hora_agendamento.substring(0, 5);
        
        // Calcular duração total de todos os procedimentos do agendamento
        const procedimentosAgendamento = (agendamento as any).agendamento_procedimentos || [];
        const duracaoMinutos = procedimentosAgendamento.reduce((total: number, proc: any) => {
          const servico = servicos.find(s => s.id === proc.procedimento_id);
          return total + (servico?.duracao_minutos || 60);
        }, 0) || 60; // Default 60 minutos se não houver procedimentos
        
        // Calcular horário de fim do agendamento
        const [horaInicio, minutoInicio] = agendamentoHora.split(':').map(Number);
        const inicioTotalMinutos = horaInicio * 60 + minutoInicio;
        const fimTotalMinutos = inicioTotalMinutos + duracaoMinutos;
        
        // Verificar se o slot atual colide com este agendamento
        const [horaSlot, minutoSlot] = slot.time.split(':').map(Number);
        const slotTotalMinutos = horaSlot * 60 + minutoSlot;
        
        if (slotTotalMinutos >= inicioTotalMinutos && slotTotalMinutos < fimTotalMinutos) {
          isOccupied = true;
          break;
        }
      }
      
      // Verificar se há tempo suficiente para os procedimentos selecionados
      let hasEnoughTime = true;
      if (formData.procedimento_ids.length > 0) {
        // Calcular duração total de todos os procedimentos
        const duracaoTotal = formData.procedimento_ids.reduce((total, procId) => {
          const servico = servicos.find(s => s.id === procId);
          return total + (servico?.duracao_minutos || 60);
        }, 0);
        
        if (duracaoTotal > 0) {
          hasEnoughTime = canFitService(slot.time, dateStr, duracaoTotal);
        }
      }
      
      return {
        ...slot,
        isBooked: isOccupied || !hasEnoughTime
      };
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.nome || !formData.telefone || !formData.data_agendamento || !formData.hora_agendamento || formData.preco <= 0) {
      toast({
        title: "Erro",
        description: "Preencha todos os campos obrigatórios",
        variant: "destructive"
      });
      return;
    }
    try {
      // Verificar se é um novo agendamento e se o cliente tem saldo de crédito
      let descontoAutomatico = formData.tem_desconto;
      let porcentagemDescontoAutomatica = formData.porcentagem_desconto;

      if (!editingAgendamento) {
        // Buscar saldo do cliente
        const { data: clienteData } = await supabase
          .from('clientes')
          .select('saldo_credito')
          .eq('telefone', formData.telefone)
          .single();

        if (clienteData && clienteData.saldo_credito > 0) {
          const saldoDisponivel = clienteData.saldo_credito;
          const valorDesconto = Math.min(saldoDisponivel, formData.preco);
          const porcentagemDesconto = (valorDesconto / formData.preco) * 100;

          descontoAutomatico = true;
          porcentagemDescontoAutomatica = porcentagemDesconto;

          // Deduzir do saldo do cliente
          const novoSaldo = saldoDisponivel - valorDesconto;
          await supabase
            .from('clientes')
            .update({ saldo_credito: novoSaldo })
            .eq('telefone', formData.telefone);

          toast({
            title: "Crédito aplicado",
            description: `R$ ${valorDesconto.toFixed(2)} de crédito foi aplicado como desconto`,
          });
        }
      }

      const agendamentoData = {
        nome: formData.nome,
        telefone: formData.telefone,
        preco: formData.preco,
        tem_desconto: descontoAutomatico,
        pagamento_antecipado: formData.pagamento_antecipado,
        data_agendamento: formData.data_agendamento,
        hora_agendamento: formData.hora_agendamento,
        tem_retorno: formData.tem_retorno,
        status: formData.status,
        procedimento_id: formData.procedimento_ids.length > 0 ? formData.procedimento_ids[0] : null,
        porcentagem_desconto: descontoAutomatico ? porcentagemDescontoAutomatica : null,
        porcentagem_pagamento_antecipado: formData.pagamento_antecipado ? formData.porcentagem_pagamento_antecipado : null,
        data_retorno: formData.tem_retorno ? formData.data_retorno : null,
        preco_retorno: formData.tem_retorno ? formData.preco_retorno : null,
        observacoes: formData.observacoes || null
      };

      // Criar cliente se não existir
      const clienteExistente = clientes.find(c => c.telefone === formData.telefone);
      if (!clienteExistente) {
        const { error: clienteError } = await supabase.from('clientes').insert([{
          nome: formData.nome,
          telefone: formData.telefone
        }]);
        if (clienteError) {
          console.warn('Erro ao criar cliente:', clienteError);
        } else {
          fetchClientes();
        }
      }

      let agendamentoId: string;

      if (editingAgendamento) {
        const { error } = await supabase
          .from('agendamentos')
          .update(agendamentoData)
          .eq('id', editingAgendamento.id);
        if (error) throw error;
        agendamentoId = editingAgendamento.id;

        // Deletar procedimentos antigos
        await supabase
          .from('agendamento_procedimentos')
          .delete()
          .eq('agendamento_id', agendamentoId);

        toast({
          title: "Sucesso",
          description: "Agendamento atualizado com sucesso!"
        });
      } else {
        const { data: newAgendamento, error } = await supabase
          .from('agendamentos')
          .insert([agendamentoData])
          .select()
          .single();
        if (error) throw error;
        agendamentoId = newAgendamento.id;

        toast({
          title: "Sucesso",
          description: "Agendamento criado com sucesso!"
        });

        // Enviar mensagem curta de confirmação no WhatsApp se existir chat
        try {
          const digits = (formData.telefone || '').replace(/\D/g, '');
          const last8 = digits.slice(-8);
          if (last8) {
            const { data: chatRow } = await supabase
              .from('whatsapp_chats')
              .select('id, remote_jid, telefone')
              .ilike('telefone', `%${last8}%`)
              .limit(1)
              .maybeSingle();

            if (chatRow?.remote_jid) {
              await supabase.functions.invoke('whatsapp-send', {
                body: {
                  chat_id: chatRow.id,
                  remote_jid: chatRow.remote_jid,
                  type: 'text',
                  content: 'agendada 🫶',
                },
              });
            }
          }
        } catch (e) {
          console.warn('Não foi possível enviar confirmação automática:', e);
        }
      }

      // Inserir novos procedimentos
      if (formData.procedimento_ids.length > 0) {
        const procedimentosData = formData.procedimento_ids.map((procId, index) => ({
          agendamento_id: agendamentoId,
          procedimento_id: procId,
          ordem: index + 1
        }));

        const { error: procError } = await supabase
          .from('agendamento_procedimentos')
          .insert(procedimentosData);
        
        if (procError) {
          console.error('Erro ao inserir procedimentos:', procError);
        }
      }

      resetForm();
      fetchAgendamentos();
    } catch (error) {
      console.error('Erro ao salvar agendamento:', error);
      toast({
        title: "Erro",
        description: "Não foi possível salvar o agendamento",
        variant: "destructive"
      });
    }
  };
  const resetForm = () => {
    const targetDate = selectedDate || new Date();
    const formattedDate = format(targetDate, 'yyyy-MM-dd');
    setFormData({
      nome: '',
      telefone: '',
      procedimento_ids: [],
      preco: 0,
      tem_desconto: false,
      porcentagem_desconto: 0,
      pagamento_antecipado: false,
      porcentagem_pagamento_antecipado: 0,
      data_agendamento: formattedDate,
      hora_agendamento: selectedTimeSlot,
      tem_retorno: false,
      data_retorno: '',
      preco_retorno: 0,
      status: 'Agendado',
      observacoes: ''
    });
    setEditingAgendamento(null);
    setSelectedTimeSlot('');
    setDialogOpen(false);
  };
  const handleEdit = async (agendamento: Agendamento) => {
    // Buscar procedimentos do agendamento
    const { data: procs } = await supabase
      .from('agendamento_procedimentos')
      .select('procedimento_id')
      .eq('agendamento_id', agendamento.id)
      .order('ordem');
    
    const procedimentoIds = procs?.map(p => p.procedimento_id) || [];

    setFormData({
      nome: agendamento.nome,
      telefone: agendamento.telefone,
      procedimento_ids: procedimentoIds,
      preco: agendamento.preco,
      tem_desconto: agendamento.tem_desconto,
      porcentagem_desconto: agendamento.porcentagem_desconto || 0,
      pagamento_antecipado: agendamento.pagamento_antecipado || false,
      porcentagem_pagamento_antecipado: agendamento.porcentagem_pagamento_antecipado || 0,
      data_agendamento: agendamento.data_agendamento,
      hora_agendamento: agendamento.hora_agendamento,
      tem_retorno: agendamento.tem_retorno,
      data_retorno: agendamento.data_retorno || '',
      preco_retorno: agendamento.preco_retorno || 0,
      status: agendamento.status,
      observacoes: agendamento.observacoes || ''
    });
    setEditingAgendamento(agendamento);
    setSelectedTimeSlot(agendamento.hora_agendamento);
    setDialogOpen(true);
  };
  const updateAgendamentoStatus = async (id: string, newStatus: string) => {
    if (newStatus === 'Concluído') {
      // Abrir dialog de forma de pagamento
      setAgendamentoConcluindo(id);
      setFormaPagamentoDialogOpen(true);
      return;
    }
    
    try {
      const { error } = await supabase
        .from('agendamentos')
        .update({ status: newStatus })
        .eq('id', id);
      
      if (error) throw error;
      
      toast({
        title: "Sucesso",
        description: `Status atualizado para ${newStatus}`
      });
      
      fetchAgendamentos();
    } catch (error) {
      console.error('Erro ao atualizar status:', error);
      toast({
        title: "Erro",
        description: "Não foi possível atualizar o status",
        variant: "destructive"
      });
    }
  };

  const handleFormaPagamentoConfirm = async (formaPagamento: string) => {
    if (!agendamentoConcluindo) return;
    
    // O agendamento e a transação já foram atualizados no FormaPagamentoDialog
    toast({
      title: "Sucesso",
      description: "Agendamento concluído com sucesso!"
    });
    
    setFormaPagamentoDialogOpen(false);
    setAgendamentoConcluindo(null);
    fetchAgendamentos();
  };
  const deleteAgendamento = async (id: string) => {
    try {
      const {
        error
      } = await supabase.from('agendamentos').delete().eq('id', id);
      if (error) throw error;
      toast({
        title: "Sucesso",
        description: "Agendamento excluído com sucesso!"
      });
      fetchAgendamentos();
    } catch (error) {
      console.error('Erro ao excluir agendamento:', error);
      toast({
        title: "Erro",
        description: "Não foi possível excluir o agendamento",
        variant: "destructive"
      });
    }
  };
  const openWhatsApp = (telefone: string, nome: string, data: string, hora: string) => {
    const message = encodeURIComponent(`Olá ${nome}! Confirmando seu agendamento para ${data} às ${hora}. Aguardamos você!`);
    const phoneNumber = telefone.replace(/\D/g, '');
    window.open(`https://wa.me/55${phoneNumber}?text=${message}`, '_blank');
  };
  const handleTelefoneChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    let telefone = e.target.value;
    
    // Remove todos os caracteres não numéricos
    telefone = telefone.replace(/\D/g, '');
    
    // Remove +55 se começar com isso
    if (telefone.startsWith('55') && telefone.length > 11) {
      telefone = telefone.substring(2);
    }
    
    // Limita a 11 dígitos
    if (telefone.length > 11) {
      telefone = telefone.substring(0, 11);
    }
    
    setFormData({
      ...formData,
      telefone
    });

    // Buscar cliente existente
    const clienteExistente = clientes.find(c => c.telefone === telefone);
    if (clienteExistente) {
      setFormData(prev => ({
        ...prev,
        nome: clienteExistente.nome
      }));
    }
  };
  const handleNomeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const nome = e.target.value;
    setFormData({
      ...formData,
      nome
    });
    if (nome.length > 0) {
      const filtered = clientes.filter(cliente => cliente.nome.toLowerCase().includes(nome.toLowerCase()));
      setFilteredClientes(filtered);
      setShowSuggestions(filtered.length > 0);
    } else {
      setShowSuggestions(false);
      setFilteredClientes([]);
    }
  };
  const handleClienteSelect = (cliente: {
    telefone: string;
    nome: string;
  }) => {
    setFormData({
      ...formData,
      nome: cliente.nome,
      telefone: cliente.telefone
    });
    setShowSuggestions(false);
    setFilteredClientes([]);
  };
  const handleClickOutside = (e: MouseEvent) => {
    const target = e.target as HTMLElement;
    if (!target.closest('.suggestions-container')) {
      setShowSuggestions(false);
    }
  };
  useEffect(() => {
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold">Calendário</h2>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button onClick={() => {
            resetForm();
            setDialogOpen(true);
          }} className={isMobile ? "px-2" : ""}>
              <Plus className="h-4 w-4" />
              {!isMobile && <span className="ml-2">Novo Agendamento</span>}
            </Button>
          </DialogTrigger>
          <DialogContent className="w-[95%] max-w-2xl mx-auto max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>
                {editingAgendamento ? 'Editar Agendamento' : 'Novo Agendamento'}
              </DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="telefone">Telefone *</Label>
                  <Input id="telefone" value={formData.telefone} onChange={handleTelefoneChange} placeholder="(11) 99999-9999" />
                </div>
                <div className="suggestions-container relative">
                  <Label htmlFor="nome">Nome *</Label>
                  <Input id="nome" value={formData.nome} onChange={handleNomeChange} placeholder="Nome do cliente" autoComplete="off" />
                  {showSuggestions && filteredClientes.length > 0 && <div className="absolute z-50 w-full mt-1 bg-background border border-border rounded-md shadow-lg max-h-40 overflow-y-auto">
                      {filteredClientes.map((cliente, index) => <div key={index} className="px-3 py-2 cursor-pointer hover:bg-accent hover:text-accent-foreground text-sm" onClick={() => handleClienteSelect(cliente)}>
                          <div className="font-medium">{cliente.nome}</div>
                          <div className="text-xs text-muted-foreground">{cliente.telefone}</div>
                        </div>)}
                    </div>}
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="data">Data *</Label>
                  <Input id="data" type="date" value={formData.data_agendamento} onChange={e => setFormData({
                  ...formData,
                  data_agendamento: e.target.value
                })} />
                </div>
                <div>
                  <Label htmlFor="hora">Hora *</Label>
                  <Select value={selectedTimeSlot} onValueChange={value => {
                  setSelectedTimeSlot(value);
                  setFormData({
                    ...formData,
                    hora_agendamento: value
                  });
                }}>
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione um horário" />
                    </SelectTrigger>
                    <SelectContent className="max-h-60">
                      {getAvailableTimeSlots().map(slot => <SelectItem key={slot.time} value={slot.time} disabled={slot.isBooked && (!editingAgendamento || editingAgendamento.hora_agendamento !== slot.time)} className={slot.isSpecial ? "text-orange-600 font-medium" : ""}>
                          {slot.time} 
                          {slot.isSpecial && " (Especial)"}
                          {slot.isBooked && " (Ocupado)"}
                        </SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div>
                <Label htmlFor="procedimentos">Procedimentos</Label>
                <div className="space-y-2">
                  {formData.procedimento_ids.map((procId, index) => {
                    const servico = servicos.find(s => s.id === procId);
                    return (
                      <div key={index} className="flex items-center gap-2">
                        <Select value={procId} onValueChange={value => {
                          const newIds = [...formData.procedimento_ids];
                          newIds[index] = value;
                          setFormData({ ...formData, procedimento_ids: newIds });
                        }}>
                          <SelectTrigger>
                            <SelectValue placeholder="Selecione um procedimento" />
                          </SelectTrigger>
                          <SelectContent>
                            {servicos.map(servico => (
                              <SelectItem key={servico.id} value={servico.id}>
                                {servico.nome_procedimento} - R$ {servico.valor.toFixed(2)}
                                {servico.duracao_minutos && ` (${servico.duracao_minutos}min)`}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            const newIds = formData.procedimento_ids.filter((_, i) => i !== index);
                            setFormData({ ...formData, procedimento_ids: newIds });
                          }}
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      </div>
                    );
                  })}
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setFormData({ 
                        ...formData, 
                        procedimento_ids: [...formData.procedimento_ids, ''] 
                      });
                    }}
                    className="w-full"
                  >
                    <Plus className="h-4 w-4 mr-2" />
                    Adicionar Procedimento
                  </Button>
                </div>
              </div>

              <div>
                <Label htmlFor="preco">Preço Total (R$) *</Label>
                <Input 
                  id="preco" 
                  type="number" 
                  step="0.01" 
                  min="0" 
                  value={formData.preco} 
                  onChange={e => setFormData({
                    ...formData,
                    preco: parseFloat(e.target.value) || 0
                  })} 
                  placeholder="0.00" 
                />
                {formData.procedimento_ids.length > 0 && (
                  <p className="text-xs text-muted-foreground mt-1">
                    Calculado automaticamente
                  </p>
                )}
              </div>

              <div className="flex items-center space-x-2">
                <Checkbox id="desconto" checked={formData.tem_desconto} onCheckedChange={checked => setFormData({
                ...formData,
                tem_desconto: !!checked
              })} />
                <Label htmlFor="desconto">Aplicar desconto</Label>
                {formData.tem_desconto && <div className="flex items-center gap-2 ml-4">
                    <Input type="number" min="0" max="100" value={formData.porcentagem_desconto} onChange={e => setFormData({
                  ...formData,
                  porcentagem_desconto: parseFloat(e.target.value) || 0
                })} className="w-20" placeholder="0" />
                    <span className="text-sm">%</span>
                  </div>}
              </div>

              <div className="flex items-center space-x-2">
                <Checkbox id="pagamento_antecipado" checked={formData.pagamento_antecipado} onCheckedChange={checked => setFormData({
                ...formData,
                pagamento_antecipado: !!checked
              })} />
                <Label htmlFor="pagamento_antecipado">Pagamento antecipado (garantia)</Label>
                {formData.pagamento_antecipado && <div className="flex items-center gap-2 ml-4">
                    <Input type="number" min="0" max="100" value={formData.porcentagem_pagamento_antecipado} onChange={e => setFormData({
                  ...formData,
                  porcentagem_pagamento_antecipado: parseFloat(e.target.value) || 0
                })} className="w-20" placeholder="0" />
                    <span className="text-sm">%</span>
                    {formData.pagamento_antecipado && formData.porcentagem_pagamento_antecipado > 0 && (
                      <span className="text-sm text-muted-foreground">
                        (R$ {(formData.preco * (formData.porcentagem_pagamento_antecipado / 100)).toFixed(2)})
                      </span>
                    )}
                  </div>}
              </div>

              <div>
                <Label htmlFor="observacoes">Observações</Label>
                <Textarea id="observacoes" value={formData.observacoes} onChange={e => setFormData({
                ...formData,
                observacoes: e.target.value
              })} placeholder="Observações sobre o agendamento..." />
              </div>

              <div className="flex gap-2 pt-2">
                <Button type="button" variant="outline" onClick={resetForm} className="flex-1">
                  Cancelar
                </Button>
                <Button type="submit" className="flex-1">
                  {editingAgendamento ? 'Atualizar' : 'Salvar'}
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Calendário */}
        <Card>
          
          <CardContent className="p-6">
            <Calendar 
              mode="single" 
              selected={selectedDate} 
              onSelect={(date) => {
                console.log('Calendar clicked, date received:', date);
                if (date) {
                  setSelectedDate(date);
                  setSelectedTimeSlot('');
                  const formattedDate = format(date, 'yyyy-MM-dd');
                  console.log('Setting formData with date:', formattedDate);
                  setFormData(prev => ({
                    ...prev,
                    data_agendamento: formattedDate
                  }));
                }
              }} 
              className="rounded-md border mx-auto" 
              locale={ptBR} 
              modifiers={{
                hasAgendamentosPast: date => hasAgendamentosPast(date),
                hasAgendamentosFuture: date => hasAgendamentosFuture(date),
                selected: selectedDate
              }} 
              modifiersStyles={{
                hasAgendamentosPast: {
                  backgroundColor: 'hsl(var(--muted))',
                  color: 'hsl(var(--muted-foreground))',
                  opacity: 0.5,
                  fontWeight: 'normal'
                },
                hasAgendamentosFuture: {
                  backgroundColor: 'hsl(var(--primary))',
                  color: 'hsl(var(--primary-foreground))',
                  fontWeight: 'bold'
                },
                selected: {
                  border: '2px solid hsl(var(--primary))',
                  backgroundColor: 'hsl(var(--background))',
                  color: 'hsl(var(--foreground))',
                  fontWeight: 'bold'
                }
              }}
              components={{
                Day: ({ date, ...props }) => {
                  const count = getAgendadosCount(date);
                  const isSelected = selectedDate && isSameDay(date, selectedDate);
                  
                  return (
                    <button 
                      {...props} 
                      className={`relative w-full h-full flex flex-col items-center justify-center p-0 cursor-pointer hover:bg-accent hover:text-accent-foreground rounded-md transition-colors ${isSelected ? 'ring-2 ring-primary ring-offset-2' : ''}`}
                      onClick={() => {
                        console.log('Day clicked:', date);
                        if (date) {
                          setSelectedDate(date);
                          setSelectedTimeSlot('');
                          const formattedDate = format(date, 'yyyy-MM-dd');
                          setFormData(prev => ({
                            ...prev,
                            data_agendamento: formattedDate
                          }));
                        }
                      }}
                    >
                      <span>{date.getDate()}</span>
                      {count > 0 && (
                        <div className="absolute -top-1 -right-1 bg-blue-500 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center">
                          {count}
                        </div>
                      )}
                    </button>
                  );
                }
              }}
            />
          </CardContent>
        </Card>

        {/* Horários Disponíveis */}
        {selectedDate && <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="text-lg">
                  Horários para {format(selectedDate, 'dd/MM/yyyy', {
                locale: ptBR
              })}
                </CardTitle>
                <Button 
                  size="sm" 
                  variant="outline"
                  onClick={() => {
                    const dateStr = format(selectedDate, 'dd/MM/yyyy', { locale: ptBR });
                    const now = new Date();
                    const currentTime = format(now, 'HH:mm');
                    const isToday = isSameDay(selectedDate, now);
                    
                    const availableSlots = getAvailableTimeSlots()
                      .filter(slot => {
                        // Filter out booked slots
                        if (slot.isBooked) return false;
                        
                        // If it's today, only show times from current time onwards
                        if (isToday) {
                          return slot.time >= currentTime;
                        }
                        
                        return true;
                      })
                      .map(slot => slot.time)
                      .join(', ');
                    
                    const message = `Horários disponíveis para ${dateStr}:\n\n${availableSlots}`;
                    
                    if (navigator.share) {
                      navigator.share({
                        title: `Horários Disponíveis - ${dateStr}`,
                        text: message
                      });
                    } else {
                      navigator.clipboard.writeText(message);
                      toast({
                        title: "Copiado!",
                        description: "Horários copiados para a área de transferência"
                      });
                    }
                  }}
                >
                  📤 Enviar
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-2 max-h-80 overflow-y-auto">
                {getAvailableTimeSlots()
                  .filter(slot => {
                    // If it's today, only show times from current time onwards
                    const now = new Date();
                    const currentTime = format(now, 'HH:mm');
                    const isToday = selectedDate && isSameDay(selectedDate, now);
                    
                    if (isToday && slot.time < currentTime) {
                      return false;
                    }
                    
                    return true;
                  })
                  .map(slot => <Button key={slot.time} variant={slot.isBooked ? "secondary" : selectedTimeSlot === slot.time ? "default" : "outline"} size="sm" disabled={slot.isBooked} onClick={() => {
              if (!slot.isBooked) {
                setSelectedTimeSlot(slot.time);
                // Usar a data selecionada corretamente
                const targetDate = selectedDate || new Date();
                const formattedDate = format(targetDate, 'yyyy-MM-dd');
                setFormData({
                  ...formData,
                  hora_agendamento: slot.time,
                  data_agendamento: formattedDate
                });
                setDialogOpen(true);
              }
            }} className={`${slot.isSpecial ? 'border-orange-500 text-orange-600' : ''} ${slot.isBooked ? 'opacity-50' : ''}`}>
                    {slot.time}
                    {slot.isSpecial && "*"}
                  </Button>)}
              </div>
              <p className="text-xs text-muted-foreground mt-2">
                * Horários especiais (fora do horário padrão 11h-20h)
              </p>
            </CardContent>
          </Card>}

        {/* Agendamentos do dia selecionado */}
        <Card id="agendamentos-list">
          <CardHeader>
            <CardTitle className="text-lg">
              Agendamentos de {selectedDate ? format(selectedDate, 'dd/MM/yyyy', {
              locale: ptBR
            }) : 'hoje'}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {/* Faturamento do dia */}
              {selectedDate && (
                <Card className="bg-gradient-to-r from-green-50 to-green-100 border-green-200">
                  <CardContent className="p-4">
                    <div className="flex items-center gap-2">
                      <DollarSign className="h-5 w-5 text-green-600" />
                      <div>
                        <div className="text-sm text-green-800 font-medium">Faturamento do Dia</div>
                        <div className="text-xl font-bold text-green-700">
                          R$ {agendamentosDodia
                            .filter(agendamento => agendamento.status === 'Concluído')
                            .reduce((total, agendamento) => {
                              let valor = agendamento.preco;
                              if (agendamento.tem_desconto && agendamento.porcentagem_desconto) {
                                valor = valor * (1 - agendamento.porcentagem_desconto / 100);
                              }
                              return total + valor;
                            }, 0)
                            .toFixed(2)}
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )}

              {agendamentosDodia.length === 0 ? <p className="text-muted-foreground text-center py-8">Nenhum agendamento para este dia</p> : (
                <div className="space-y-4">
                
                {agendamentosDodia.map(agendamento => <div key={agendamento.id} className="border rounded-lg p-4">
                    <div className="flex items-center justify-between mb-2">
                      <div>
                        <h4 className="font-medium">{agendamento.nome}</h4>
                        <p className="text-sm text-muted-foreground">{agendamento.telefone}</p>
                      </div>
                      <Badge className={getStatusColor(agendamento.status)}>{agendamento.status}</Badge>
                    </div>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-sm mb-3">
                      <div className="flex items-center gap-1">
                        <Clock className="w-4 h-4" />
                        <span>
                          {(() => {
                            // Calcular duração total de todos os procedimentos
                            const procedimentosAgendamento = (agendamento as any).agendamento_procedimentos || [];
                            const duracaoTotal = procedimentosAgendamento.reduce((total: number, proc: any) => {
                              const servico = servicos.find(s => s.id === proc.procedimento_id);
                              return total + (servico?.duracao_minutos || 60);
                            }, 0);
                            
                            const [horaInicio, minutoInicio] = agendamento.hora_agendamento.split(':').map(Number);
                            const inicioTotalMinutos = horaInicio * 60 + minutoInicio;
                            const fimTotalMinutos = inicioTotalMinutos + duracaoTotal;
                            
                            const horaFim = Math.floor(fimTotalMinutos / 60);
                            const minutoFim = fimTotalMinutos % 60;
                            
                            const horaFimStr = horaFim.toString().padStart(2, '0');
                            const minutoFimStr = minutoFim.toString().padStart(2, '0');
                            
                            return `${agendamento.hora_agendamento.substring(0, 5)} - ${horaFimStr}:${minutoFimStr} (${duracaoTotal}min)`;
                          })()}
                        </span>
                      </div>
                      <div className="flex items-center gap-1">
                        <DollarSign className="w-4 h-4" />
                        <span>R$ {agendamento.preco.toFixed(2)}</span>
                        {agendamento.tem_desconto && agendamento.porcentagem_desconto && <span className="text-green-600 text-xs">
                            (-{agendamento.porcentagem_desconto}%)
                          </span>}
                      </div>
                    </div>
                    
                    {/* Mostrar todos os procedimentos */}
                    {(agendamento as any).agendamento_procedimentos && (agendamento as any).agendamento_procedimentos.length > 0 && (
                      <div className="text-sm text-muted-foreground mb-3">
                        <strong>Procedimentos:</strong>
                        <div className="mt-1 space-y-1">
                          {(agendamento as any).agendamento_procedimentos.map((proc: any, index: number) => {
                            const servico = servicos.find(s => s.id === proc.procedimento_id);
                            return (
                              <div key={proc.id} className="flex items-center gap-2">
                                <span className="text-xs bg-primary/10 text-primary rounded px-2 py-0.5">
                                  {index + 1}
                                </span>
                                <span>{servico?.nome_procedimento || 'Não encontrado'}</span>
                                <span className="text-xs">({servico?.duracao_minutos || 60}min)</span>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}

                    {/* Pagamento Antecipado */}
                    {agendamento.pagamento_antecipado && agendamento.porcentagem_pagamento_antecipado && agendamento.porcentagem_pagamento_antecipado > 0 && (
                      <div className="bg-primary/10 border border-primary/20 rounded p-2 text-sm mb-3">
                        <div className="font-semibold text-primary mb-1">💰 Pagamento Antecipado</div>
                        <div className="flex justify-between text-xs">
                          <span>Pago:</span>
                          <span className="font-semibold text-success">
                            R$ {(() => {
                              let precoFinal = agendamento.preco;
                              if (agendamento.tem_desconto && agendamento.porcentagem_desconto) {
                                precoFinal = precoFinal * (1 - agendamento.porcentagem_desconto / 100);
                              }
                              return (precoFinal * (agendamento.porcentagem_pagamento_antecipado / 100)).toFixed(2);
                            })()} ({agendamento.porcentagem_pagamento_antecipado}%)
                          </span>
                        </div>
                        <div className="flex justify-between text-xs">
                          <span>Restante:</span>
                          <span className="font-semibold">
                            R$ {(() => {
                              let precoFinal = agendamento.preco;
                              if (agendamento.tem_desconto && agendamento.porcentagem_desconto) {
                                precoFinal = precoFinal * (1 - agendamento.porcentagem_desconto / 100);
                              }
                              return (precoFinal * (1 - agendamento.porcentagem_pagamento_antecipado / 100)).toFixed(2);
                            })()}
                          </span>
                        </div>
                      </div>
                    )}

                    {/* Mostrar forma de pagamento para agendamentos concluídos */}
                    {agendamento.status === 'Concluído' && agendamento.forma_pagamento && (
                      <div className="text-sm text-muted-foreground mb-3">
                        <strong>Forma de pagamento:</strong> {agendamento.forma_pagamento}
                      </div>
                    )}

                    <div className="flex gap-2 flex-wrap">
                      <Button size="sm" variant="outline" onClick={() => handleEdit(agendamento)}>
                        <Edit2 className="w-4 h-4" />
                      </Button>
                      
                      <Button size="sm" variant="outline" onClick={() => openWhatsApp(agendamento.telefone, agendamento.nome, format(new Date(agendamento.data_agendamento), 'dd/MM/yyyy'), agendamento.hora_agendamento)}>
                        <MessageCircle className="w-4 h-4" />
                      </Button>

                      {agendamento.status !== 'Concluído' && agendamento.status !== 'Cancelado' && (
                        <Button 
                          size="sm" 
                          variant="outline" 
                          onClick={() => {
                            setAgendamentoAdiantamento(agendamento);
                            setPagamentoAntecipadoDialogOpen(true);
                          }}
                          className="text-primary border-primary"
                        >
                          <Wallet className="w-4 h-4" />
                        </Button>
                      )}

                      {agendamento.status === 'Agendado' && <Button size="sm" variant="outline" onClick={() => updateAgendamentoStatus(agendamento.id, 'Concluído')} className="text-green-600 border-green-600">
                          <Check className="w-4 h-4" />
                        </Button>}

                      {agendamento.status === 'Agendado' && <Button size="sm" variant="outline" onClick={() => updateAgendamentoStatus(agendamento.id, 'Cancelado')} className="text-red-600 border-red-600">
                          <X className="w-4 h-4" />
                        </Button>}

                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button size="sm" variant="outline" className="text-red-600 border-red-600">
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Excluir Agendamento</AlertDialogTitle>
                            <AlertDialogDescription>
                              Tem certeza que deseja excluir este agendamento? Esta ação não pode ser desfeita.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Cancelar</AlertDialogCancel>
                            <AlertDialogAction onClick={() => deleteAgendamento(agendamento.id)} className="bg-red-600 hover:bg-red-700">
                              Excluir
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </div>
                  </div>)}
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Dialog de Forma de Pagamento */}
      {agendamentoConcluindo && (() => {
        const agendamento = agendamentos.find(a => a.id === agendamentoConcluindo);
        if (!agendamento) return null;
        
        const valorFinal = agendamento.tem_desconto && agendamento.porcentagem_desconto
          ? agendamento.preco * (1 - agendamento.porcentagem_desconto / 100)
          : agendamento.preco;
        
        const valorRestante = agendamento.pagamento_antecipado && agendamento.porcentagem_pagamento_antecipado
          ? valorFinal * (1 - agendamento.porcentagem_pagamento_antecipado / 100)
          : valorFinal;

        return (
          <FormaPagamentoDialog
            open={formaPagamentoDialogOpen}
            onOpenChange={setFormaPagamentoDialogOpen}
            onConfirm={handleFormaPagamentoConfirm}
            agendamentoId={agendamentoConcluindo}
            valorServico={valorRestante}
            clienteTelefone={agendamento.telefone}
          />
        );
      })()}

      {/* Dialog de Pagamento Antecipado */}
      {agendamentoAdiantamento && (
        <PagamentoAntecipadoDialog
          open={pagamentoAntecipadoDialogOpen}
          onOpenChange={setPagamentoAntecipadoDialogOpen}
          agendamentoId={agendamentoAdiantamento.id}
          nomeCliente={agendamentoAdiantamento.nome}
          precoTotal={agendamentoAdiantamento.preco}
          temDesconto={agendamentoAdiantamento.tem_desconto}
          porcentagemDesconto={agendamentoAdiantamento.porcentagem_desconto}
          porcentagemAtual={agendamentoAdiantamento.porcentagem_pagamento_antecipado || 0}
          onConfirm={() => {
            fetchAgendamentos();
            setAgendamentoAdiantamento(null);
          }}
        />
      )}
    </div>
  );
};
export default CalendarioPage;