import React, { useState, useEffect } from 'react';
import { Plus, Search, Calendar, Clock, User, DollarSign } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';

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
  const { toast } = useToast();

  const [formData, setFormData] = useState({
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
    status: 'A fazer' as const
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

      // Criar agendamento
      const { error } = await supabase
        .from('agendamentos')
        .insert([{
          ...formData,
          porcentagem_desconto: formData.tem_desconto ? formData.porcentagem_desconto : null,
          data_retorno: formData.tem_retorno ? formData.data_retorno : null,
          preco_retorno: formData.tem_retorno ? formData.preco_retorno : null,
        }]);

      if (error) throw error;

      toast({
        title: "Sucesso",
        description: "Agendamento criado com sucesso!",
      });

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
        status: 'A fazer'
      });
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

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'Concluído': return 'bg-success text-success-foreground';
      case 'Cancelado': return 'bg-destructive text-destructive-foreground';
      default: return 'bg-warning text-warning-foreground';
    }
  };

  const filteredAgendamentos = agendamentos.filter(agendamento =>
    agendamento.nome.toLowerCase().includes(searchTerm.toLowerCase()) ||
    agendamento.telefone.includes(searchTerm)
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-muted-foreground">Carregando agendamentos...</div>
      </div>
    );
  }

  return (
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
        
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button className="mobile-button shrink-0">
              <Plus className="h-4 w-4 mr-1" />
              Novo
            </Button>
          </DialogTrigger>
          <DialogContent className="w-[95%] max-w-md mx-auto max-h-[80vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Novo Agendamento</DialogTitle>
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

              <div className="flex gap-2 pt-2">
                <Button type="button" variant="outline" onClick={() => setDialogOpen(false)} className="flex-1">
                  Cancelar
                </Button>
                <Button type="submit" className="mobile-button flex-1">
                  Salvar
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {/* Lista de agendamentos */}
      {filteredAgendamentos.length === 0 ? (
        <div className="text-center py-8 text-muted-foreground">
          {searchTerm ? 'Nenhum agendamento encontrado' : 'Nenhum agendamento cadastrado'}
        </div>
      ) : (
        <div className="space-y-3">
          {filteredAgendamentos.map((agendamento) => (
            <Card key={agendamento.id} className="mobile-card">
              <CardContent className="p-4">
                <div className="flex items-start justify-between mb-2">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <User className="h-4 w-4 text-muted-foreground" />
                      <span className="font-semibold">{agendamento.nome}</span>
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
                      <span className="font-medium text-success">
                        R$ {agendamento.preco.toFixed(2)}
                        {agendamento.tem_desconto && (
                          <span className="text-xs ml-1">
                            ({agendamento.porcentagem_desconto}% desc.)
                          </span>
                        )}
                      </span>
                    </div>
                  </div>
                  <Badge className={getStatusColor(agendamento.status)}>
                    {agendamento.status}
                  </Badge>
                </div>
                {agendamento.tem_retorno && agendamento.data_retorno && (
                  <div className="text-xs text-muted-foreground border-t pt-2">
                    Retorno: {new Date(agendamento.data_retorno).toLocaleString('pt-BR')} 
                    {agendamento.preco_retorno && ` - R$ ${agendamento.preco_retorno.toFixed(2)}`}
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
};

export default AgendamentosTab;