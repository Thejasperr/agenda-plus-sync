import React, { useState, useEffect } from 'react';
import { Plus, Search, Phone, Edit2, MessageCircle, History, Gift, X, AlertCircle, Sparkles, Calendar } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { sanitizeInput, validateAndFormatPhone, getSecureErrorMessage, clienteSchema } from '@/lib/security';

interface Cliente {
  id: string;
  nome: string;
  telefone: string;
  ultimo_atendimento?: string;
  created_at: string;
  observacoes?: string;
  saldo_credito?: number;
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

interface SpaAssinatura {
  id: string;
  cliente_id: string;
  ativa: boolean;
  procedimento_nome?: string;
  proxima_sessao?: {
    data_sessao: string;
    hora_sessao: string | null;
  };
}

const ClientesTab = () => {
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(true);
  const [formData, setFormData] = useState({ nome: '', telefone: '', observacoes: '' });
  const [formErrors, setFormErrors] = useState({ nome: '', telefone: '', observacoes: '' });
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingCliente, setEditingCliente] = useState<Cliente | null>(null);
  const [clienteAgendamentos, setClienteAgendamentos] = useState<{[key: string]: Agendamento[]}>({});
  const [selectedClienteId, setSelectedClienteId] = useState<string | null>(null);
  const [historicoDialogOpen, setHistoricoDialogOpen] = useState(false);
  const [spaAssinaturas, setSpaAssinaturas] = useState<{[key: string]: SpaAssinatura}>({});
  const { toast } = useToast();

