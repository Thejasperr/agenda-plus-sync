import React, { useState, useEffect } from 'react';
import { Plus, Search, Calendar as CalendarIcon, Clock, DollarSign, Filter, Edit2, MessageCircle, ChevronLeft, ChevronRight, Check, X, Clock4, Trash2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { format, isToday, startOfDay, isSameDay, addDays, subDays } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface Agendamento {
  id: string;
  nome: string;
  telefone: string;
  procedimento_id: string | null;
  preco: number;
  tem_desconto: boolean;
  porcentagem_desconto: number | null;
  data_agendamento: string;
  hora_agendamento: string;
  tem_retorno: boolean;
  data_retorno: string | null;
  preco_retorno: number | null;
  status: string;
  observacoes: string | null;
  created_at: string;
}

interface Servico {
  id: string;
  nome_procedimento: string;
  valor: number;
}

const AgendamentosTab = () => {
  const [agendamentos, setAgendamentos] = useState<Agendamento[]>([]);
  const [servicos, setServicos] = useState<Servico[]>([]);
  const [clientes, setClientes] = useState<{telefone: string, nome: string}[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('todos');
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingAgendamento, setEditingAgendamento] = useState<Agendamento | null>(null);
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const { toast } = useToast();

  const [formData, setFormData] = useState({
    nome: '',
    telefone: '',
    procedimento_id: '',
    preco: 0,
    tem_desconto: false,
    porcentagem_desconto: 0,
    data_agendamento: format(addDays(new Date(), 0), 'yyyy-MM-dd'),
    hora_agendamento: '',
    tem_retorno: false,
    data_retorno: '',
    preco_retorno: 0,
    status: 'Agendado',
    observacoes: ''
  });

  useEffect(() => {
    fetchAgendamentos();
    fetchServicos();
    fetchClientes();
  }, []);

  const fetchAgendamentos = async () => {
    try {
      const { data, error } = await supabase
        .from('agendamentos')
        .select('*')
        .order('data_agendamento', { ascending: true })
        .order('hora_agendamento', { ascending: true });

      if (error) throw error;
      setAgendamentos(data || []);
    } catch (error) {
      console.error('Erro ao buscar agendamentos:', error);
      toast({
        title: "Erro",
        description: "Não foi possível carregar os agendamentos",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const fetchServicos = async () => {
    try {
      const { data, error } = await supabase
        .from('servicos')
        .select('*')
        .order('nome_procedimento');

      if (error) throw error;
      setServicos(data || []);
    } catch (error) {
      console.error('Erro ao buscar serviços:', error);
    }
  };

  const fetchClientes = async () => {
    try {
      const { data, error } = await supabase
        .from('clientes')
        .select('telefone, nome');

      if (error) throw error;
      setClientes(data || []);
    } catch (error) {
      console.error('Erro ao buscar clientes:', error);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.nome || !formData.telefone || !formData.data_agendamento || !formData.hora_agendamento || formData.preco <= 0) {
      toast({
        title: "Erro",
        description: "Preencha todos os campos obrigatórios",
        variant: "destructive",
      });
      return;
    }

    try {
      const agendamentoData = {
        ...formData,
        procedimento_id: formData.procedimento_id || null,
        porcentagem_desconto: formData.tem_desconto ? formData.porcentagem_desconto : null,
        data_retorno: formData.tem_retorno ? formData.data_retorno : null,
        preco_retorno: formData.tem_retorno ? formData.preco_retorno : null,
        observacoes: formData.observacoes || null
      };

      // Criar cliente se não existir
      const clienteExistente = clientes.find(c => c.telefone === formData.telefone);
      if (!clienteExistente) {
        const { error: clienteError } = await supabase
          .from('clientes')
          .insert([{ 
            nome: formData.nome, 
            telefone: formData.telefone 
          }]);

        if (clienteError) {
          console.warn('Erro ao criar cliente:', clienteError);
        } else {
          fetchClientes(); // Atualizar lista de clientes
        }
      }

      if (editingAgendamento) {
        const { error } = await supabase
          .from('agendamentos')
          .update(agendamentoData)
          .eq('id', editingAgendamento.id);

        if (error) throw error;

        toast({
          title: "Sucesso",
          description: "Agendamento atualizado com sucesso!",
        });
      } else {
        const { error } = await supabase
          .from('agendamentos')
          .insert([agendamentoData]);

        if (error) throw error;

        toast({
          title: "Sucesso",
          description: "Agendamento criado com sucesso!",
        });
      }

      resetForm();
      fetchAgendamentos();
    } catch (error) {
      console.error('Erro ao salvar agendamento:', error);
      toast({
        title: "Erro",
        description: "Não foi possível salvar o agendamento",
        variant: "destructive",
      });
    }
  };

  const resetForm = () => {
    setFormData({
      nome: '',
      telefone: '',
      procedimento_id: '',
      preco: 0,
      tem_desconto: false,
      porcentagem_desconto: 0,
      data_agendamento: format(addDays(new Date(), 0), 'yyyy-MM-dd'),
      hora_agendamento: '',
      tem_retorno: false,
      data_retorno: '',
      preco_retorno: 0,
      status: 'Agendado',
      observacoes: ''
    });
    setEditingAgendamento(null);
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
      data_agendamento: agendamento.data_agendamento,
      hora_agendamento: agendamento.hora_agendamento,
      tem_retorno: agendamento.tem_retorno,
      data_retorno: agendamento.data_retorno || '',
      preco_retorno: agendamento.preco_retorno || 0,
      status: agendamento.status,
      observacoes: agendamento.observacoes || ''
    });
    setEditingAgendamento(agendamento);
    setDialogOpen(true);
  };

  const updateAgendamentoStatus = async (id: string, newStatus: string) => {
    try {
      const { error } = await supabase
        .from('agendamentos')
        .update({ status: newStatus })
        .eq('id', id);

      if (error) throw error;

      toast({
        title: "Sucesso",
        description: `Status atualizado para ${newStatus}`,
      });

      fetchAgendamentos();
    } catch (error) {
      console.error('Erro ao atualizar status:', error);
      toast({
        title: "Erro",
        description: "Não foi possível atualizar o status",
        variant: "destructive",
      });
    }
  };

  const deleteAgendamento = async (id: string) => {
    try {
      const { error } = await supabase
        .from('agendamentos')
        .delete()
        .eq('id', id);

      if (error) throw error;

      toast({
        title: "Sucesso",
        description: "Agendamento excluído com sucesso!",
      });

      fetchAgendamentos();
    } catch (error) {
      console.error('Erro ao excluir agendamento:', error);
      toast({
        title: "Erro",
        description: "Não foi possível excluir o agendamento",
        variant: "destructive",
      });
    }
  };

  const openWhatsApp = (telefone: string, nome: string, data: string, hora: string) => {
    const message = encodeURIComponent(`Olá ${nome}! Confirmando seu agendamento para ${data} às ${hora}. Aguardamos você!`);
    const phoneNumber = telefone.replace(/\D/g, '');
    window.open(`https://wa.me/55${phoneNumber}?text=${message}`, '_blank');
  };

  const navigateDate = (direction: 'prev' | 'next') => {
    if (direction === 'prev') {
      setSelectedDate(prev => subDays(prev, 1));
    } else {
      setSelectedDate(prev => addDays(prev, 1));
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'Agendado':
        return 'bg-blue-500/10 text-blue-700 border-blue-200';
      case 'Concluído':
        return 'bg-green-500/10 text-green-700 border-green-200';
      case 'Cancelado':
        return 'bg-red-500/10 text-red-700 border-red-200';
      default:
        return 'bg-gray-500/10 text-gray-700 border-gray-200';
    }
  };

  const calcularPrecoFinal = (preco: number, temDesconto: boolean, porcentagemDesconto: number | null) => {
    if (!temDesconto || !porcentagemDesconto) return preco;
    return preco * (1 - porcentagemDesconto / 100);
  };

  // Filtrar apenas agendamentos do dia selecionado
  const agendamentosDodia = agendamentos.filter(agendamento => {
    const agendamentoDateStr = agendamento.data_agendamento;
    const selectedDateStr = format(selectedDate, 'yyyy-MM-dd');
    console.log('AgendamentosTab - Comparando:', agendamentoDateStr, 'vs', selectedDateStr);
    return agendamentoDateStr === selectedDateStr;
  }).filter(agendamento => {
    if (searchTerm) {
      return agendamento.nome.toLowerCase().includes(searchTerm.toLowerCase()) ||
             agendamento.telefone.includes(searchTerm) ||
             (agendamento.observacoes && agendamento.observacoes.toLowerCase().includes(searchTerm.toLowerCase()));
    }
    return true;
  }).filter(agendamento => {
    if (statusFilter !== 'todos') {
      return agendamento.status === statusFilter;
    }
    return true;
  });

  const handleTelefoneChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const telefone = e.target.value;
    setFormData({ ...formData, telefone });
    
    // Buscar cliente existente
    const clienteExistente = clientes.find(c => c.telefone === telefone);
    if (clienteExistente) {
      setFormData(prev => ({ ...prev, nome: clienteExistente.nome }));
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-muted-foreground">Carregando agendamentos...</div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header com navegação de data */}
      <div className="flex items-center justify-between">
        <Button
          variant="outline"
          size="sm"
          onClick={() => navigateDate('prev')}
        >
          <ChevronLeft className="h-4 w-4" />
        </Button>
        
        <div className="text-center">
          <div className="font-semibold">
            {format(selectedDate, "EEEE, dd 'de' MMMM", { locale: ptBR })}
          </div>
          <div className="text-sm text-muted-foreground">
            {isToday(selectedDate) && '(Hoje)'}
          </div>
        </div>
        
        <Button
          variant="outline"
          size="sm"
          onClick={() => navigateDate('next')}
        >
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>

      {/* Busca e filtros */}
      <div className="space-y-3">
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar por nome, telefone ou observações..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>
          
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button 
                className="shrink-0"
                onClick={() => {
                  resetForm();
                  setDialogOpen(true);
                }}
              >
                <Plus className="h-4 w-4" />
                <span className="hidden sm:inline ml-1">Novo</span>
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
                    <Input
                      id="telefone"
                      value={formData.telefone}
                      onChange={handleTelefoneChange}
                      placeholder="(11) 99999-9999"
                    />
                  </div>
                  <div>
                    <Label htmlFor="nome">Nome *</Label>
                    <Input
                      id="nome"
                      value={formData.nome}
                      onChange={(e) => setFormData({ ...formData, nome: e.target.value })}
                      placeholder="Nome do cliente"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="data">Data *</Label>
                    <Input
                      id="data"
                      type="date"
                      value={formData.data_agendamento}
                      onChange={(e) => setFormData({ ...formData, data_agendamento: e.target.value })}
                    />
                  </div>
                  <div>
                    <Label htmlFor="hora">Hora *</Label>
                    <Input
                      id="hora"
                      type="time"
                      value={formData.hora_agendamento}
                      onChange={(e) => setFormData({ ...formData, hora_agendamento: e.target.value })}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="procedimento">Serviço</Label>
                    <Select value={formData.procedimento_id} onValueChange={(value) => {
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
                        {servicos.map((servico) => (
                          <SelectItem key={servico.id} value={servico.id}>
                            {servico.nome_procedimento} - R$ {servico.valor.toFixed(2)}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label htmlFor="preco">Preço (R$) *</Label>
                    <Input
                      id="preco"
                      type="number"
                      step="0.01"
                      min="0"
                      value={formData.preco}
                      onChange={(e) => setFormData({ ...formData, preco: parseFloat(e.target.value) || 0 })}
                      placeholder="0.00"
                    />
                  </div>
                </div>

                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="desconto"
                    checked={formData.tem_desconto}
                    onCheckedChange={(checked) => setFormData({ ...formData, tem_desconto: !!checked })}
                  />
                  <Label htmlFor="desconto">Aplicar desconto</Label>
                  {formData.tem_desconto && (
                    <div className="flex items-center gap-2 ml-4">
                      <Input
                        type="number"
                        min="0"
                        max="100"
                        value={formData.porcentagem_desconto}
                        onChange={(e) => setFormData({ ...formData, porcentagem_desconto: parseFloat(e.target.value) || 0 })}
                        className="w-20"
                        placeholder="0"
                      />
                      <span className="text-sm">%</span>
                    </div>
                  )}
                </div>

                <div>
                  <Label htmlFor="observacoes">Observações</Label>
                  <Textarea
                    id="observacoes"
                    value={formData.observacoes}
                    onChange={(e) => setFormData({ ...formData, observacoes: e.target.value })}
                    placeholder="Observações sobre o agendamento..."
                  />
                </div>

                <div className="flex gap-2 pt-2">
                  <Button type="button" variant="outline" onClick={resetForm} className="flex-1">
                    Cancelar
                  </Button>
                  <Button type="submit" className="mobile-button flex-1">
                    {editingAgendamento ? 'Atualizar' : 'Salvar'}
                  </Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>
        </div>

        {/* Filtro por status */}
        <div className="flex gap-2 items-center">
          <Filter className="h-4 w-4 text-muted-foreground" />
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-40">
              <SelectValue placeholder="Todos os status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todos</SelectItem>
              <SelectItem value="Agendado">Agendado</SelectItem>
              <SelectItem value="Concluído">Concluído</SelectItem>
              <SelectItem value="Cancelado">Cancelado</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Lista de agendamentos do dia */}
      <div>
        <h3 className="text-sm font-medium text-muted-foreground mb-2">
          Agendamentos do dia ({agendamentosDodia.length})
        </h3>
        {agendamentosDodia.length === 0 ? (
          <Card className="mobile-card">
            <CardContent className="p-4">
              <div className="text-center text-muted-foreground">
                Nenhum agendamento para este dia
              </div>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-2">
            {agendamentosDodia.map((agendamento) => (
              <AgendamentoCard
                key={agendamento.id}
                agendamento={agendamento}
                    onEdit={handleEdit}
                    onOpenWhatsApp={openWhatsApp}
                    onUpdateStatus={updateAgendamentoStatus}
                    onDelete={deleteAgendamento}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

// Componente do card de agendamento
const AgendamentoCard = ({ agendamento, onEdit, onOpenWhatsApp, onUpdateStatus, onDelete }: {
  agendamento: Agendamento;
  onEdit: (agendamento: Agendamento) => void;
  onOpenWhatsApp: (telefone: string, nome: string, data: string, hora: string) => void;
  onUpdateStatus: (id: string, status: string) => void;
  onDelete: (id: string) => void;
}) => {
  const calcularPrecoFinal = (preco: number, temDesconto: boolean, porcentagemDesconto: number | null) => {
    if (!temDesconto || !porcentagemDesconto) return preco;
    return preco * (1 - porcentagemDesconto / 100);
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'Agendado':
        return 'bg-blue-500/10 text-blue-700 border-blue-200';
      case 'Concluído':
        return 'bg-green-500/10 text-green-700 border-green-200';
      case 'Cancelado':
        return 'bg-red-500/10 text-red-700 border-red-200';
      default:
        return 'bg-gray-500/10 text-gray-700 border-gray-200';
    }
  };

  const formatDate = (dateString: string) => {
    // Garantir que a data seja interpretada como local, não UTC
    const [year, month, day] = dateString.split('-');
    const date = new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
    return date.toLocaleDateString('pt-BR');
  };

  const precoFinal = calcularPrecoFinal(
    agendamento.preco,
    agendamento.tem_desconto,
    agendamento.porcentagem_desconto
  );

  return (
    <Card className="mobile-card">
      <CardContent className="p-4">
        <div className="space-y-3">
          {/* Cabeçalho */}
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <h3 className="font-semibold text-foreground">{agendamento.nome}</h3>
              <div className="text-sm text-muted-foreground">{agendamento.telefone}</div>
            </div>
            <Badge className={getStatusColor(agendamento.status)}>
              {agendamento.status}
            </Badge>
          </div>

          {/* Data e Hora */}
          <div className="flex items-center gap-4 text-sm">
            <div className="flex items-center text-muted-foreground">
              <CalendarIcon className="h-3 w-3 mr-1" />
              <span>{formatDate(agendamento.data_agendamento)}</span>
            </div>
            <div className="flex items-center text-muted-foreground">
              <Clock className="h-3 w-3 mr-1" />
              <span>{agendamento.hora_agendamento}</span>
            </div>
          </div>

          {/* Preço */}
          <div className="flex items-center gap-2">
            <DollarSign className="h-3 w-3 text-success" />
            {agendamento.tem_desconto && agendamento.porcentagem_desconto ? (
              <div className="flex items-center gap-2">
                <span className="text-sm text-muted-foreground line-through">
                  R$ {agendamento.preco.toFixed(2)}
                </span>
                <span className="font-semibold text-success">
                  R$ {precoFinal.toFixed(2)}
                </span>
                <Badge variant="outline" className="text-xs">
                  -{agendamento.porcentagem_desconto}%
                </Badge>
              </div>
            ) : (
              <span className="font-semibold text-success">
                R$ {agendamento.preco.toFixed(2)}
              </span>
            )}
          </div>

          {/* Observações */}
          {agendamento.observacoes && (
            <div className="text-xs text-muted-foreground bg-muted/50 p-2 rounded">
              <strong>Obs:</strong> {agendamento.observacoes}
            </div>
          )}

          {/* Botões de Status */}
          <div className="flex gap-2">
            <Button
              variant={agendamento.status === 'Agendado' ? 'default' : 'outline'}
              size="sm"
              onClick={() => onUpdateStatus(agendamento.id, 'Agendado')}
              className="flex-1"
              disabled={agendamento.status === 'Agendado'}
            >
              <Clock4 className="h-3 w-3" />
              <span className="hidden sm:inline ml-1">Agendado</span>
            </Button>
            <Button
              variant={agendamento.status === 'Concluído' ? 'default' : 'outline'}
              size="sm"
              onClick={() => onUpdateStatus(agendamento.id, 'Concluído')}
              className="flex-1"
              disabled={agendamento.status === 'Concluído'}
            >
              <Check className="h-3 w-3" />
              <span className="hidden sm:inline ml-1">Concluído</span>
            </Button>
            <Button
              variant={agendamento.status === 'Cancelado' ? 'destructive' : 'outline'}
              size="sm"
              onClick={() => onUpdateStatus(agendamento.id, 'Cancelado')}
              className="flex-1"
              disabled={agendamento.status === 'Cancelado'}
            >
              <X className="h-3 w-3" />
              <span className="hidden sm:inline ml-1">Cancelado</span>
            </Button>
          </div>

          {/* Ações */}
          <div className="flex gap-2 pt-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => onEdit(agendamento)}
              className="flex-1"
            >
              <Edit2 className="h-3 w-3" />
              <span className="hidden sm:inline ml-1">Editar</span>
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => onOpenWhatsApp(
                agendamento.telefone,
                agendamento.nome,
                formatDate(agendamento.data_agendamento),
                agendamento.hora_agendamento
              )}
              className="flex-1 text-green-600 hover:text-green-700"
            >
              <MessageCircle className="h-3 w-3" />
              <span className="hidden sm:inline ml-1">WhatsApp</span>
            </Button>
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button
                  variant="outline"
                  size="sm"
                  className="flex-1 text-red-600 hover:text-red-700"
                >
                  <Trash2 className="h-3 w-3" />
                  <span className="hidden sm:inline ml-1">Excluir</span>
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Confirmar exclusão</AlertDialogTitle>
                  <AlertDialogDescription>
                    Tem certeza que deseja excluir este agendamento? Esta ação não pode ser desfeita.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancelar</AlertDialogCancel>
                  <AlertDialogAction
                    onClick={() => onDelete(agendamento.id)}
                    className="bg-red-600 hover:bg-red-700"
                  >
                    Excluir
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export default AgendamentosTab;