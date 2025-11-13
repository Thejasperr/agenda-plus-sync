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
    procedimento_id: '',
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
  const fetchAgendamentos = async () => {
    try {
      const {
        data,
        error
      } = await supabase.from('agendamentos').select('*').order('data_agendamento', {
        ascending: true
      }).order('hora_agendamento', {
        ascending: true
      });
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
        const servicoAgendado = servicos.find(s => s.id === agendamento.procedimento_id);
        const duracaoAgendado = servicoAgendado?.duracao_minutos || 60;
        
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
      const servicoAgendado = servicos.find(s => s.id === agendamento.procedimento_id);
      const duracaoAgendado = servicoAgendado?.duracao_minutos || 60;
      
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
        const servicoSelecionado = servicos.find(s => s.id === agendamento.procedimento_id);
        const duracaoMinutos = servicoSelecionado?.duracao_minutos || 60; // Default 60 minutos
        
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
      
      // Verificar se há tempo suficiente para o procedimento selecionado
      let hasEnoughTime = true;
      if (formData.procedimento_id) {
        const servicoAtual = servicos.find(s => s.id === formData.procedimento_id);
        if (servicoAtual?.duracao_minutos) {
          hasEnoughTime = canFitService(slot.time, dateStr, servicoAtual.duracao_minutos);
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
      const agendamentoData = {
        ...formData,
        procedimento_id: formData.procedimento_id || null,
        porcentagem_desconto: formData.tem_desconto ? formData.porcentagem_desconto : null,
        porcentagem_pagamento_antecipado: formData.pagamento_antecipado ? formData.porcentagem_pagamento_antecipado : null,
        data_retorno: formData.tem_retorno ? formData.data_retorno : null,
        preco_retorno: formData.tem_retorno ? formData.preco_retorno : null,
        observacoes: formData.observacoes || null,
        // Garantir que a data seja salva corretamente
        data_agendamento: formData.data_agendamento
      };

      // Criar cliente se não existir
      const clienteExistente = clientes.find(c => c.telefone === formData.telefone);
      if (!clienteExistente) {
        const {
          error: clienteError
        } = await supabase.from('clientes').insert([{
          nome: formData.nome,
          telefone: formData.telefone
        }]);
        if (clienteError) {
          console.warn('Erro ao criar cliente:', clienteError);
        } else {
          fetchClientes();
        }
      }
      if (editingAgendamento) {
        const {
          error
        } = await supabase.from('agendamentos').update(agendamentoData).eq('id', editingAgendamento.id);
        if (error) throw error;
        toast({
          title: "Sucesso",
          description: "Agendamento atualizado com sucesso!"
        });
      } else {
        const {
          error
        } = await supabase.from('agendamentos').insert([agendamentoData]);
        if (error) throw error;
        toast({
          title: "Sucesso",
          description: "Agendamento criado com sucesso!"
        });
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
    // Fix timezone issue by ensuring correct date formatting
    const targetDate = selectedDate || new Date();
    const formattedDate = format(targetDate, 'yyyy-MM-dd');
    setFormData({
      nome: '',
      telefone: '',
      procedimento_id: '',
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
  const handleEdit = (agendamento: Agendamento) => {
    setFormData({
      nome: agendamento.nome,
      telefone: agendamento.telefone,
      procedimento_id: agendamento.procedimento_id || '',
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

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="procedimento">Serviço</Label>
                  <Select value={formData.procedimento_id} onValueChange={value => {
                  const servico = servicos.find(s => s.id === value);
                  setFormData({
                    ...formData,
                    procedimento_id: value,
                    preco: servico ? servico.valor : formData.preco
                  });
                }}>
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione um serviço" />
                    </SelectTrigger>
                    <SelectContent>
                      {getServicosDisponiveis().map(servico => <SelectItem key={servico.id} value={servico.id}>
                          {servico.nome_procedimento} - R$ {servico.valor.toFixed(2)}
                          {servico.duracao_minutos && ` (${servico.duracao_minutos}min)`}
                        </SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label htmlFor="preco">Preço (R$) *</Label>
                  <Input id="preco" type="number" step="0.01" min="0" value={formData.preco} onChange={e => setFormData({
                  ...formData,
                  preco: parseFloat(e.target.value) || 0
                })} placeholder="0.00" />
                </div>
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
                            const servicoSelecionado = servicos.find(s => s.id === agendamento.procedimento_id);
                            const duracaoMinutos = servicoSelecionado?.duracao_minutos || 60;
                            
                            const [horaInicio, minutoInicio] = agendamento.hora_agendamento.split(':').map(Number);
                            const inicioTotalMinutos = horaInicio * 60 + minutoInicio;
                            const fimTotalMinutos = inicioTotalMinutos + duracaoMinutos;
                            
                            const horaFim = Math.floor(fimTotalMinutos / 60);
                            const minutoFim = fimTotalMinutos % 60;
                            
                            const horaFimStr = horaFim.toString().padStart(2, '0');
                            const minutoFimStr = minutoFim.toString().padStart(2, '0');
                            
                            return `${agendamento.hora_agendamento.substring(0, 5)} - ${horaFimStr}:${minutoFimStr}`;
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
                    
                    {/* Mostrar nome do procedimento */}
                    {agendamento.procedimento_id && (
                      <div className="text-sm text-muted-foreground mb-3">
                        <strong>Procedimento:</strong> {servicos.find(s => s.id === agendamento.procedimento_id)?.nome_procedimento || 'Não encontrado'}
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
      <FormaPagamentoDialog
        open={formaPagamentoDialogOpen}
        onOpenChange={setFormaPagamentoDialogOpen}
        onConfirm={handleFormaPagamentoConfirm}
        agendamentoId={agendamentoConcluindo || ''}
      />

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