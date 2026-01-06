import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { 
  Plus, 
  Search, 
  Users, 
  Calendar as CalendarIcon, 
  DollarSign, 
  History,
  UserPlus,
  Check,
  X,
  Edit,
  Trash2,
  Phone,
  AlertCircle,
  Settings,
  Power,
  PowerOff
} from 'lucide-react';
import { format, addDays, startOfWeek, endOfWeek, isWithinInterval, parseISO, isSameDay } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface Cliente {
  id: string;
  nome: string;
  telefone: string;
}

interface Procedimento {
  id: string;
  nome: string;
  descricao: string | null;
  duracao_minutos: number | null;
  valor: number | null;
  ativo: boolean;
}

interface Assinatura {
  id: string;
  cliente_id: string;
  data_inicio: string;
  dia_pagamento: number;
  valor_mensal: number;
  ativa: boolean;
  observacoes: string | null;
  procedimento_id: string | null;
  cliente?: Cliente;
  procedimento?: Procedimento;
}

interface Sessao {
  id: string;
  assinatura_id: string;
  data_sessao: string;
  hora_sessao: string | null;
  realizada: boolean;
  observacoes: string | null;
  assinatura?: Assinatura;
}

interface Pagamento {
  id: string;
  assinatura_id: string;
  mes_referencia: string;
  valor_pago: number;
  data_pagamento: string;
  forma_pagamento: string | null;
  pago: boolean;
  observacoes: string | null;
}

