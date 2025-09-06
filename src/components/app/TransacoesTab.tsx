import React, { useState, useEffect } from 'react';
import { Plus, Search, TrendingUp, TrendingDown, DollarSign, Filter, Edit2, Trash2, Calendar } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { format, startOfDay, endOfDay, startOfWeek, endOfWeek, startOfMonth, endOfMonth } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';

interface Transacao {
  id: string;
  tipo: string;
  data_transacao: string;
  tipo_operacao: 'entrada' | 'saida';
  valor: number;
  agendamento_id: string | null;
  observacoes: string | null;
  forma_pagamento: string | null;
  created_at: string;
}

const TransacoesTab = () => {
  const [transacoes, setTransacoes] = useState<Transacao[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [tipoFilter, setTipoFilter] = useState<string>('todos');
  const [operacaoFilter, setOperacaoFilter] = useState<string>('todos');
  const [periodoFilter, setPeriodoFilter] = useState<string>('todos');
  const [dataInicio, setDataInicio] = useState('');
  const [dataFim, setDataFim] = useState('');
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingTransacao, setEditingTransacao] = useState<Transacao | null>(null);
  const [formasPagamento, setFormasPagamento] = useState<{
    id: string;
    nome: string;
    ativa: boolean;
  }[]>([]);
  const [formData, setFormData] = useState({
    tipo: '',
    data_transacao: format(new Date(), 'yyyy-MM-dd'),
    tipo_operacao: 'entrada' as 'entrada' | 'saida',
    valor: '',
    observacoes: '',
    forma_pagamento: ''
  });
  const { toast } = useToast();

  useEffect(() => {
    fetchTransacoes();
    fetchFormasPagamento();
  }, []);

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

  const fetchTransacoes = async () => {
    try {
      const { data, error } = await supabase
        .from('transacoes')
        .select('*')
        .order('data_transacao', { ascending: false })
        .order('created_at', { ascending: false });

      if (error) throw error;
      setTransacoes((data || []) as Transacao[]);
    } catch (error) {
      console.error('Erro ao buscar transações:', error);
      toast({
        title: "Erro",
        description: "Não foi possível carregar as transações",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.tipo || !formData.valor || !formData.data_transacao) {
      toast({
        title: "Erro",
        description: "Preencha todos os campos obrigatórios",
        variant: "destructive",
      });
      return;
    }

    try {
      const transacaoData = {
        ...formData,
        valor: parseFloat(formData.valor)
      };

      if (editingTransacao) {
        const { error } = await supabase
          .from('transacoes')
          .update(transacaoData)
          .eq('id', editingTransacao.id);

        if (error) throw error;

        toast({
          title: "Sucesso",
          description: "Transação atualizada com sucesso!",
        });
      } else {
        const { error } = await supabase
          .from('transacoes')
          .insert([transacaoData]);

        if (error) throw error;

        toast({
          title: "Sucesso",
          description: "Transação adicionada com sucesso!",
        });
      }

      resetForm();
      fetchTransacoes();
    } catch (error) {
      console.error('Erro ao salvar transação:', error);
      toast({
        title: "Erro",
        description: "Não foi possível salvar a transação",
        variant: "destructive",
      });
    }
  };

  const handleEdit = (transacao: Transacao) => {
    setFormData({
      tipo: transacao.tipo,
      data_transacao: transacao.data_transacao,
      tipo_operacao: transacao.tipo_operacao,
      valor: transacao.valor.toString(),
      observacoes: transacao.observacoes || '',
      forma_pagamento: transacao.forma_pagamento || ''
    });
    setEditingTransacao(transacao);
    setDialogOpen(true);
  };

  const handleDelete = async (id: string) => {
    try {
      const { error } = await supabase
        .from('transacoes')
        .delete()
        .eq('id', id);

      if (error) throw error;

      toast({
        title: "Sucesso",
        description: "Transação excluída com sucesso!",
      });

      fetchTransacoes();
    } catch (error) {
      console.error('Erro ao excluir transação:', error);
      toast({
        title: "Erro",
        description: "Não foi possível excluir a transação",
        variant: "destructive",
      });
    }
  };

  const resetForm = () => {
    setFormData({
      tipo: '',
      data_transacao: format(new Date(), 'yyyy-MM-dd'),
      tipo_operacao: 'entrada',
      valor: '',
      observacoes: '',
      forma_pagamento: ''
    });
    setEditingTransacao(null);
    setDialogOpen(false);
  };

  const getOperacaoColor = (operacao: string) => {
    return operacao === 'entrada' 
      ? 'bg-green-500/10 text-green-700 border-green-200'
      : 'bg-red-500/10 text-red-700 border-red-200';
  };

  const getDateRangeForFilter = (filter: string) => {
    const hoje = new Date();
    
    switch (filter) {
      case 'hoje':
        return {
          inicio: format(startOfDay(hoje), 'yyyy-MM-dd'),
          fim: format(endOfDay(hoje), 'yyyy-MM-dd')
        };
      case 'semana':
        return {
          inicio: format(startOfWeek(hoje, { weekStartsOn: 1 }), 'yyyy-MM-dd'),
          fim: format(endOfWeek(hoje, { weekStartsOn: 1 }), 'yyyy-MM-dd')
        };
      case 'mes':
        return {
          inicio: format(startOfMonth(hoje), 'yyyy-MM-dd'),
          fim: format(endOfMonth(hoje), 'yyyy-MM-dd')
        };
      case 'personalizado':
        return {
          inicio: dataInicio,
          fim: dataFim
        };
      default:
        return { inicio: '', fim: '' };
    }
  };

  const filteredTransacoes = transacoes.filter(transacao => {
    const matchesSearch = transacao.tipo.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         (transacao.observacoes && transacao.observacoes.toLowerCase().includes(searchTerm.toLowerCase()));
    
    const matchesTipo = tipoFilter === 'todos' || transacao.tipo === tipoFilter;
    const matchesOperacao = operacaoFilter === 'todos' || transacao.tipo_operacao === operacaoFilter;
    
    // Filtro por período
    let matchesPeriodo = true;
    if (periodoFilter !== 'todos') {
      const { inicio, fim } = getDateRangeForFilter(periodoFilter);
      if (inicio && fim) {
        const transacaoDate = transacao.data_transacao;
        matchesPeriodo = transacaoDate >= inicio && transacaoDate <= fim;
      }
    }
    
    return matchesSearch && matchesTipo && matchesOperacao && matchesPeriodo;
  });

  const totalEntradas = filteredTransacoes
    .filter(t => t.tipo_operacao === 'entrada')
    .reduce((acc, t) => acc + t.valor, 0);

  const totalSaidas = filteredTransacoes
    .filter(t => t.tipo_operacao === 'saida')
    .reduce((acc, t) => acc + t.valor, 0);

  const saldo = totalEntradas - totalSaidas;

  const tiposUnicos = [...new Set(transacoes.map(t => t.tipo))];

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-muted-foreground">Carregando transações...</div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Cards de resumo */}
      <div className="grid grid-cols-3 gap-3">
        <Card className="mobile-card">
          <CardContent className="p-3">
            <div className="flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-green-600" />
              <div>
                <div className="text-xs text-muted-foreground">Entradas</div>
                <div className="font-semibold text-green-600">R$ {totalEntradas.toFixed(2)}</div>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="mobile-card">
          <CardContent className="p-3">
            <div className="flex items-center gap-2">
              <TrendingDown className="h-4 w-4 text-red-600" />
              <div>
                <div className="text-xs text-muted-foreground">Saídas</div>
                <div className="font-semibold text-red-600">R$ {totalSaidas.toFixed(2)}</div>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="mobile-card">
          <CardContent className="p-3">
            <div className="flex items-center gap-2">
              <DollarSign className="h-4 w-4 text-blue-600" />
              <div>
                <div className="text-xs text-muted-foreground">Saldo</div>
                <div className={`font-semibold ${saldo >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                  R$ {saldo.toFixed(2)}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Header com busca e filtros */}
      <div className="space-y-3">
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar transações..."
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
                <Plus className="h-4 w-4" />
                <span className="hidden sm:inline ml-1">Nova</span>
              </Button>
            </DialogTrigger>
            <DialogContent className="w-[90%] max-w-md mx-auto">
              <DialogHeader>
                <DialogTitle>
                  {editingTransacao ? 'Editar Transação' : 'Nova Transação'}
                </DialogTitle>
              </DialogHeader>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <Label htmlFor="tipo">Tipo *</Label>
                  <Input
                    id="tipo"
                    value={formData.tipo}
                    onChange={(e) => setFormData({ ...formData, tipo: e.target.value })}
                    placeholder="Ex: Serviço, Material, Despesa..."
                  />
                </div>
                <div>
                  <Label htmlFor="data_transacao">Data *</Label>
                  <Input
                    id="data_transacao"
                    type="date"
                    value={formData.data_transacao}
                    onChange={(e) => setFormData({ ...formData, data_transacao: e.target.value })}
                  />
                </div>
                <div>
                  <Label htmlFor="tipo_operacao">Tipo de Operação *</Label>
                  <Select value={formData.tipo_operacao} onValueChange={(value: 'entrada' | 'saida') => setFormData({ ...formData, tipo_operacao: value })}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="entrada">Entrada</SelectItem>
                      <SelectItem value="saida">Saída</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label htmlFor="valor">Valor (R$) *</Label>
                  <Input
                    id="valor"
                    type="number"
                    step="0.01"
                    value={formData.valor}
                    onChange={(e) => setFormData({ ...formData, valor: e.target.value })}
                    placeholder="0,00"
                  />
                </div>
                <div>
                  <Label htmlFor="forma_pagamento">Forma de Pagamento</Label>
                  <Select value={formData.forma_pagamento} onValueChange={(value) => setFormData({ ...formData, forma_pagamento: value })}>
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione a forma de pagamento" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="">Não informado</SelectItem>
                      {formasPagamento.map((forma) => (
                        <SelectItem key={forma.id} value={forma.nome}>{forma.nome}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label htmlFor="observacoes">Observações</Label>
                  <Textarea
                    id="observacoes"
                    value={formData.observacoes}
                    onChange={(e) => setFormData({ ...formData, observacoes: e.target.value })}
                    placeholder="Observações adicionais..."
                  />
                </div>
                <div className="flex gap-2 pt-2">
                  <Button type="button" variant="outline" onClick={resetForm} className="flex-1">
                    Cancelar
                  </Button>
                  <Button type="submit" className="mobile-button flex-1">
                    {editingTransacao ? 'Atualizar' : 'Salvar'}
                  </Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>
        </div>

        {/* Filtros */}
        <div className="flex flex-col sm:flex-row gap-2">
          <Select value={periodoFilter} onValueChange={setPeriodoFilter}>
            <SelectTrigger className="w-full sm:w-40">
              <SelectValue placeholder="Período" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todos</SelectItem>
              <SelectItem value="hoje">Hoje</SelectItem>
              <SelectItem value="semana">Esta semana</SelectItem>
              <SelectItem value="mes">Este mês</SelectItem>
              <SelectItem value="personalizado">Personalizado</SelectItem>
            </SelectContent>
          </Select>

          {periodoFilter === 'personalizado' && (
            <>
              <Input
                type="date"
                value={dataInicio}
                onChange={(e) => setDataInicio(e.target.value)}
                className="w-full sm:w-32"
                placeholder="Data início"
              />
              <Input
                type="date"
                value={dataFim}
                onChange={(e) => setDataFim(e.target.value)}
                className="w-full sm:w-32"
                placeholder="Data fim"
              />
            </>
          )}

          <Select value={operacaoFilter} onValueChange={setOperacaoFilter}>
            <SelectTrigger className="w-full sm:w-32">
              <SelectValue placeholder="Operação" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todas</SelectItem>
              <SelectItem value="entrada">Entradas</SelectItem>
              <SelectItem value="saida">Saídas</SelectItem>
            </SelectContent>
          </Select>

          <Select value={tipoFilter} onValueChange={setTipoFilter}>
            <SelectTrigger className="w-full sm:w-32">
              <SelectValue placeholder="Tipo" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todos</SelectItem>
              {tiposUnicos.map((tipo) => (
                <SelectItem key={tipo} value={tipo}>{tipo}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Lista de transações */}
      {filteredTransacoes.length === 0 ? (
        <div className="text-center py-8 text-muted-foreground">
          {searchTerm ? 'Nenhuma transação encontrada' : 'Nenhuma transação cadastrada'}
        </div>
      ) : (
        <div className="space-y-3">
          {filteredTransacoes.map((transacao) => (
            <Card key={transacao.id} className="mobile-card">
              <CardContent className="p-4">
                <div className="space-y-3">
                  {/* Cabeçalho */}
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <h3 className="font-semibold text-foreground">{transacao.tipo}</h3>
                        <Badge className={getOperacaoColor(transacao.tipo_operacao)}>
                          {transacao.tipo_operacao === 'entrada' ? (
                            <TrendingUp className="h-3 w-3 mr-1" />
                          ) : (
                            <TrendingDown className="h-3 w-3 mr-1" />
                          )}
                          {transacao.tipo_operacao}
                        </Badge>
                      </div>
                      <div className="text-sm text-muted-foreground mt-1">
                        {format(new Date(transacao.data_transacao + 'T12:00:00'), "dd 'de' MMMM 'de' yyyy", { locale: ptBR })}
                      </div>
                    </div>
                    <div className={`text-lg font-bold ${
                      transacao.tipo_operacao === 'entrada' ? 'text-green-600' : 'text-red-600'
                    }`}>
                      {transacao.tipo_operacao === 'entrada' ? '+' : '-'}R$ {transacao.valor.toFixed(2)}
                    </div>
                  </div>

                  {/* Observações */}
                  {transacao.observacoes && (
                    <div className="text-xs text-muted-foreground bg-muted/50 p-2 rounded">
                      <strong>Obs:</strong> {transacao.observacoes}
                    </div>
                  )}

                  {/* Forma de pagamento */}
                  {transacao.forma_pagamento && (
                    <div className="text-xs text-blue-600 bg-blue-50 p-2 rounded">
                      <strong>Pagamento:</strong> {transacao.forma_pagamento}
                    </div>
                  )}

                  {/* Ações */}
                  <div className="flex gap-2 pt-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleEdit(transacao)}
                      className="flex-1"
                    >
                      <Edit2 className="h-3 w-3" />
                      <span className="hidden sm:inline ml-1">Editar</span>
                    </Button>
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button variant="outline" size="sm" className="flex-1 text-red-600 hover:text-red-700">
                          <Trash2 className="h-3 w-3" />
                          <span className="hidden sm:inline ml-1">Excluir</span>
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Confirmar exclusão</AlertDialogTitle>
                          <AlertDialogDescription>
                            Tem certeza que deseja excluir esta transação? Esta ação não pode ser desfeita.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancelar</AlertDialogCancel>
                          <AlertDialogAction onClick={() => handleDelete(transacao.id)}>
                            Excluir
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </div>
                  
                  {transacao.agendamento_id && (
                    <div className="text-xs text-blue-600 bg-blue-50 p-2 rounded">
                      <strong>Transação automática:</strong> Gerada por agendamento concluído
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
};

export default TransacoesTab;