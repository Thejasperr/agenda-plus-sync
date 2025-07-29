import React, { useState, useEffect } from 'react';
import { Plus, Search, Phone, Edit2, MessageCircle, History, Gift, X } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';

interface Cliente {
  id: string;
  nome: string;
  telefone: string;
  ultimo_atendimento?: string;
  created_at: string;
}

interface Agendamento {
  id: string;
  nome: string;
  telefone: string;
  data_agendamento: string;
  hora_agendamento: string;
  preco: number;
  status: string;
  tem_desconto: boolean;
  porcentagem_desconto: number | null;
  observacoes: string | null;
}

const ClientesTab = () => {
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(true);
  const [formData, setFormData] = useState({ nome: '', telefone: '' });
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingCliente, setEditingCliente] = useState<Cliente | null>(null);
  const [clienteAgendamentos, setClienteAgendamentos] = useState<{[key: string]: Agendamento[]}>({});
  const [selectedClienteId, setSelectedClienteId] = useState<string | null>(null);
  const [historicoDialogOpen, setHistoricoDialogOpen] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    fetchClientes();
    fetchAgendamentos();
  }, []);

  const fetchClientes = async () => {
    try {
      const { data, error } = await supabase
        .from('clientes')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setClientes(data || []);
    } catch (error) {
      console.error('Erro ao buscar clientes:', error);
      toast({
        title: "Erro",
        description: "Não foi possível carregar os clientes",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const fetchAgendamentos = async () => {
    try {
      const { data, error } = await supabase
        .from('agendamentos')
        .select('*')
        .order('data_agendamento', { ascending: false })
        .order('hora_agendamento', { ascending: false });

      if (error) throw error;
      
      // Agrupar agendamentos por telefone
      const agendamentosPorTelefone: {[key: string]: Agendamento[]} = {};
      data?.forEach((agendamento) => {
        if (!agendamentosPorTelefone[agendamento.telefone]) {
          agendamentosPorTelefone[agendamento.telefone] = [];
        }
        agendamentosPorTelefone[agendamento.telefone].push(agendamento);
      });
      
      setClienteAgendamentos(agendamentosPorTelefone);
    } catch (error) {
      console.error('Erro ao buscar agendamentos:', error);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.nome || !formData.telefone) {
      toast({
        title: "Erro",
        description: "Preencha todos os campos obrigatórios",
        variant: "destructive",
      });
      return;
    }

    try {
      if (editingCliente) {
        const { error } = await supabase
          .from('clientes')
          .update(formData)
          .eq('id', editingCliente.id);

        if (error) throw error;

        toast({
          title: "Sucesso",
          description: "Cliente atualizado com sucesso!",
        });
      } else {
        const { error } = await supabase
          .from('clientes')
          .insert([formData]);

        if (error) throw error;

        toast({
          title: "Sucesso",
          description: "Cliente adicionado com sucesso!",
        });
      }

      setFormData({ nome: '', telefone: '' });
      setEditingCliente(null);
      setDialogOpen(false);
      fetchClientes();
    } catch (error: any) {
      console.error('Erro ao salvar cliente:', error);
      if (error.code === '23505') {
        toast({
          title: "Erro",
          description: "Este telefone já está cadastrado",
          variant: "destructive",
        });
      } else {
        toast({
          title: "Erro",
          description: "Não foi possível salvar o cliente",
          variant: "destructive",
        });
      }
    }
  };

  const handleEdit = (cliente: Cliente) => {
    setFormData({
      nome: cliente.nome,
      telefone: cliente.telefone
    });
    setEditingCliente(cliente);
    setDialogOpen(true);
  };

  const resetForm = () => {
    setFormData({ nome: '', telefone: '' });
    setEditingCliente(null);
    setDialogOpen(false);
  };

  const openWhatsApp = (telefone: string, nome: string) => {
    const message = encodeURIComponent(`Olá ${nome}! Como posso ajudar você hoje?`);
    const phoneNumber = telefone.replace(/\D/g, '');
    window.open(`https://wa.me/55${phoneNumber}?text=${message}`, '_blank');
  };

  const getClienteAgendamentos = (telefone: string) => {
    return clienteAgendamentos[telefone] || [];
  };

  const getUltimos6Agendamentos = (telefone: string) => {
    const agendamentos = getClienteAgendamentos(telefone);
    return agendamentos.slice(0, 6);
  };

  const temDireitoGratis = (telefone: string) => {
    const agendamentos = getClienteAgendamentos(telefone);
    return agendamentos.length >= 6;
  };

  const openHistorico = (clienteId: string) => {
    setSelectedClienteId(clienteId);
    setHistoricoDialogOpen(true);
  };

  const handleDelete = async (clienteId: string) => {
    if (!window.confirm('Tem certeza que deseja excluir este cliente?')) {
      return;
    }

    try {
      const { error } = await supabase
        .from('clientes')
        .delete()
        .eq('id', clienteId);

      if (error) throw error;

      toast({
        title: "Sucesso",
        description: "Cliente excluído com sucesso!",
      });

      fetchClientes();
    } catch (error) {
      console.error('Erro ao excluir cliente:', error);
      toast({
        title: "Erro",
        description: "Não foi possível excluir o cliente",
        variant: "destructive",
      });
    }
  };

  const filteredClientes = clientes.filter(cliente =>
    cliente.nome.toLowerCase().includes(searchTerm.toLowerCase()) ||
    cliente.telefone.includes(searchTerm)
  );

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('pt-BR');
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-muted-foreground">Carregando clientes...</div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header com busca e botão adicionar */}
      <div className="flex gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar por nome ou telefone..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10"
          />
        </div>
        
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button 
              className="mobile-button shrink-0"
              onClick={() => {
                resetForm();
                setDialogOpen(true);
              }}
            >
              <Plus className="h-4 w-4 mr-1" />
              Novo
            </Button>
          </DialogTrigger>
          <DialogContent className="w-[90%] max-w-md mx-auto">
            <DialogHeader>
              <DialogTitle>
                {editingCliente ? 'Editar Cliente' : 'Novo Cliente'}
              </DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <Label htmlFor="nome">Nome *</Label>
                <Input
                  id="nome"
                  value={formData.nome}
                  onChange={(e) => setFormData({ ...formData, nome: e.target.value })}
                  placeholder="Nome completo"
                />
              </div>
              <div>
                <Label htmlFor="telefone">Telefone *</Label>
                <Input
                  id="telefone"
                  value={formData.telefone}
                  onChange={(e) => setFormData({ ...formData, telefone: e.target.value })}
                  placeholder="(11) 99999-9999"
                />
              </div>
              <div className="flex gap-2 pt-2">
                <Button type="button" variant="outline" onClick={resetForm} className="flex-1">
                  Cancelar
                </Button>
                <Button type="submit" className="mobile-button flex-1">
                  {editingCliente ? 'Atualizar' : 'Salvar'}
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {/* Lista de clientes */}
      {filteredClientes.length === 0 ? (
        <div className="text-center py-8 text-muted-foreground">
          {searchTerm ? 'Nenhum cliente encontrado' : 'Nenhum cliente cadastrado'}
        </div>
      ) : (
        <div className="space-y-3">
          {filteredClientes.map((cliente) => {
            const agendamentos = getUltimos6Agendamentos(cliente.telefone);
            const direitoGratis = temDireitoGratis(cliente.telefone);
            
            return (
              <Card key={cliente.id} className="mobile-card">
                <CardContent className="p-4">
                  <div className="space-y-3">
                    {/* Cabeçalho */}
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <h3 className="font-semibold text-foreground">{cliente.nome}</h3>
                          {direitoGratis && (
                            <Badge className="bg-yellow-500/10 text-yellow-700 border-yellow-200">
                              <Gift className="h-3 w-3 mr-1" />
                              Grátis
                            </Badge>
                          )}
                        </div>
                        <div className="flex items-center text-muted-foreground text-sm mt-1">
                          <Phone className="h-3 w-3 mr-1" />
                          <span>{cliente.telefone}</span>
                        </div>
                        {cliente.ultimo_atendimento && (
                          <div className="text-xs text-muted-foreground mt-1">
                            Último atendimento: {formatDate(cliente.ultimo_atendimento)}
                          </div>
                        )}
                      </div>
                      <div className="text-right text-xs text-muted-foreground">
                        Cadastrado em {formatDate(cliente.created_at)}
                      </div>
                    </div>

                    {/* Histórico de agendamentos */}
                    {agendamentos.length > 0 && (
                      <div>
                        <div className="text-xs font-medium text-muted-foreground mb-2 flex items-center gap-1">
                          <History className="h-3 w-3" />
                          Últimos agendamentos ({agendamentos.length})
                        </div>
                        <div className="space-y-1">
                          {agendamentos.map((agendamento, index) => (
                            <div key={agendamento.id} className="text-xs bg-muted/30 p-2 rounded flex justify-between items-center">
                              <span>
                                {formatDate(agendamento.data_agendamento)} às {agendamento.hora_agendamento}
                              </span>
                              <Badge 
                                variant="outline" 
                                className={`text-xs ${
                                  agendamento.status === 'Concluído' 
                                    ? 'bg-green-500/10 text-green-700 border-green-200'
                                    : agendamento.status === 'Cancelado'
                                    ? 'bg-red-500/10 text-red-700 border-red-200'
                                    : 'bg-blue-500/10 text-blue-700 border-blue-200'
                                }`}
                              >
                                {agendamento.status}
                              </Badge>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    <Separator />

                    {/* Ações */}
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleEdit(cliente)}
                        className="flex-1 md:flex-auto"
                      >
                        <Edit2 className="h-3 w-3 md:mr-1" />
                        <span className="hidden md:inline">Editar</span>
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => openHistorico(cliente.id)}
                        className="flex-1 md:flex-auto"
                      >
                        <History className="h-3 w-3 md:mr-1" />
                        <span className="hidden md:inline">Histórico</span>
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => openWhatsApp(cliente.telefone, cliente.nome)}
                        className="flex-1 md:flex-auto text-green-600 hover:text-green-700"
                      >
                        <MessageCircle className="h-3 w-3 md:mr-1" />
                        <span className="hidden md:inline">WhatsApp</span>
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleDelete(cliente.id)}
                        className="flex-1 md:flex-auto text-red-600 hover:text-red-700"
                      >
                        <X className="h-3 w-3 md:mr-1" />
                        <span className="hidden md:inline">Excluir</span>
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Dialog do Histórico */}
      <Dialog open={historicoDialogOpen} onOpenChange={setHistoricoDialogOpen}>
        <DialogContent className="w-[95%] max-w-2xl mx-auto max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              Histórico Completo - {selectedClienteId ? clientes.find(c => c.id === selectedClienteId)?.nome : ''}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            {selectedClienteId && (() => {
              const cliente = clientes.find(c => c.id === selectedClienteId);
              const agendamentos = cliente ? getClienteAgendamentos(cliente.telefone) : [];
              
              if (agendamentos.length === 0) {
                return (
                  <div className="text-center py-8 text-muted-foreground">
                    Nenhum agendamento encontrado
                  </div>
                );
              }

              return agendamentos.map((agendamento) => (
                <Card key={agendamento.id} className="mobile-card">
                  <CardContent className="p-3">
                    <div className="flex justify-between items-start mb-2">
                      <div>
                        <div className="font-medium">
                          {formatDate(agendamento.data_agendamento)} às {agendamento.hora_agendamento}
                        </div>
                        <div className="text-sm text-success font-medium">
                          R$ {agendamento.preco.toFixed(2)}
                        </div>
                      </div>
                      <Badge 
                        variant="outline"
                        className={`${
                          agendamento.status === 'Concluído' 
                            ? 'bg-green-500/10 text-green-700 border-green-200'
                            : agendamento.status === 'Cancelado'
                            ? 'bg-red-500/10 text-red-700 border-red-200'
                            : 'bg-blue-500/10 text-blue-700 border-blue-200'
                        }`}
                      >
                        {agendamento.status}
                      </Badge>
                    </div>
                    {agendamento.observacoes && (
                      <div className="text-xs text-muted-foreground bg-muted/50 p-2 rounded">
                        <strong>Obs:</strong> {agendamento.observacoes}
                      </div>
                    )}
                  </CardContent>
                </Card>
              ));
            })()}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default ClientesTab;