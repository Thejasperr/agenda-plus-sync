import React, { useState, useEffect } from 'react';
import { Plus, Search, Calendar, Clock, User, DollarSign, Edit3, MessageSquare } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import {
  DndContext,
  DragEndEvent,
  DragOverEvent,
  DragOverlay,
  DragStartEvent,
  PointerSensor,
  useSensor,
  useSensors,
  useDroppable,
  useDraggable,
} from '@dnd-kit/core';

interface Agendamento {
  id: string;
  nome: string;
  telefone: string;
  procedimento_id: string;
  preco: number;
  tem_desconto: boolean;
  porcentagem_desconto?: number;
  data_agendamento: string;
  hora_agendamento: string;
  tem_retorno: boolean;
  data_retorno?: string;
  preco_retorno?: number;
  status: 'A fazer' | 'Concluído' | 'Cancelado';
  observacoes?: string;
  servicos?: { nome_procedimento: string; valor: number };
}

interface Servico {
  id: string;
  nome_procedimento: string;
  valor: number;
}

interface Cliente {
  telefone: string;
  nome: string;
  ultimo_atendimento?: string;
}

const AgendamentosTab = () => {
  const [agendamentos, setAgendamentos] = useState<Agendamento[]>([]);
  const [servicos, setServicos] = useState<Servico[]>([]);
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingAgendamento, setEditingAgendamento] = useState<Agendamento | null>(null);
  const [draggedId, setDraggedId] = useState<string | null>(null);
  const { toast } = useToast();

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    })
  );

  const [formData, setFormData] = useState<{
    nome: string;
    telefone: string;
    procedimento_id: string;
    preco: number;
    tem_desconto: boolean;
    porcentagem_desconto: number;
    data_agendamento: string;
    hora_agendamento: string;
    tem_retorno: boolean;
    data_retorno: string;
    preco_retorno: number;
    status: 'A fazer' | 'Concluído' | 'Cancelado';
    observacoes: string;
  }>({
    nome: '',
    telefone: '',
    procedimento_id: '',
    preco: 0,
    tem_desconto: false,
    porcentagem_desconto: 0,
    data_agendamento: '',
    hora_agendamento: '',
    tem_retorno: false,
    data_retorno: '',
    preco_retorno: 0,
    status: 'A fazer',
    observacoes: ''
  });

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const [agendamentosRes, servicosRes, clientesRes] = await Promise.all([
        supabase
          .from('agendamentos')
          .select(`
            *,
            servicos:procedimento_id (nome_procedimento, valor)
          `)
          .order('data_agendamento', { ascending: false }),
        supabase.from('servicos').select('*').order('nome_procedimento'),
        supabase.from('clientes').select('telefone, nome, ultimo_atendimento')
      ]);

      if (agendamentosRes.error) throw agendamentosRes.error;
      if (servicosRes.error) throw servicosRes.error;
      if (clientesRes.error) throw clientesRes.error;

      setAgendamentos((agendamentosRes.data || []) as Agendamento[]);
      setServicos(servicosRes.data || []);
      setClientes(clientesRes.data || []);
    } catch (error) {
      console.error('Erro ao buscar dados:', error);
      toast({
        title: "Erro",
        description: "Não foi possível carregar os dados",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleTelefoneChange = (telefone: string) => {
    setFormData({ ...formData, telefone });
    
    const clienteExistente = clientes.find(c => c.telefone === telefone);
    if (clienteExistente) {
      setFormData(prev => ({ ...prev, nome: clienteExistente.nome }));
    }
  };

  const handleServicoChange = (servicoId: string) => {
    const servico = servicos.find(s => s.id === servicoId);
    if (servico) {
      setFormData(prev => ({
        ...prev,
        procedimento_id: servicoId,
        preco: servico.valor
      }));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.nome || !formData.telefone || !formData.procedimento_id) {
      toast({
        title: "Erro",
        description: "Preencha todos os campos obrigatórios",
        variant: "destructive",
      });
      return;
    }

    try {
      // Verificar se cliente existe, se não, criar
      const clienteExistente = clientes.find(c => c.telefone === formData.telefone);
      if (!clienteExistente) {
        await supabase
          .from('clientes')
          .insert([{ nome: formData.nome, telefone: formData.telefone }]);
      }

      // Criar ou atualizar agendamento
      if (editingAgendamento) {
        const { error } = await supabase
          .from('agendamentos')
          .update({
            ...formData,
            porcentagem_desconto: formData.tem_desconto ? formData.porcentagem_desconto : null,
            data_retorno: formData.tem_retorno ? formData.data_retorno : null,
            preco_retorno: formData.tem_retorno ? formData.preco_retorno : null,
            observacoes: formData.observacoes || null,
          })
          .eq('id', editingAgendamento.id);

        if (error) throw error;

        toast({
          title: "Sucesso",
          description: "Agendamento atualizado com sucesso!",
        });
      } else {
        const { error } = await supabase
          .from('agendamentos')
          .insert([{
            ...formData,
            porcentagem_desconto: formData.tem_desconto ? formData.porcentagem_desconto : null,
            data_retorno: formData.tem_retorno ? formData.data_retorno : null,
            preco_retorno: formData.tem_retorno ? formData.preco_retorno : null,
            observacoes: formData.observacoes || null,
          }]);

        if (error) throw error;

        toast({
          title: "Sucesso",
          description: "Agendamento criado com sucesso!",
        });
      }

      setFormData({
        nome: '',
        telefone: '',
        procedimento_id: '',
        preco: 0,
        tem_desconto: false,
        porcentagem_desconto: 0,
        data_agendamento: '',
        hora_agendamento: '',
        tem_retorno: false,
        data_retorno: '',
        preco_retorno: 0,
        status: 'A fazer',
        observacoes: ''
      });
      setEditingAgendamento(null);
      setDialogOpen(false);
      fetchData();
    } catch (error) {
      console.error('Erro ao criar agendamento:', error);
      toast({
        title: "Erro",
        description: "Não foi possível criar o agendamento",
        variant: "destructive",
      });
    }
  };

  const calculateDiscountedPrice = (price: number, hasDiscount: boolean, discountPercentage?: number) => {
    if (!hasDiscount || !discountPercentage) return price;
    return price - (price * discountPercentage / 100);
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'Concluído': return 'bg-success text-success-foreground';
      case 'Cancelado': return 'bg-destructive text-destructive-foreground';
      default: return 'bg-warning text-warning-foreground';
    }
  };

  const handleEdit = (agendamento: Agendamento) => {
    setEditingAgendamento(agendamento);
    setFormData({
      nome: agendamento.nome,
      telefone: agendamento.telefone,
      procedimento_id: agendamento.procedimento_id,
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
    setDialogOpen(true);
  };

  const handleDragStart = (event: DragStartEvent) => {
    setDraggedId(event.active.id as string);
  };

  const handleDragEnd = (event: DragEndEvent) => {
    setDraggedId(null);
    
    const { active, over } = event;
    
    if (!over || active.id === over.id) return;

    const newStatus = over.id as string;
    const agendamentoId = active.id as string;

    updateAgendamentoStatus(agendamentoId, newStatus);
  };

  const updateAgendamentoStatus = async (id: string, newStatus: string) => {
    try {
      const { error } = await supabase
        .from('agendamentos')
        .update({ status: newStatus })
        .eq('id', id);

      if (error) throw error;

      setAgendamentos(prev => 
        prev.map(agendamento => 
          agendamento.id === id 
            ? { ...agendamento, status: newStatus as 'A fazer' | 'Concluído' | 'Cancelado' }
            : agendamento
        )
      );

      toast({
        title: "Status atualizado",
        description: `Agendamento movido para ${newStatus}`,
      });
    } catch (error) {
      console.error('Erro ao atualizar status:', error);
      toast({
        title: "Erro",
        description: "Não foi possível atualizar o status",
        variant: "destructive",
      });
    }
  };

  const filteredAgendamentos = agendamentos.filter(agendamento =>
    agendamento.nome.toLowerCase().includes(searchTerm.toLowerCase()) ||
    agendamento.telefone.includes(searchTerm) ||
    (agendamento.observacoes && agendamento.observacoes.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  const agendamentosGrouped = {
    'A fazer': filteredAgendamentos.filter(a => a.status === 'A fazer'),
    'Concluído': filteredAgendamentos.filter(a => a.status === 'Concluído'),
    'Cancelado': filteredAgendamentos.filter(a => a.status === 'Cancelado'),
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-muted-foreground">Carregando agendamentos...</div>
      </div>
    );
  }

  return (
    <DndContext
      sensors={sensors}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
    >
      <div className="space-y-4">
        {/* Header */}
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar agendamentos..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>
          
          <Dialog open={dialogOpen} onOpenChange={(open) => {
            setDialogOpen(open);
            if (!open) {
              setEditingAgendamento(null);
              setFormData({
                nome: '',
                telefone: '',
                procedimento_id: '',
                preco: 0,
                tem_desconto: false,
                porcentagem_desconto: 0,
                data_agendamento: '',
                hora_agendamento: '',
                tem_retorno: false,
                data_retorno: '',
                preco_retorno: 0,
                status: 'A fazer',
                observacoes: ''
              });
            }
          }}>
            <DialogTrigger asChild>
              <Button className="mobile-button shrink-0">
                <Plus className="h-4 w-4 mr-1" />
                Novo
              </Button>
            </DialogTrigger>
            <DialogContent className="w-[95%] max-w-md mx-auto max-h-[80vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>{editingAgendamento ? 'Editar Agendamento' : 'Novo Agendamento'}</DialogTitle>
              </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <Label htmlFor="telefone">Telefone *</Label>
                <Input
                  id="telefone"
                  value={formData.telefone}
                  onChange={(e) => handleTelefoneChange(e.target.value)}
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

              <div>
                <Label htmlFor="procedimento">Procedimento *</Label>
                <Select value={formData.procedimento_id} onValueChange={handleServicoChange}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione um procedimento" />
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
                <Label htmlFor="preco">Preço *</Label>
                <Input
                  id="preco"
                  type="number"
                  step="0.01"
                  value={formData.preco}
                  onChange={(e) => setFormData({ ...formData, preco: parseFloat(e.target.value) || 0 })}
                />
              </div>

              <div className="flex items-center space-x-2">
                <Checkbox
                  id="tem_desconto"
                  checked={formData.tem_desconto}
                  onCheckedChange={(checked) => setFormData({ ...formData, tem_desconto: !!checked })}
                />
                <Label htmlFor="tem_desconto">Aplicar desconto</Label>
              </div>

              {formData.tem_desconto && (
                <div>
                  <Label htmlFor="porcentagem_desconto">Porcentagem de Desconto (%)</Label>
                  <Input
                    id="porcentagem_desconto"
                    type="number"
                    value={formData.porcentagem_desconto}
                    onChange={(e) => setFormData({ ...formData, porcentagem_desconto: parseFloat(e.target.value) || 0 })}
                  />
                </div>
              )}

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <Label htmlFor="data_agendamento">Data *</Label>
                  <Input
                    id="data_agendamento"
                    type="date"
                    value={formData.data_agendamento}
                    onChange={(e) => setFormData({ ...formData, data_agendamento: e.target.value })}
                  />
                </div>
                <div>
                  <Label htmlFor="hora_agendamento">Hora *</Label>
                  <Input
                    id="hora_agendamento"
                    type="time"
                    value={formData.hora_agendamento}
                    onChange={(e) => setFormData({ ...formData, hora_agendamento: e.target.value })}
                  />
                </div>
              </div>

              <div className="flex items-center space-x-2">
                <Checkbox
                  id="tem_retorno"
                  checked={formData.tem_retorno}
                  onCheckedChange={(checked) => setFormData({ ...formData, tem_retorno: !!checked })}
                />
                <Label htmlFor="tem_retorno">Agendamento de retorno</Label>
              </div>

              {formData.tem_retorno && (
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <Label htmlFor="data_retorno">Data do Retorno</Label>
                    <Input
                      id="data_retorno"
                      type="datetime-local"
                      value={formData.data_retorno}
                      onChange={(e) => setFormData({ ...formData, data_retorno: e.target.value })}
                    />
                  </div>
                  <div>
                    <Label htmlFor="preco_retorno">Preço do Retorno</Label>
                    <Input
                      id="preco_retorno"
                      type="number"
                      step="0.01"
                      value={formData.preco_retorno}
                      onChange={(e) => setFormData({ ...formData, preco_retorno: parseFloat(e.target.value) || 0 })}
                    />
                  </div>
                </div>
              )}

              <div>
                <Label htmlFor="observacoes">Observações</Label>
                <Textarea
                  id="observacoes"
                  value={formData.observacoes}
                  onChange={(e) => setFormData({ ...formData, observacoes: e.target.value })}
                  placeholder="Observações sobre o agendamento..."
                  rows={3}
                />
              </div>

              <div className="flex gap-2 pt-2">
                <Button type="button" variant="outline" onClick={() => setDialogOpen(false)} className="flex-1">
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

        {/* Colunas de status com drag and drop */}
        {filteredAgendamentos.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            {searchTerm ? 'Nenhum agendamento encontrado' : 'Nenhum agendamento cadastrado'}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {Object.entries(agendamentosGrouped).map(([status, agendamentos]) => (
              <DropZone key={status} status={status} agendamentos={agendamentos} onEdit={handleEdit} />
            ))}
          </div>
        )}

        <DragOverlay>
          {draggedId ? (
            <AgendamentoCard
              agendamento={filteredAgendamentos.find(a => a.id === draggedId)!}
              onEdit={handleEdit}
              isDragging
            />
          ) : null}
        </DragOverlay>
      </div>
    </DndContext>
  );
};

// Componente para cada agendamento arrastável
const AgendamentoCard = ({ agendamento, onEdit, isDragging = false }: { 
  agendamento: Agendamento; 
  onEdit: (agendamento: Agendamento) => void;
  isDragging?: boolean;
}) => {
  const calculateDiscountedPrice = (price: number, hasDiscount: boolean, discountPercentage?: number) => {
    if (!hasDiscount || !discountPercentage) return price;
    return price - (price * discountPercentage / 100);
  };

  const originalPrice = agendamento.preco;
  const discountedPrice = calculateDiscountedPrice(
    originalPrice, 
    agendamento.tem_desconto, 
    agendamento.porcentagem_desconto
  );

  return (
    <Card className={`mobile-card cursor-pointer hover:shadow-md transition-shadow ${isDragging ? 'opacity-50' : ''}`}>
      <CardContent className="p-4">
        <div className="flex items-start justify-between mb-2">
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-1">
              <User className="h-4 w-4 text-muted-foreground" />
              <span className="font-semibold">{agendamento.nome}</span>
              <Button
                variant="ghost"
                size="sm"
                onClick={(e) => {
                  e.stopPropagation();
                  onEdit(agendamento);
                }}
                className="h-6 w-6 p-0 ml-auto"
              >
                <Edit3 className="h-3 w-3" />
              </Button>
            </div>
            <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
              <Calendar className="h-3 w-3" />
              <span>{new Date(agendamento.data_agendamento).toLocaleDateString('pt-BR')}</span>
              <Clock className="h-3 w-3 ml-2" />
              <span>{agendamento.hora_agendamento}</span>
            </div>
            <div className="text-sm text-muted-foreground mb-2">
              {agendamento.servicos?.nome_procedimento}
            </div>
            <div className="flex items-center gap-2">
              <DollarSign className="h-4 w-4 text-success" />
              {agendamento.tem_desconto ? (
                <div className="flex items-center gap-2">
                  <span className="text-sm line-through text-muted-foreground">
                    R$ {originalPrice.toFixed(2)}
                  </span>
                  <span className="font-medium text-success">
                    R$ {discountedPrice.toFixed(2)}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    ({agendamento.porcentagem_desconto}% desc.)
                  </span>
                </div>
              ) : (
                <span className="font-medium text-success">
                  R$ {originalPrice.toFixed(2)}
                </span>
              )}
            </div>
            {agendamento.observacoes && (
              <div className="flex items-start gap-2 mt-2 text-sm text-muted-foreground">
                <MessageSquare className="h-3 w-3 mt-0.5 flex-shrink-0" />
                <span className="text-xs">{agendamento.observacoes}</span>
              </div>
            )}
          </div>
        </div>
        {agendamento.tem_retorno && agendamento.data_retorno && (
          <div className="text-xs text-muted-foreground border-t pt-2">
            Retorno: {new Date(agendamento.data_retorno).toLocaleString('pt-BR')} 
            {agendamento.preco_retorno && ` - R$ ${agendamento.preco_retorno.toFixed(2)}`}
          </div>
        )}
      </CardContent>
    </Card>
  );
};

// Componente de zona de drop para cada status
const DropZone = ({ status, agendamentos, onEdit }: {
  status: string;
  agendamentos: Agendamento[];
  onEdit: (agendamento: Agendamento) => void;
}) => {
  const { setNodeRef } = useDroppable({
    id: status,
  });

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'Concluído': return 'border-success bg-success/5';
      case 'Cancelado': return 'border-destructive bg-destructive/5';
      default: return 'border-warning bg-warning/5';
    }
  };

  return (
    <div
      ref={setNodeRef}
      className={`min-h-[200px] p-4 rounded-lg border-2 border-dashed transition-colors ${getStatusColor(status)}`}
    >
      <h3 className="font-semibold mb-3 text-center">{status}</h3>
      <div className="space-y-3">
        {agendamentos.map((agendamento) => (
          <DraggableAgendamento
            key={agendamento.id}
            agendamento={agendamento}
            onEdit={onEdit}
          />
        ))}
        {agendamentos.length === 0 && (
          <div className="text-center text-muted-foreground text-sm py-8">
            Arraste agendamentos aqui
          </div>
        )}
      </div>
    </div>
  );
};

// Componente arrastável
const DraggableAgendamento = ({ agendamento, onEdit }: {
  agendamento: Agendamento;
  onEdit: (agendamento: Agendamento) => void;
}) => {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    isDragging,
  } = useDraggable({
    id: agendamento.id,
  });

  const style = transform ? {
    transform: `translate3d(${transform.x}px, ${transform.y}px, 0)`,
  } : undefined;

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...listeners}
      {...attributes}
    >
      <AgendamentoCard
        agendamento={agendamento}
        onEdit={onEdit}
        isDragging={isDragging}
      />
    </div>
  );
};

export default AgendamentosTab;