const SpasTab = () => {
  const { toast } = useToast();
  const [subTab, setSubTab] = useState('clientes');
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(true);
  
  // Data
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [assinaturas, setAssinaturas] = useState<Assinatura[]>([]);
  const [sessoes, setSessoes] = useState<Sessao[]>([]);
  const [pagamentos, setPagamentos] = useState<Pagamento[]>([]);
  const [formasPagamento, setFormasPagamento] = useState<{nome: string}[]>([]);
  const [procedimentos, setProcedimentos] = useState<Procedimento[]>([]);
  
  // Dialogs
  const [dialogOpen, setDialogOpen] = useState(false);
  const [sessaoDialogOpen, setSessaoDialogOpen] = useState(false);
  const [pagamentoDialogOpen, setPagamentoDialogOpen] = useState(false);
  const [historicoDialogOpen, setHistoricoDialogOpen] = useState(false);
  const [procedimentoDialogOpen, setProcedimentoDialogOpen] = useState(false);
  
  // Forms
  const [selectedCliente, setSelectedCliente] = useState<string>('');
  const [valorMensal, setValorMensal] = useState('');
  const [diaPagamento, setDiaPagamento] = useState('1');
  const [observacoes, setObservacoes] = useState('');
  const [selectedProcedimento, setSelectedProcedimento] = useState<string>('');
  const [editingAssinatura, setEditingAssinatura] = useState<Assinatura | null>(null);
  
  // Procedimento form
  const [nomeProcedimento, setNomeProcedimento] = useState('');
  const [descricaoProcedimento, setDescricaoProcedimento] = useState('');
  const [duracaoProcedimento, setDuracaoProcedimento] = useState('');
  const [valorProcedimento, setValorProcedimento] = useState('');
  const [editingProcedimento, setEditingProcedimento] = useState<Procedimento | null>(null);
  
  // Sessão form
  const [selectedAssinatura, setSelectedAssinatura] = useState<string>('');
  const [dataSessao, setDataSessao] = useState<Date | undefined>(new Date());
  const [horaSessao, setHoraSessao] = useState('');
  
  // Pagamento form
  const [valorPago, setValorPago] = useState('');
  const [formaPagamento, setFormaPagamento] = useState('');
  const [mesReferencia, setMesReferencia] = useState<Date | undefined>(new Date());
  
  // Histórico
  const [historicoAssinatura, setHistoricoAssinatura] = useState<Assinatura | null>(null);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      // Fetch clientes
      const { data: clientesData } = await supabase
        .from('clientes')
        .select('id, nome, telefone')
        .order('nome');
      
      // Fetch assinaturas
      const { data: assinaturasData } = await supabase
        .from('spas_assinaturas')
        .select('*')
        .order('created_at', { ascending: false });
      
      // Fetch sessões
      const { data: sessoesData } = await supabase
        .from('spas_sessoes')
        .select('*')
        .order('data_sessao', { ascending: false });
      
      // Fetch pagamentos
      const { data: pagamentosData } = await supabase
        .from('spas_pagamentos')
        .select('*')
        .order('mes_referencia', { ascending: false });

      // Fetch formas de pagamento
      const { data: formasData } = await supabase
        .from('formas_pagamento')
        .select('nome')
        .eq('ativa', true);
      
      // Fetch procedimentos
      const { data: procedimentosData } = await supabase
        .from('spas_procedimentos')
        .select('*')
        .order('nome');

      if (clientesData) setClientes(clientesData);
      if (assinaturasData) setAssinaturas(assinaturasData);
      if (sessoesData) setSessoes(sessoesData);
      if (pagamentosData) setPagamentos(pagamentosData);
      if (formasData) setFormasPagamento(formasData);
      if (procedimentosData) setProcedimentos(procedimentosData);
    } catch (error) {
      console.error('Erro ao buscar dados:', error);
    } finally {
      setLoading(false);
    }
  };

  const getClienteById = (id: string) => clientes.find(c => c.id === id);
  const getProcedimentoById = (id: string) => procedimentos.find(p => p.id === id);

  const clientesNoSpa = assinaturas
    .filter(a => a.ativa)
    .map(a => ({ 
      ...a, 
      cliente: getClienteById(a.cliente_id),
      procedimento: a.procedimento_id ? getProcedimentoById(a.procedimento_id) : undefined
    }))
    .filter(a => a.cliente);
    
  const clientesInativos = assinaturas
    .filter(a => !a.ativa)
    .map(a => ({ 
      ...a, 
      cliente: getClienteById(a.cliente_id),
      procedimento: a.procedimento_id ? getProcedimentoById(a.procedimento_id) : undefined
    }))
    .filter(a => a.cliente);

  const clientesDisponiveis = clientes.filter(
    c => !assinaturas.some(a => a.cliente_id === c.id && a.ativa)
  );

  const getProximaSessao = (assinaturaId: string): Date | null => {
    const sessoesAssinatura = sessoes.filter(s => s.assinatura_id === assinaturaId && !s.realizada);
    if (sessoesAssinatura.length === 0) return null;
    
    const futuras = sessoesAssinatura
      .map(s => parseISO(s.data_sessao))
      .filter(d => d >= new Date())
      .sort((a, b) => a.getTime() - b.getTime());
    
    return futuras[0] || null;
  };

  const getSessoesRealizadasMes = (assinaturaId: string): number => {
    const hoje = new Date();
    const inicioMes = new Date(hoje.getFullYear(), hoje.getMonth(), 1);
    const fimMes = new Date(hoje.getFullYear(), hoje.getMonth() + 1, 0);
    
    return sessoes.filter(s => 
      s.assinatura_id === assinaturaId && 
      s.realizada &&
      isWithinInterval(parseISO(s.data_sessao), { start: inicioMes, end: fimMes })
    ).length;
  };

  const handleAddAssinatura = async () => {
    if (!selectedCliente || !valorMensal) {
      toast({ title: 'Erro', description: 'Preencha todos os campos obrigatórios.', variant: 'destructive' });
      return;
    }

    try {
      const { error } = await supabase
        .from('spas_assinaturas')
        .insert({
          cliente_id: selectedCliente,
          valor_mensal: parseFloat(valorMensal),
          dia_pagamento: parseInt(diaPagamento),
          observacoes: observacoes || null,
          procedimento_id: selectedProcedimento || null,
        });

      if (error) throw error;

      toast({ title: 'Sucesso', description: 'Cliente adicionado ao programa de Spa!' });
      resetForm();
      setDialogOpen(false);
      fetchData();
    } catch (error: any) {
      toast({ title: 'Erro', description: error.message, variant: 'destructive' });
    }
  };

  const handleUpdateAssinatura = async () => {
    if (!editingAssinatura) return;

    try {
      const { error } = await supabase
        .from('spas_assinaturas')
        .update({
          valor_mensal: parseFloat(valorMensal),
          dia_pagamento: parseInt(diaPagamento),
          observacoes: observacoes || null,
          procedimento_id: selectedProcedimento || null,
        })
        .eq('id', editingAssinatura.id);

      if (error) throw error;

      toast({ title: 'Sucesso', description: 'Assinatura atualizada!' });
      resetForm();
      setDialogOpen(false);
      fetchData();
    } catch (error: any) {
      toast({ title: 'Erro', description: error.message, variant: 'destructive' });
    }
  };

  const handleDesativarAssinatura = async (id: string) => {
    if (!confirm('Deseja realmente desativar esta assinatura?')) return;

    try {
      const { error } = await supabase
        .from('spas_assinaturas')
        .update({ ativa: false })
        .eq('id', id);

      if (error) throw error;

      toast({ title: 'Sucesso', description: 'Assinatura desativada.' });
      fetchData();
    } catch (error: any) {
      toast({ title: 'Erro', description: error.message, variant: 'destructive' });
    }
  };

  const handleAtivarAssinatura = async (id: string) => {
    try {
      const { error } = await supabase
        .from('spas_assinaturas')
        .update({ ativa: true })
        .eq('id', id);

      if (error) throw error;

      toast({ title: 'Sucesso', description: 'Assinatura reativada!' });
      fetchData();
    } catch (error: any) {
      toast({ title: 'Erro', description: error.message, variant: 'destructive' });
    }
  };

  // Procedimentos CRUD
  const handleAddProcedimento = async () => {
    if (!nomeProcedimento) {
      toast({ title: 'Erro', description: 'Nome do procedimento é obrigatório.', variant: 'destructive' });
      return;
    }

    try {
      const { error } = await supabase
        .from('spas_procedimentos')
        .insert({
          nome: nomeProcedimento,
          descricao: descricaoProcedimento || null,
          duracao_minutos: duracaoProcedimento ? parseInt(duracaoProcedimento) : null,
          valor: valorProcedimento ? parseFloat(valorProcedimento) : null,
        });

      if (error) throw error;

      toast({ title: 'Sucesso', description: 'Procedimento adicionado!' });
      resetProcedimentoForm();
      setProcedimentoDialogOpen(false);
      fetchData();
    } catch (error: any) {
      toast({ title: 'Erro', description: error.message, variant: 'destructive' });
    }
  };

  const handleUpdateProcedimento = async () => {
    if (!editingProcedimento) return;

    try {
      const { error } = await supabase
        .from('spas_procedimentos')
        .update({
          nome: nomeProcedimento,
          descricao: descricaoProcedimento || null,
          duracao_minutos: duracaoProcedimento ? parseInt(duracaoProcedimento) : null,
          valor: valorProcedimento ? parseFloat(valorProcedimento) : null,
        })
        .eq('id', editingProcedimento.id);

      if (error) throw error;

      toast({ title: 'Sucesso', description: 'Procedimento atualizado!' });
      resetProcedimentoForm();
      setProcedimentoDialogOpen(false);
      fetchData();
    } catch (error: any) {
      toast({ title: 'Erro', description: error.message, variant: 'destructive' });
    }
  };

  const handleToggleProcedimento = async (procedimento: Procedimento) => {
    try {
      const { error } = await supabase
        .from('spas_procedimentos')
        .update({ ativo: !procedimento.ativo })
        .eq('id', procedimento.id);

      if (error) throw error;

      toast({ title: 'Sucesso', description: procedimento.ativo ? 'Procedimento desativado.' : 'Procedimento ativado.' });
      fetchData();
    } catch (error: any) {
      toast({ title: 'Erro', description: error.message, variant: 'destructive' });
    }
  };

  const handleDeleteProcedimento = async (id: string) => {
    if (!confirm('Deseja realmente excluir este procedimento?')) return;

    try {
      const { error } = await supabase
        .from('spas_procedimentos')
        .delete()
        .eq('id', id);

      if (error) throw error;

      toast({ title: 'Sucesso', description: 'Procedimento excluído.' });
      fetchData();
    } catch (error: any) {
      toast({ title: 'Erro', description: error.message, variant: 'destructive' });
    }
  };

  const handleEditProcedimento = (procedimento: Procedimento) => {
    setEditingProcedimento(procedimento);
    setNomeProcedimento(procedimento.nome);
    setDescricaoProcedimento(procedimento.descricao || '');
    setDuracaoProcedimento(procedimento.duracao_minutos?.toString() || '');
    setValorProcedimento(procedimento.valor?.toString() || '');
    setProcedimentoDialogOpen(true);
  };

  const resetProcedimentoForm = () => {
    setNomeProcedimento('');
    setDescricaoProcedimento('');
    setDuracaoProcedimento('');
    setValorProcedimento('');
    setEditingProcedimento(null);
  };

  const handleAddSessao = async () => {
    if (!selectedAssinatura || !dataSessao) {
      toast({ title: 'Erro', description: 'Selecione o cliente e a data.', variant: 'destructive' });
      return;
    }

    try {
      const { error } = await supabase
        .from('spas_sessoes')
        .insert({
          assinatura_id: selectedAssinatura,
          data_sessao: format(dataSessao, 'yyyy-MM-dd'),
          hora_sessao: horaSessao || null,
        });

      if (error) throw error;

      toast({ title: 'Sucesso', description: 'Sessão agendada!' });
      setSelectedAssinatura('');
      setDataSessao(new Date());
      setHoraSessao('');
      setSessaoDialogOpen(false);
      fetchData();
    } catch (error: any) {
      toast({ title: 'Erro', description: error.message, variant: 'destructive' });
    }
  };

  const handleMarcarRealizada = async (sessaoId: string, realizada: boolean) => {
    try {
      const { error } = await supabase
        .from('spas_sessoes')
        .update({ realizada })
        .eq('id', sessaoId);

      if (error) throw error;

      toast({ title: 'Sucesso', description: realizada ? 'Sessão marcada como realizada.' : 'Sessão desmarcada.' });
      fetchData();
    } catch (error: any) {
      toast({ title: 'Erro', description: error.message, variant: 'destructive' });
    }
  };

  const handleAddPagamento = async () => {
    if (!selectedAssinatura || !valorPago || !mesReferencia) {
      toast({ title: 'Erro', description: 'Preencha todos os campos obrigatórios.', variant: 'destructive' });
      return;
    }

    try {
      const { error } = await supabase
        .from('spas_pagamentos')
        .insert({
          assinatura_id: selectedAssinatura,
          valor_pago: parseFloat(valorPago),
          mes_referencia: format(mesReferencia, 'yyyy-MM-01'),
          forma_pagamento: formaPagamento || null,
        });

      if (error) throw error;

      toast({ title: 'Sucesso', description: 'Pagamento registrado!' });
      setSelectedAssinatura('');
      setValorPago('');
      setFormaPagamento('');
      setMesReferencia(new Date());
      setPagamentoDialogOpen(false);
      fetchData();
    } catch (error: any) {
      toast({ title: 'Erro', description: error.message, variant: 'destructive' });
    }
  };

  const handleEditAssinatura = (assinatura: Assinatura) => {
    setEditingAssinatura(assinatura);
    setSelectedCliente(assinatura.cliente_id);
    setValorMensal(assinatura.valor_mensal.toString());
    setDiaPagamento(assinatura.dia_pagamento.toString());
    setObservacoes(assinatura.observacoes || '');
    setSelectedProcedimento(assinatura.procedimento_id || '');
    setDialogOpen(true);
  };

  const resetForm = () => {
    setSelectedCliente('');
    setValorMensal('');
    setDiaPagamento('1');
    setObservacoes('');
    setSelectedProcedimento('');
    setEditingAssinatura(null);
  };

  const openWhatsApp = (telefone: string) => {
    const phoneFormatted = telefone.replace(/\D/g, '');
    window.open(`https://wa.me/55${phoneFormatted}`, '_blank');
  };

  // Sessões da semana atual
  const hoje = new Date();
  const inicioSemana = startOfWeek(hoje, { weekStartsOn: 0 });
  const fimSemana = endOfWeek(hoje, { weekStartsOn: 0 });
  
  const sessoesSemana = sessoes
    .filter(s => {
      const data = parseISO(s.data_sessao);
      return isWithinInterval(data, { start: inicioSemana, end: fimSemana });
    })
    .map(s => ({
      ...s,
      assinatura: assinaturas.find(a => a.id === s.assinatura_id),
    }))
    .filter(s => s.assinatura)
    .sort((a, b) => parseISO(a.data_sessao).getTime() - parseISO(b.data_sessao).getTime());

  const filteredClientes = clientesNoSpa.filter(a =>
    a.cliente?.nome.toLowerCase().includes(searchTerm.toLowerCase()) ||
    a.cliente?.telefone.includes(searchTerm)
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="space-y-4 p-4">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold">Spa dos Pés</h2>
      </div>

      <Tabs value={subTab} onValueChange={setSubTab} className="w-full">
        <TabsList className="grid w-full grid-cols-5">
          <TabsTrigger value="clientes" className="flex items-center gap-1">
            <Users size={14} />
            <span className="hidden sm:inline">Clientes</span>
          </TabsTrigger>
          <TabsTrigger value="calendario" className="flex items-center gap-1">
            <CalendarIcon size={14} />
            <span className="hidden sm:inline">Sessões</span>
          </TabsTrigger>
          <TabsTrigger value="pagamentos" className="flex items-center gap-1">
            <DollarSign size={14} />
            <span className="hidden sm:inline">Pagamentos</span>
          </TabsTrigger>
          <TabsTrigger value="historico" className="flex items-center gap-1">
            <History size={14} />
            <span className="hidden sm:inline">Histórico</span>
          </TabsTrigger>
          <TabsTrigger value="procedimentos" className="flex items-center gap-1">
            <Settings size={14} />
            <span className="hidden sm:inline">Procedimentos</span>
          </TabsTrigger>
        </TabsList>

        {/* Clientes Tab */}
        <TabsContent value="clientes" className="space-y-4">
          <div className="flex flex-col sm:flex-row gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground" size={18} />
              <Input
                placeholder="Buscar cliente..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
            <Dialog open={dialogOpen} onOpenChange={(open) => { setDialogOpen(open); if (!open) resetForm(); }}>
              <DialogTrigger asChild>
                <Button className="gap-2">
                  <UserPlus size={18} />
                  Adicionar ao Spa
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>{editingAssinatura ? 'Editar Assinatura' : 'Adicionar Cliente ao Spa'}</DialogTitle>
                </DialogHeader>
                <div className="space-y-4">
                  {!editingAssinatura && (
                    <div>
                      <Label>Cliente *</Label>
                      <Select value={selectedCliente} onValueChange={setSelectedCliente}>
                        <SelectTrigger>
                          <SelectValue placeholder="Selecione um cliente" />
                        </SelectTrigger>
                        <SelectContent>
                          {clientesDisponiveis.map((cliente) => (
                            <SelectItem key={cliente.id} value={cliente.id}>
                              {cliente.nome} - {cliente.telefone}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      {clientesDisponiveis.length === 0 && (
                        <p className="text-sm text-muted-foreground mt-1">
                          Todos os clientes já estão no programa de Spa.
                        </p>
                      )}
                    </div>
                  )}
                  <div>
                    <Label>Valor Mensal (R$) *</Label>
                    <Input
                      type="number"
                      step="0.01"
                      value={valorMensal}
                      onChange={(e) => setValorMensal(e.target.value)}
                      placeholder="Ex: 150.00"
                    />
                  </div>
                  <div>
                    <Label>Dia do Pagamento</Label>
                    <Select value={diaPagamento} onValueChange={setDiaPagamento}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {Array.from({ length: 28 }, (_, i) => i + 1).map((dia) => (
                          <SelectItem key={dia} value={dia.toString()}>
                            Dia {dia}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>Procedimento</Label>
                    <Select value={selectedProcedimento} onValueChange={setSelectedProcedimento}>
                      <SelectTrigger>
                        <SelectValue placeholder="Selecione um procedimento" />
                      </SelectTrigger>
                      <SelectContent>
                        {procedimentos.filter(p => p.ativo).map((proc) => (
                          <SelectItem key={proc.id} value={proc.id}>
                            {proc.nome}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>Observações</Label>
                    <Input
                      value={observacoes}
                      onChange={(e) => setObservacoes(e.target.value)}
                      placeholder="Observações adicionais..."
                    />
                  </div>
                  <Button 
                    onClick={editingAssinatura ? handleUpdateAssinatura : handleAddAssinatura} 
                    className="w-full"
                    disabled={!editingAssinatura && !selectedCliente}
                  >
                    {editingAssinatura ? 'Salvar Alterações' : 'Adicionar ao Programa'}
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
          </div>

          {filteredClientes.length === 0 ? (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-8">
                <Users className="h-12 w-12 text-muted-foreground mb-4" />
                <p className="text-muted-foreground">Nenhum cliente no programa de Spa.</p>
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-3">
              {filteredClientes.map((assinatura) => {
                const proximaSessao = getProximaSessao(assinatura.id);
                const sessoesNoMes = getSessoesRealizadasMes(assinatura.id);
                
                return (
                  <Card key={assinatura.id}>
                    <CardContent className="p-4">
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <h3 className="font-semibold">{assinatura.cliente?.nome}</h3>
                            <Badge variant="secondary" className="text-xs">
                              {sessoesNoMes}/4 sessões
                            </Badge>
                          </div>
                          <p className="text-sm text-muted-foreground">{assinatura.cliente?.telefone}</p>
                          {assinatura.procedimento && (
                            <Badge variant="default" className="mt-1 bg-purple-600">
                              {assinatura.procedimento.nome}
                            </Badge>
                          )}
                          <div className="flex flex-wrap gap-2 mt-2">
                            <Badge variant="outline">
                              R$ {assinatura.valor_mensal.toFixed(2)}/mês
                            </Badge>
                            <Badge variant="outline">
                              Paga dia {assinatura.dia_pagamento}
                            </Badge>
                          </div>
                          {proximaSessao && (
                            <p className="text-sm text-primary mt-2">
                              <CalendarIcon size={14} className="inline mr-1" />
                              Próxima: {format(proximaSessao, "dd/MM 'às' HH:mm", { locale: ptBR })}
                            </p>
                          )}
                          {assinatura.observacoes && (
                            <p className="text-sm text-muted-foreground mt-1">{assinatura.observacoes}</p>
                          )}
                        </div>
                        <div className="flex flex-col gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => openWhatsApp(assinatura.cliente?.telefone || '')}
                          >
                            <Phone size={16} />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleEditAssinatura(assinatura)}
                          >
                            <Edit size={16} />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => {
                              setHistoricoAssinatura(assinatura);
                              setHistoricoDialogOpen(true);
                            }}
                          >
                            <History size={16} />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="text-destructive"
                            onClick={() => handleDesativarAssinatura(assinatura.id)}
                            title="Desativar"
                          >
                            <PowerOff size={16} />
                          </Button>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
              
              {/* Clientes Inativos */}
              {clientesInativos.length > 0 && (
                <>
                  <div className="flex items-center gap-2 mt-4">
                    <h4 className="text-sm font-medium text-muted-foreground">Clientes Inativos</h4>
                    <Badge variant="outline" className="text-xs">{clientesInativos.length}</Badge>
                  </div>
                  {clientesInativos.map((assinatura) => (
                    <Card key={assinatura.id} className="opacity-60">
                      <CardContent className="p-4">
                        <div className="flex items-center justify-between">
                          <div>
                            <div className="flex items-center gap-2">
                              <h3 className="font-semibold">{assinatura.cliente?.nome}</h3>
                              <Badge variant="outline" className="text-xs">Inativo</Badge>
                            </div>
                            <p className="text-sm text-muted-foreground">{assinatura.cliente?.telefone}</p>
                            {assinatura.procedimento && (
                              <p className="text-sm text-muted-foreground">{assinatura.procedimento.nome}</p>
                            )}
                          </div>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleAtivarAssinatura(assinatura.id)}
                            className="gap-1"
                          >
                            <Power size={14} />
                            Reativar
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </>
              )}
            </div>
          )}
        </TabsContent>

        {/* Calendário/Sessões Tab */}
        <TabsContent value="calendario" className="space-y-4">
          <div className="flex justify-between items-center">
            <h3 className="font-semibold">
              Sessões da Semana ({format(inicioSemana, 'dd/MM')} - {format(fimSemana, 'dd/MM')})
            </h3>
            <Dialog open={sessaoDialogOpen} onOpenChange={setSessaoDialogOpen}>
              <DialogTrigger asChild>
                <Button size="sm" className="gap-2">
                  <Plus size={16} />
                  Agendar Sessão
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Agendar Sessão de Spa</DialogTitle>
                </DialogHeader>
                <div className="space-y-4">
                  <div>
                    <Label>Cliente *</Label>
                    <Select value={selectedAssinatura} onValueChange={setSelectedAssinatura}>
                      <SelectTrigger>
                        <SelectValue placeholder="Selecione um cliente" />
                      </SelectTrigger>
                      <SelectContent>
                        {clientesNoSpa.map((assinatura) => (
                          <SelectItem key={assinatura.id} value={assinatura.id}>
                            {assinatura.cliente?.nome}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>Data *</Label>
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button variant="outline" className="w-full justify-start">
                          <CalendarIcon className="mr-2 h-4 w-4" />
                          {dataSessao ? format(dataSessao, 'dd/MM/yyyy') : 'Selecione'}
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0">
                        <Calendar
                          mode="single"
                          selected={dataSessao}
                          onSelect={setDataSessao}
                          locale={ptBR}
                        />
                      </PopoverContent>
                    </Popover>
                  </div>
                  <div>
                    <Label>Horário</Label>
                    <Input
                      type="time"
                      value={horaSessao}
                      onChange={(e) => setHoraSessao(e.target.value)}
                    />
                  </div>
                  <Button onClick={handleAddSessao} className="w-full">
                    Agendar Sessão
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
          </div>

          {sessoesSemana.length === 0 ? (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-8">
                <CalendarIcon className="h-12 w-12 text-muted-foreground mb-4" />
                <p className="text-muted-foreground">Nenhuma sessão agendada para esta semana.</p>
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-3">
              {sessoesSemana.map((sessao) => {
                const cliente = getClienteById(sessao.assinatura?.cliente_id || '');
                const isHoje = isSameDay(parseISO(sessao.data_sessao), hoje);
                
                return (
                  <Card key={sessao.id} className={isHoje ? 'border-primary' : ''}>
                    <CardContent className="p-4">
                      <div className="flex items-center justify-between">
                        <div>
                          <div className="flex items-center gap-2">
                            <h4 className="font-medium">{cliente?.nome}</h4>
                            {isHoje && <Badge variant="default">Hoje</Badge>}
                            {sessao.realizada && <Badge variant="secondary">Realizada</Badge>}
                          </div>
                          <p className="text-sm text-muted-foreground">
                            {format(parseISO(sessao.data_sessao), "EEEE, dd/MM", { locale: ptBR })}
                            {sessao.hora_sessao && ` às ${sessao.hora_sessao.slice(0, 5)}`}
                          </p>
                        </div>
                        <div className="flex gap-2">
                          {!sessao.realizada ? (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleMarcarRealizada(sessao.id, true)}
                              className="gap-1"
                            >
                              <Check size={14} />
                              Marcar
                            </Button>
                          ) : (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleMarcarRealizada(sessao.id, false)}
                              className="gap-1"
                            >
                              <X size={14} />
                              Desmarcar
                            </Button>
                          )}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </TabsContent>

        {/* Pagamentos Tab */}
        <TabsContent value="pagamentos" className="space-y-4">
          <div className="flex justify-between items-center">
            <h3 className="font-semibold">Controle de Pagamentos</h3>
            <Dialog open={pagamentoDialogOpen} onOpenChange={setPagamentoDialogOpen}>
              <DialogTrigger asChild>
                <Button size="sm" className="gap-2">
                  <Plus size={16} />
                  Registrar Pagamento
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Registrar Pagamento</DialogTitle>
                </DialogHeader>
                <div className="space-y-4">
                  <div>
                    <Label>Cliente *</Label>
                    <Select value={selectedAssinatura} onValueChange={(value) => {
                      setSelectedAssinatura(value);
                      const assinatura = assinaturas.find(a => a.id === value);
                      if (assinatura) {
                        setValorPago(assinatura.valor_mensal.toString());
                      }
                    }}>
                      <SelectTrigger>
                        <SelectValue placeholder="Selecione um cliente" />
                      </SelectTrigger>
                      <SelectContent>
                        {clientesNoSpa.map((assinatura) => (
                          <SelectItem key={assinatura.id} value={assinatura.id}>
                            {assinatura.cliente?.nome}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>Mês de Referência *</Label>
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button variant="outline" className="w-full justify-start">
                          <CalendarIcon className="mr-2 h-4 w-4" />
                          {mesReferencia ? format(mesReferencia, 'MMMM/yyyy', { locale: ptBR }) : 'Selecione'}
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0">
                        <Calendar
                          mode="single"
                          selected={mesReferencia}
                          onSelect={setMesReferencia}
                          locale={ptBR}
                        />
                      </PopoverContent>
                    </Popover>
                  </div>
                  <div>
                    <Label>Valor Pago (R$) *</Label>
                    <Input
                      type="number"
                      step="0.01"
                      value={valorPago}
                      onChange={(e) => setValorPago(e.target.value)}
                    />
                  </div>
                  <div>
                    <Label>Forma de Pagamento</Label>
                    <Select value={formaPagamento} onValueChange={setFormaPagamento}>
                      <SelectTrigger>
                        <SelectValue placeholder="Selecione" />
                      </SelectTrigger>
                      <SelectContent>
                        {formasPagamento.map((forma) => (
                          <SelectItem key={forma.nome} value={forma.nome}>
                            {forma.nome}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <Button onClick={handleAddPagamento} className="w-full">
                    Registrar Pagamento
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
          </div>

          {/* Lista de clientes com status de pagamento do mês */}
          <div className="grid gap-3">
            {clientesNoSpa.map((assinatura) => {
              const pagamentoMes = pagamentos.find(p => 
                p.assinatura_id === assinatura.id && 
                format(parseISO(p.mes_referencia), 'yyyy-MM') === format(hoje, 'yyyy-MM')
              );
              
              return (
                <Card key={assinatura.id}>
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <h4 className="font-medium">{assinatura.cliente?.nome}</h4>
                        <p className="text-sm text-muted-foreground">
                          Vencimento: dia {assinatura.dia_pagamento} • R$ {assinatura.valor_mensal.toFixed(2)}
                        </p>
                      </div>
                      {pagamentoMes ? (
                        <Badge variant="default" className="gap-1">
                          <Check size={12} />
                          Pago
                        </Badge>
                      ) : (
                        <Badge variant="destructive" className="gap-1">
                          <AlertCircle size={12} />
                          Pendente
                        </Badge>
                      )}
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </TabsContent>

        {/* Histórico Tab */}
        <TabsContent value="historico" className="space-y-4">
          <div>
            <Label>Selecione um cliente para ver o histórico</Label>
            <Select onValueChange={(value) => {
              const assinatura = assinaturas.find(a => a.id === value);
              if (assinatura) {
                setHistoricoAssinatura({ ...assinatura, cliente: getClienteById(assinatura.cliente_id) });
              }
            }}>
              <SelectTrigger>
                <SelectValue placeholder="Selecione um cliente" />
              </SelectTrigger>
              <SelectContent>
                {assinaturas.map((assinatura) => {
                  const cliente = getClienteById(assinatura.cliente_id);
                  return (
                    <SelectItem key={assinatura.id} value={assinatura.id}>
                      {cliente?.nome} {!assinatura.ativa && '(Inativo)'}
                    </SelectItem>
                  );
                })}
              </SelectContent>
            </Select>
          </div>

          {historicoAssinatura && (
            <div className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">
                    {getClienteById(historicoAssinatura.cliente_id)?.nome}
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <h4 className="font-medium mb-2">Sessões Realizadas</h4>
                    {sessoes.filter(s => s.assinatura_id === historicoAssinatura.id && s.realizada).length === 0 ? (
                      <p className="text-sm text-muted-foreground">Nenhuma sessão realizada.</p>
                    ) : (
                      <div className="space-y-2">
                        {sessoes
                          .filter(s => s.assinatura_id === historicoAssinatura.id && s.realizada)
                          .slice(0, 10)
                          .map((sessao) => (
                            <div key={sessao.id} className="flex items-center justify-between text-sm p-2 bg-muted rounded">
                              <span>{format(parseISO(sessao.data_sessao), 'dd/MM/yyyy')}</span>
                              {sessao.hora_sessao && <span>{sessao.hora_sessao.slice(0, 5)}</span>}
                            </div>
                          ))}
                      </div>
                    )}
                  </div>
                  <div>
                    <h4 className="font-medium mb-2">Pagamentos</h4>
                    {pagamentos.filter(p => p.assinatura_id === historicoAssinatura.id).length === 0 ? (
                      <p className="text-sm text-muted-foreground">Nenhum pagamento registrado.</p>
                    ) : (
                      <div className="space-y-2">
                        {pagamentos
                          .filter(p => p.assinatura_id === historicoAssinatura.id)
                          .slice(0, 10)
                          .map((pagamento) => (
                            <div key={pagamento.id} className="flex items-center justify-between text-sm p-2 bg-muted rounded">
                              <span>{format(parseISO(pagamento.mes_referencia), 'MMMM/yyyy', { locale: ptBR })}</span>
                              <span className="font-medium">R$ {pagamento.valor_pago.toFixed(2)}</span>
                            </div>
                          ))}
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            </div>
          )}
        </TabsContent>

        {/* Procedimentos Tab */}
        <TabsContent value="procedimentos" className="space-y-4">
          <div className="flex justify-between items-center">
            <h3 className="font-semibold">Procedimentos de Spa</h3>
            <Dialog open={procedimentoDialogOpen} onOpenChange={(open) => { 
              setProcedimentoDialogOpen(open); 
              if (!open) resetProcedimentoForm(); 
            }}>
              <DialogTrigger asChild>
                <Button size="sm" className="gap-2">
                  <Plus size={16} />
                  Novo Procedimento
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>{editingProcedimento ? 'Editar Procedimento' : 'Novo Procedimento'}</DialogTitle>
                </DialogHeader>
                <div className="space-y-4">
                  <div>
                    <Label>Nome *</Label>
                    <Input
                      value={nomeProcedimento}
                      onChange={(e) => setNomeProcedimento(e.target.value)}
                      placeholder="Ex: Spa Relaxante"
                    />
                  </div>
                  <div>
                    <Label>Descrição</Label>
                    <Input
                      value={descricaoProcedimento}
                      onChange={(e) => setDescricaoProcedimento(e.target.value)}
                      placeholder="Descrição do procedimento..."
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label>Duração (minutos)</Label>
                      <Input
                        type="number"
                        value={duracaoProcedimento}
                        onChange={(e) => setDuracaoProcedimento(e.target.value)}
                        placeholder="Ex: 60"
                      />
                    </div>
                    <div>
                      <Label>Valor (R$)</Label>
                      <Input
                        type="number"
                        step="0.01"
                        value={valorProcedimento}
                        onChange={(e) => setValorProcedimento(e.target.value)}
                        placeholder="Ex: 150.00"
                      />
                    </div>
                  </div>
                  <Button 
                    onClick={editingProcedimento ? handleUpdateProcedimento : handleAddProcedimento} 
                    className="w-full"
                  >
                    {editingProcedimento ? 'Salvar Alterações' : 'Adicionar Procedimento'}
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
          </div>

          {procedimentos.length === 0 ? (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-8">
                <Settings className="h-12 w-12 text-muted-foreground mb-4" />
                <p className="text-muted-foreground">Nenhum procedimento cadastrado.</p>
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-3">
              {procedimentos.map((procedimento) => (
                <Card key={procedimento.id} className={!procedimento.ativo ? 'opacity-60' : ''}>
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <h4 className="font-medium">{procedimento.nome}</h4>
                          {!procedimento.ativo && (
                            <Badge variant="outline" className="text-xs">Inativo</Badge>
                          )}
                        </div>
                        {procedimento.descricao && (
                          <p className="text-sm text-muted-foreground">{procedimento.descricao}</p>
                        )}
                        <div className="flex flex-wrap gap-2 mt-2">
                          {procedimento.duracao_minutos && (
                            <Badge variant="outline">{procedimento.duracao_minutos} min</Badge>
                          )}
                          {procedimento.valor && (
                            <Badge variant="outline">R$ {procedimento.valor.toFixed(2)}</Badge>
                          )}
                        </div>
                      </div>
                      <div className="flex gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleEditProcedimento(procedimento)}
                        >
                          <Edit size={16} />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleToggleProcedimento(procedimento)}
                          title={procedimento.ativo ? 'Desativar' : 'Ativar'}
                        >
                          {procedimento.ativo ? <PowerOff size={16} /> : <Power size={16} />}
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="text-destructive"
                          onClick={() => handleDeleteProcedimento(procedimento.id)}
                        >
                          <Trash2 size={16} />
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>

      {/* Histórico Dialog */}
      <Dialog open={historicoDialogOpen} onOpenChange={setHistoricoDialogOpen}>
        <DialogContent className="max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              Histórico - {historicoAssinatura && getClienteById(historicoAssinatura.cliente_id)?.nome}
            </DialogTitle>
          </DialogHeader>
          {historicoAssinatura && (
            <div className="space-y-4">
              <div>
                <h4 className="font-medium mb-2">Sessões Realizadas</h4>
                {sessoes.filter(s => s.assinatura_id === historicoAssinatura.id && s.realizada).length === 0 ? (
                  <p className="text-sm text-muted-foreground">Nenhuma sessão realizada.</p>
                ) : (
                  <div className="space-y-2 max-h-40 overflow-y-auto">
                    {sessoes
                      .filter(s => s.assinatura_id === historicoAssinatura.id && s.realizada)
                      .map((sessao) => (
                        <div key={sessao.id} className="flex items-center justify-between text-sm p-2 bg-muted rounded">
                          <span>{format(parseISO(sessao.data_sessao), 'dd/MM/yyyy')}</span>
                          {sessao.hora_sessao && <span>{sessao.hora_sessao.slice(0, 5)}</span>}
                        </div>
                      ))}
                  </div>
                )}
              </div>
              <div>
                <h4 className="font-medium mb-2">Pagamentos</h4>
                {pagamentos.filter(p => p.assinatura_id === historicoAssinatura.id).length === 0 ? (
                  <p className="text-sm text-muted-foreground">Nenhum pagamento registrado.</p>
                ) : (
                  <div className="space-y-2 max-h-40 overflow-y-auto">
                    {pagamentos
                      .filter(p => p.assinatura_id === historicoAssinatura.id)
                      .map((pagamento) => (
                        <div key={pagamento.id} className="flex items-center justify-between text-sm p-2 bg-muted rounded">
                          <span>{format(parseISO(pagamento.mes_referencia), 'MMMM/yyyy', { locale: ptBR })}</span>
                          <span className="font-medium">R$ {pagamento.valor_pago.toFixed(2)}</span>
                        </div>
                      ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default SpasTab;
