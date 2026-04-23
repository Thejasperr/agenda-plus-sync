import React, { useState, useEffect } from 'react';
import { Plus, Search, Phone, Edit2, MessageCircle, History, Gift, X, AlertCircle } from 'lucide-react';
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
import { useAgendamentosRealtime } from '@/hooks/useAgendamentosRealtime';

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
  const { toast } = useToast();

  const formatPhoneForDisplay = (phone: string) => {
    let digits = phone.replace(/\D/g, '');
    // Strip 55 country code for display
    if ((digits.length === 12 || digits.length === 13) && digits.startsWith('55')) {
      digits = digits.slice(2);
    }
    if (digits.length === 11) return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`;
    if (digits.length === 10) return `(${digits.slice(0, 2)}) ${digits.slice(2, 6)}-${digits.slice(6)}`;
    return phone;
  };

  useEffect(() => {
    fetchClientes();
    fetchAgendamentos();
  }, []);

  // Sincronização em tempo real entre telas
  useAgendamentosRealtime(() => {
    fetchClientes();
    fetchAgendamentos();
  });

  const fetchClientes = async () => {
    try {
      const { data, error } = await supabase.from('clientes').select('*').order('created_at', { ascending: false });
      if (error) throw error;
      setClientes(data || []);
    } catch (error) {
      toast({ title: "Erro", description: getSecureErrorMessage(error, 'carregamento de clientes'), variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const fetchAgendamentos = async () => {
    try {
      const { data, error } = await supabase.from('agendamentos').select('*').order('data_agendamento', { ascending: false }).order('hora_agendamento', { ascending: false });
      if (error) throw error;
      const agendamentosPorTelefone: {[key: string]: Agendamento[]} = {};
      data?.forEach((agendamento) => {
        if (!agendamentosPorTelefone[agendamento.telefone]) agendamentosPorTelefone[agendamento.telefone] = [];
        agendamentosPorTelefone[agendamento.telefone].push(agendamento);
      });
      setClienteAgendamentos(agendamentosPorTelefone);
    } catch (error) {
      // Silently handle
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormErrors({ nome: '', telefone: '', observacoes: '' });
    const sanitizedData = { nome: sanitizeInput(formData.nome), telefone: formData.telefone, observacoes: sanitizeInput(formData.observacoes) };
    const phoneValidation = validateAndFormatPhone(sanitizedData.telefone);
    if (!phoneValidation.isValid) { setFormErrors({ ...formErrors, telefone: phoneValidation.error || 'Telefone inválido' }); return; }
    sanitizedData.telefone = phoneValidation.formatted;
    try { clienteSchema.parse(sanitizedData); } catch (error: any) {
      if (error.errors?.[0]) { const field = error.errors[0].path[0]; setFormErrors({ ...formErrors, [field]: error.errors[0].message }); }
      return;
    }
    try {
      if (editingCliente) {
        const { error } = await supabase.from('clientes').update(sanitizedData).eq('id', editingCliente.id);
        if (error) throw error;
        toast({ title: "Sucesso", description: "Cliente atualizado!" });
      } else {
        const { error } = await supabase.from('clientes').insert([sanitizedData]);
        if (error) throw error;
        toast({ title: "Sucesso", description: "Cliente adicionado!" });
      }
      setFormData({ nome: '', telefone: '', observacoes: '' }); setEditingCliente(null); setDialogOpen(false); fetchClientes();
    } catch (error: any) {
      toast({ title: "Erro", description: getSecureErrorMessage(error, 'salvamento do cliente'), variant: "destructive" });
    }
  };

  const handleEdit = (cliente: Cliente) => {
    setFormData({ nome: cliente.nome, telefone: cliente.telefone, observacoes: cliente.observacoes || '' });
    setEditingCliente(cliente); setDialogOpen(true);
  };

  const resetForm = () => { setFormData({ nome: '', telefone: '', observacoes: '' }); setFormErrors({ nome: '', telefone: '', observacoes: '' }); setEditingCliente(null); setDialogOpen(false); };

  const openWhatsApp = (telefone: string, nome: string) => {
    const message = encodeURIComponent(`Olá ${nome}! Como posso ajudar você hoje?`);
    const phoneNumber = telefone.replace(/\D/g, '');
    window.open(`https://wa.me/55${phoneNumber}?text=${message}`, '_blank');
  };

  const getClienteAgendamentos = (telefone: string) => clienteAgendamentos[telefone] || [];
  const getClienteGastoTotal = (telefone: string) => getClienteAgendamentos(telefone).filter(ag => ag.status === 'Concluído').reduce((total, ag) => {
    let valor = ag.preco;
    if (ag.tem_desconto && ag.porcentagem_desconto) valor = valor * (1 - ag.porcentagem_desconto / 100);
    return total + valor;
  }, 0);
  const getClienteAtendimentosTotal = (telefone: string) => getClienteAgendamentos(telefone).filter(ag => ag.status === 'Concluído').length;
  const getUltimos6Agendamentos = (telefone: string) => getClienteAgendamentos(telefone).slice(0, 6);
  const temDireitoGratis = (telefone: string) => getClienteAgendamentos(telefone).length >= 6;

  const handleDelete = async (clienteId: string) => {
    if (!window.confirm('Tem certeza que deseja excluir este cliente?')) return;
    try {
      const { error } = await supabase.from('clientes').delete().eq('id', clienteId);
      if (error) throw error;
      toast({ title: "Sucesso", description: "Cliente excluído!" }); fetchClientes();
    } catch (error) {
      toast({ title: "Erro", description: getSecureErrorMessage(error, 'exclusão do cliente'), variant: "destructive" });
    }
  };

  const filteredClientes = clientes.filter(cliente => cliente.nome.toLowerCase().includes(searchTerm.toLowerCase()) || cliente.telefone.includes(searchTerm));

  const formatDate = (dateString: string) => {
    const [year, month, day] = dateString.split('-').map(Number);
    return new Date(year, month - 1, day).toLocaleDateString('pt-BR');
  };

  if (loading) return <div className="flex items-center justify-center h-64"><div className="text-muted-foreground">Carregando clientes...</div></div>;

  return (
    <div className="space-y-4">
      <div className="flex gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Buscar por nome ou telefone..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="pl-10" />
        </div>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button className="mobile-button shrink-0" onClick={() => { resetForm(); setDialogOpen(true); }}>
              <Plus className="h-4 w-4 mr-1" /> Novo
            </Button>
          </DialogTrigger>
          <DialogContent className="w-[90%] max-w-md mx-auto">
            <DialogHeader><DialogTitle>{editingCliente ? 'Editar Cliente' : 'Novo Cliente'}</DialogTitle></DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <Label htmlFor="nome">Nome *</Label>
                <Input id="nome" value={formData.nome} onChange={(e) => { setFormData({ ...formData, nome: e.target.value }); setFormErrors({ ...formErrors, nome: '' }); }} placeholder="Nome completo" className={formErrors.nome ? 'border-destructive' : ''} />
                {formErrors.nome && <div className="text-sm text-destructive flex items-center gap-1 mt-1"><AlertCircle className="h-3 w-3" />{formErrors.nome}</div>}
              </div>
              <div>
                <Label htmlFor="telefone">Telefone *</Label>
                <Input id="telefone" value={formData.telefone} onChange={(e) => {
                  let value = e.target.value.replace(/\D/g, '');
                  if (value.startsWith('55') && value.length > 11) value = value.slice(2);
                  let displayValue = value;
                  if (value.length >= 11) displayValue = `(${value.slice(0, 2)}) ${value.slice(2, 7)}-${value.slice(7, 11)}`;
                  else if (value.length >= 6) displayValue = `(${value.slice(0, 2)}) ${value.slice(2, 6)}-${value.slice(6)}`;
                  else if (value.length >= 2) displayValue = `(${value.slice(0, 2)}) ${value.slice(2)}`;
                  setFormData({ ...formData, telefone: displayValue }); setFormErrors({ ...formErrors, telefone: '' });
                }} placeholder="(14) 99118-5209" className={formErrors.telefone ? 'border-destructive' : ''} />
                {formErrors.telefone && <div className="text-sm text-destructive flex items-center gap-1 mt-1"><AlertCircle className="h-3 w-3" />{formErrors.telefone}</div>}
              </div>
              <div>
                <Label htmlFor="observacoes">Observações</Label>
                <Textarea id="observacoes" value={formData.observacoes} onChange={(e) => setFormData({ ...formData, observacoes: e.target.value })} placeholder="Observações sobre o cliente..." rows={3} />
              </div>
              <div className="flex gap-2 pt-2">
                <Button type="button" variant="outline" onClick={resetForm} className="flex-1">Cancelar</Button>
                <Button type="submit" className="mobile-button flex-1">{editingCliente ? 'Atualizar' : 'Salvar'}</Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {filteredClientes.length === 0 ? (
        <div className="text-center py-8 text-muted-foreground">{searchTerm ? 'Nenhum cliente encontrado' : 'Nenhum cliente cadastrado'}</div>
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
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <h3 className="font-semibold text-foreground">{cliente.nome}</h3>
                          {direitoGratis && (
                            <Badge className="bg-yellow-500/10 text-yellow-700 border-yellow-200">
                              <Gift className="h-3 w-3 mr-1" /> Grátis
                            </Badge>
                          )}
                        </div>
                        <div className="flex items-center text-muted-foreground text-sm mt-1">
                          <Phone className="h-3 w-3 mr-1" />
                          <span>{formatPhoneForDisplay(cliente.telefone)}</span>
                        </div>
                        {cliente.ultimo_atendimento && (
                          <div className="text-xs text-muted-foreground mt-1">Último: {formatDate(cliente.ultimo_atendimento)}</div>
                        )}
                      </div>
                      <div className="text-right text-xs text-muted-foreground">
                        {formatDate(cliente.created_at)}
                      </div>
                    </div>

                    <div className="grid grid-cols-3 gap-2 p-2 bg-muted/30 rounded-xl">
                      <div className="text-center">
                        <div className="text-lg font-bold text-green-600">R$ {gastoTotal.toFixed(0)}</div>
                        <div className="text-xs text-muted-foreground">Gasto</div>
                      </div>
                      <div className="text-center">
                        <div className="text-lg font-bold text-blue-600">{atendimentosTotal}</div>
                        <div className="text-xs text-muted-foreground">Atendim.</div>
                      </div>
                      <div className="text-center">
                        <div className="text-lg font-bold text-purple-600">R$ {(cliente.saldo_credito || 0).toFixed(0)}</div>
                        <div className="text-xs text-muted-foreground">Crédito</div>
                      </div>
                    </div>

                    {cliente.observacoes && (
                      <div className="bg-yellow-500/10 border border-yellow-200 rounded-xl p-3">
                        <p className="text-xs font-medium text-yellow-900 mb-1">📝 Observações:</p>
                        <p className="text-xs text-yellow-800 whitespace-pre-wrap">{cliente.observacoes}</p>
                      </div>
                    )}

                    {agendamentos.length > 0 && (
                      <div>
                        <div className="text-xs font-medium text-muted-foreground mb-1 flex items-center gap-1">
                          <History className="h-3 w-3" /> Últimos agendamentos
                        </div>
                        <div className="space-y-1">
                          {agendamentos.map((ag) => (
                            <div key={ag.id} className="text-xs bg-muted/30 p-2 rounded-lg flex justify-between items-center">
                              <span>{formatDate(ag.data_agendamento)} às {ag.hora_agendamento}</span>
                              <Badge variant="outline" className={`text-xs ${
                                ag.status === 'Concluído' ? 'bg-green-500/10 text-green-700 border-green-200'
                                : ag.status === 'Cancelado' ? 'bg-red-500/10 text-red-700 border-red-200'
                                : 'bg-blue-500/10 text-blue-700 border-blue-200'
                              }`}>{ag.status}</Badge>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    <Separator />

                    <div className="flex gap-2">
                      <Button variant="outline" size="sm" onClick={() => handleEdit(cliente)} className="flex-1"><Edit2 className="h-3 w-3" /></Button>
                      <Button variant="outline" size="sm" onClick={() => { setSelectedClienteId(cliente.id); setHistoricoDialogOpen(true); }} className="flex-1"><History className="h-3 w-3" /></Button>
                      <Button variant="outline" size="sm" onClick={() => openWhatsApp(cliente.telefone, cliente.nome)} className="flex-1 text-green-600"><MessageCircle className="h-3 w-3" /></Button>
                      <Button variant="outline" size="sm" onClick={() => handleDelete(cliente.id)} className="flex-1 text-red-600"><X className="h-3 w-3" /></Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      <Dialog open={historicoDialogOpen} onOpenChange={setHistoricoDialogOpen}>
        <DialogContent className="w-[95%] max-w-2xl mx-auto max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Histórico - {selectedClienteId ? clientes.find(c => c.id === selectedClienteId)?.nome : ''}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            {selectedClienteId && (() => {
              const cliente = clientes.find(c => c.id === selectedClienteId);
              const agendamentos = cliente ? getClienteAgendamentos(cliente.telefone) : [];
              if (agendamentos.length === 0) return <div className="text-center py-8 text-muted-foreground">Nenhum agendamento</div>;
              return agendamentos.map((ag) => (
                <Card key={ag.id} className="mobile-card">
                  <CardContent className="p-3">
                    <div className="flex justify-between items-start mb-2">
                      <div>
                        <div className="font-medium">{formatDate(ag.data_agendamento)} às {ag.hora_agendamento}</div>
                        <div className="text-sm text-success font-medium">R$ {ag.preco.toFixed(2)}</div>
                      </div>
                      <Badge variant="outline" className={ag.status === 'Concluído' ? 'bg-green-500/10 text-green-700' : ag.status === 'Cancelado' ? 'bg-red-500/10 text-red-700' : 'bg-blue-500/10 text-blue-700'}>{ag.status}</Badge>
                    </div>
                    {ag.observacoes && <div className="text-xs text-muted-foreground bg-muted/50 p-2 rounded"><strong>Obs:</strong> {ag.observacoes}</div>}
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