  // Função para formatar telefone para exibição
  const formatPhoneForDisplay = (phone: string) => {
    const digits = phone.replace(/\D/g, '');
    if (digits.length === 11) {
      return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`;
    } else if (digits.length === 10) {
      return `(${digits.slice(0, 2)}) ${digits.slice(2, 6)}-${digits.slice(6)}`;
    }
    return phone;
  };

  useEffect(() => {
    fetchClientes();
    fetchAgendamentos();
    fetchSpaAssinaturas();
  }, []);

  const fetchSpaAssinaturas = async () => {
    try {
      // Buscar assinaturas ativas com procedimento
      const { data: assinaturas, error: assinaturaError } = await supabase
        .from('spas_assinaturas')
        .select('id, cliente_id, ativa, procedimento_id')
        .eq('ativa', true);

      if (assinaturaError) throw assinaturaError;

      if (!assinaturas || assinaturas.length === 0) {
        setSpaAssinaturas({});
        return;
      }
      
      // Buscar procedimentos
      const procedimentoIds = assinaturas
        .filter(a => a.procedimento_id)
        .map(a => a.procedimento_id);
      
      let procedimentosMap: {[key: string]: string} = {};
      if (procedimentoIds.length > 0) {
        const { data: procedimentos } = await supabase
          .from('spas_procedimentos')
          .select('id, nome')
          .in('id', procedimentoIds);
        
        if (procedimentos) {
          procedimentos.forEach(p => {
            procedimentosMap[p.id] = p.nome;
          });
        }
      }

      // Buscar próximas sessões não realizadas
      const hoje = new Date().toISOString().split('T')[0];
      const { data: sessoes, error: sessoesError } = await supabase
        .from('spas_sessoes')
        .select('assinatura_id, data_sessao, hora_sessao')
        .in('assinatura_id', assinaturas.map(a => a.id))
        .eq('realizada', false)
        .gte('data_sessao', hoje)
        .order('data_sessao', { ascending: true });

      if (sessoesError) throw sessoesError;

      // Mapear assinaturas por cliente_id com próxima sessão
      const assinaturasMap: {[key: string]: SpaAssinatura} = {};
      assinaturas.forEach(assinatura => {
        const proximaSessao = sessoes?.find(s => s.assinatura_id === assinatura.id);
        assinaturasMap[assinatura.cliente_id] = {
          id: assinatura.id,
          cliente_id: assinatura.cliente_id,
          ativa: assinatura.ativa,
          procedimento_nome: assinatura.procedimento_id ? procedimentosMap[assinatura.procedimento_id] : undefined,
          proxima_sessao: proximaSessao ? {
            data_sessao: proximaSessao.data_sessao,
            hora_sessao: proximaSessao.hora_sessao
          } : undefined
        };
      });

      setSpaAssinaturas(assinaturasMap);
    } catch (error) {
      // Silently handle spa loading errors
    }
  };

  const fetchClientes = async () => {
    try {
      const { data, error } = await supabase
        .from('clientes')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setClientes(data || []);
    } catch (error) {
      toast({
        title: "Erro",
        description: getSecureErrorMessage(error, 'carregamento de clientes'),
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
      // Silently handle agendamentos loading errors - not critical for clients view
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Clear previous errors
    setFormErrors({ nome: '', telefone: '', observacoes: '' });
    
    // Sanitize and validate inputs
    const sanitizedData = {
      nome: sanitizeInput(formData.nome),
      telefone: formData.telefone,
      observacoes: sanitizeInput(formData.observacoes)
    };
    
    // Validate phone
    const phoneValidation = validateAndFormatPhone(sanitizedData.telefone);
    if (!phoneValidation.isValid) {
      setFormErrors({ ...formErrors, telefone: phoneValidation.error || 'Telefone inválido' });
      return;
    }
    
    // Use formatted phone
    sanitizedData.telefone = phoneValidation.formatted;
    
    // Validate with schema
    try {
      clienteSchema.parse(sanitizedData);
    } catch (error: any) {
      if (error.errors?.[0]) {
        const field = error.errors[0].path[0];
        const message = error.errors[0].message;
        setFormErrors({ ...formErrors, [field]: message });
      }
      return;
    }

    try {
      if (editingCliente) {
        const { error } = await supabase
          .from('clientes')
          .update(sanitizedData)
          .eq('id', editingCliente.id);

        if (error) throw error;

        toast({
          title: "Sucesso",
          description: "Cliente atualizado com sucesso!",
        });
      } else {
        const { error } = await supabase
          .from('clientes')
          .insert([sanitizedData]);

        if (error) throw error;

        toast({
          title: "Sucesso",
          description: "Cliente adicionado com sucesso!",
        });
      }

      setFormData({ nome: '', telefone: '', observacoes: '' });
      setFormErrors({ nome: '', telefone: '', observacoes: '' });
      setEditingCliente(null);
      setDialogOpen(false);
      fetchClientes();
    } catch (error: any) {
      toast({
        title: "Erro",
        description: getSecureErrorMessage(error, 'salvamento do cliente'),
        variant: "destructive",
      });
    }
  };

  const handleEdit = (cliente: Cliente) => {
    setFormData({
      nome: cliente.nome,
      telefone: cliente.telefone,
      observacoes: cliente.observacoes || ''
    });
    setEditingCliente(cliente);
    setDialogOpen(true);
  };

  const resetForm = () => {
    setFormData({ nome: '', telefone: '', observacoes: '' });
    setFormErrors({ nome: '', telefone: '', observacoes: '' });
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

  const getClienteGastoTotal = (telefone: string) => {
    const agendamentos = getClienteAgendamentos(telefone);
    return agendamentos
      .filter(ag => ag.status === 'Concluído')
      .reduce((total, agendamento) => {
        let valor = agendamento.preco;
        if (agendamento.tem_desconto && agendamento.porcentagem_desconto) {
          valor = valor * (1 - agendamento.porcentagem_desconto / 100);
        }
        return total + valor;
      }, 0);
  };

  const getClienteAtendimentosTotal = (telefone: string) => {
    const agendamentos = getClienteAgendamentos(telefone);
    return agendamentos.filter(ag => ag.status === 'Concluído').length;
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
      toast({
        title: "Erro",
        description: getSecureErrorMessage(error, 'exclusão do cliente'),
        variant: "destructive",
      });
    }
  };

  const filteredClientes = clientes.filter(cliente =>
    cliente.nome.toLowerCase().includes(searchTerm.toLowerCase()) ||
    cliente.telefone.includes(searchTerm)
  );

  const formatDate = (dateString: string) => {
    // Parse the date as local date to avoid timezone issues
    const [year, month, day] = dateString.split('-').map(Number);
    const date = new Date(year, month - 1, day);
    return date.toLocaleDateString('pt-BR');
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
                  onChange={(e) => {
                    setFormData({ ...formData, nome: e.target.value });
                    setFormErrors({ ...formErrors, nome: '' });
                  }}
                  placeholder="Nome completo"
                  className={formErrors.nome ? 'border-destructive' : ''}
                />
                {formErrors.nome && (
                  <div className="text-sm text-destructive flex items-center gap-1 mt-1">
                    <AlertCircle className="h-3 w-3" />
                    {formErrors.nome}
                  </div>
                )}
              </div>
              <div>
                <Label htmlFor="telefone">Telefone *</Label>
                <Input
                  id="telefone"
                  value={formData.telefone}
                  onChange={(e) => {
                    // Auto-format phone while typing
                    let value = e.target.value.replace(/\D/g, '');
                    
                    // Remove +55 prefix if user starts typing it
                    if (value.startsWith('55') && value.length > 11) {
                      value = value.slice(2);
                    }
                    
                    // Format for display
                    let displayValue = value;
                    if (value.length >= 11) {
                      displayValue = `(${value.slice(0, 2)}) ${value.slice(2, 7)}-${value.slice(7, 11)}`;
                    } else if (value.length >= 10) {
                      displayValue = `(${value.slice(0, 2)}) ${value.slice(2, 6)}-${value.slice(6)}`;
                    } else if (value.length >= 6) {
                      displayValue = `(${value.slice(0, 2)}) ${value.slice(2, 6)}-${value.slice(6)}`;
                    } else if (value.length >= 2) {
                      displayValue = `(${value.slice(0, 2)}) ${value.slice(2)}`;
                    }
                    
                    setFormData({ ...formData, telefone: displayValue });
                    setFormErrors({ ...formErrors, telefone: '' });
                  }}
                  placeholder="(14) 99118-5209"
                  className={formErrors.telefone ? 'border-destructive' : ''}
                />
                {formErrors.telefone && (
                  <div className="text-sm text-destructive flex items-center gap-1 mt-1">
                    <AlertCircle className="h-3 w-3" />
                    {formErrors.telefone}
                  </div>
                )}
              </div>
              <div>
                <Label htmlFor="observacoes">Observações</Label>
                <Textarea
                  id="observacoes"
                  value={formData.observacoes}
                  onChange={(e) => {
                    setFormData({ ...formData, observacoes: e.target.value });
                    setFormErrors({ ...formErrors, observacoes: '' });
                  }}
                  placeholder="Ex: Cliente deixou R$ 50,00 para o próximo atendimento, ou ainda não pagou procedimento X"
                  rows={3}
                  className={formErrors.observacoes ? 'border-destructive' : ''}
                />
                {formErrors.observacoes && (
                  <div className="text-sm text-destructive flex items-center gap-1 mt-1">
                    <AlertCircle className="h-3 w-3" />
                    {formErrors.observacoes}
                  </div>
                )}
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
            const gastoTotal = getClienteGastoTotal(cliente.telefone);
            const atendimentosTotal = getClienteAtendimentosTotal(cliente.telefone);
            
            return (
              <Card key={cliente.id} className="mobile-card">
                <CardContent className="p-4">
                  <div className="space-y-3">
                    {/* Cabeçalho */}
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <h3 className="font-semibold text-foreground">{cliente.nome}</h3>
                          {spaAssinaturas[cliente.id] && (
                            <Badge className="bg-purple-500/10 text-purple-700 border-purple-200">
                              <Sparkles className="h-3 w-3 mr-1" />
                              {spaAssinaturas[cliente.id].procedimento_nome || 'Spa dos Pés'}
                            </Badge>
                          )}
                          {direitoGratis && (
                            <Badge className="bg-yellow-500/10 text-yellow-700 border-yellow-200">
                              <Gift className="h-3 w-3 mr-1" />
                              Grátis
                            </Badge>
                          )}
                        </div>
                        {spaAssinaturas[cliente.id]?.proxima_sessao && (
                          <div className="flex items-center text-purple-600 text-xs mt-1">
                            <Calendar className="h-3 w-3 mr-1" />
                            Próxima sessão: {formatDate(spaAssinaturas[cliente.id].proxima_sessao!.data_sessao)}
                            {spaAssinaturas[cliente.id].proxima_sessao!.hora_sessao && 
                              ` às ${spaAssinaturas[cliente.id].proxima_sessao!.hora_sessao.slice(0, 5)}`}
                          </div>
                        )}
                        <div className="flex items-center text-muted-foreground text-sm mt-1">
                          <Phone className="h-3 w-3 mr-1" />
                          <span>{formatPhoneForDisplay(cliente.telefone)}</span>
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

                    {/* Estatísticas do cliente */}
                    <div className="grid grid-cols-3 gap-2 p-2 bg-muted/30 rounded-lg">
                      <div className="text-center">
                        <div className="text-lg font-bold text-green-600">R$ {gastoTotal.toFixed(2)}</div>
                        <div className="text-xs text-muted-foreground">Gasto Total</div>
                      </div>
                      <div className="text-center">
                        <div className="text-lg font-bold text-blue-600">{atendimentosTotal}</div>
                        <div className="text-xs text-muted-foreground">Atendimentos</div>
                      </div>
                      <div className="text-center">
                        <div className="text-lg font-bold text-purple-600">R$ {(cliente.saldo_credito || 0).toFixed(2)}</div>
                        <div className="text-xs text-muted-foreground">Crédito</div>
                      </div>
                    </div>

                    {/* Observações */}
                    {cliente.observacoes && (
                      <div className="bg-yellow-500/10 border border-yellow-200 dark:border-yellow-800 rounded-lg p-3">
                        <p className="text-xs font-medium text-yellow-900 dark:text-yellow-200 mb-1">📝 Observações:</p>
                        <p className="text-xs text-yellow-800 dark:text-yellow-300 whitespace-pre-wrap">{cliente.observacoes}</p>
                      </div>
                    )}

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