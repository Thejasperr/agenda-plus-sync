import React, { useState, useEffect } from 'react';
import { Users, Calendar, DollarSign, TrendingUp, TrendingDown, CalendarCheck, CalendarClock } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { format, startOfWeek, endOfWeek, startOfMonth, endOfMonth, addDays, isSameDay } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { useToast } from '@/hooks/use-toast';

interface Agendamento {
  id: string;
  nome: string;
  telefone: string;
  preco: number;
  data_agendamento: string;
  hora_agendamento: string;
  status: string;
}

interface Transacao {
  id: string;
  tipo: string;
  tipo_operacao: 'entrada' | 'saida';
  valor: number;
  data_transacao: string;
}

const DashboardTab = () => {
  const [totalClientes, setTotalClientes] = useState(0);
  const [agendamentosHoje, setAgendamentosHoje] = useState<Agendamento[]>([]);
  const [agendamentosAmanha, setAgendamentosAmanha] = useState<Agendamento[]>([]);
  const [receitaMes, setReceitaMes] = useState(0);
  const [receitaSemana, setReceitaSemana] = useState(0);
  const [entradasSemana, setEntradasSemana] = useState(0);
  const [saidasSemana, setSaidasSemana] = useState(0);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const fetchDashboardData = async () => {
    try {
      const hoje = format(new Date(), 'yyyy-MM-dd');
      const amanha = format(addDays(new Date(), 1), 'yyyy-MM-dd');
      const inicioSemana = format(startOfWeek(new Date(), { weekStartsOn: 1 }), 'yyyy-MM-dd');
      const fimSemana = format(endOfWeek(new Date(), { weekStartsOn: 1 }), 'yyyy-MM-dd');
      const inicioMes = format(startOfMonth(new Date()), 'yyyy-MM-dd');
      const fimMes = format(endOfMonth(new Date()), 'yyyy-MM-dd');

      // Total de clientes
      const { data: clientes, error: clientesError } = await supabase
        .from('clientes')
        .select('id');
      
      if (clientesError) throw clientesError;
      setTotalClientes(clientes?.length || 0);

      // Agendamentos de hoje
      const { data: agendHoje, error: agendHojeError } = await supabase
        .from('agendamentos')
        .select('*')
        .eq('data_agendamento', hoje)
        .order('hora_agendamento');
      
      if (agendHojeError) throw agendHojeError;
      setAgendamentosHoje((agendHoje as Agendamento[]) || []);

      // Agendamentos de amanhã
      const { data: agendAmanha, error: agendAmanhaError } = await supabase
        .from('agendamentos')
        .select('*')
        .eq('data_agendamento', amanha)
        .order('hora_agendamento');
      
      if (agendAmanhaError) throw agendAmanhaError;
      setAgendamentosAmanha((agendAmanha as Agendamento[]) || []);

      // Transações da semana
      const { data: transacoesSemana, error: transacoesSemanaError } = await supabase
        .from('transacoes')
        .select('*')
        .gte('data_transacao', inicioSemana)
        .lte('data_transacao', fimSemana);
      
      if (transacoesSemanaError) throw transacoesSemanaError;
      
      const entradas = (transacoesSemana as Transacao[])?.filter(t => t.tipo_operacao === 'entrada').reduce((acc, t) => acc + t.valor, 0) || 0;
      const saidas = (transacoesSemana as Transacao[])?.filter(t => t.tipo_operacao === 'saida').reduce((acc, t) => acc + t.valor, 0) || 0;
      
      setEntradasSemana(entradas);
      setSaidasSemana(saidas);
      setReceitaSemana(entradas - saidas);

      // Receita do mês
      const { data: transacoesMes, error: transacoesMesError } = await supabase
        .from('transacoes')
        .select('*')
        .eq('tipo_operacao', 'entrada')
        .gte('data_transacao', inicioMes)
        .lte('data_transacao', fimMes);
      
      if (transacoesMesError) throw transacoesMesError;
      
      const receitaMensal = (transacoesMes as Transacao[])?.reduce((acc, t) => acc + t.valor, 0) || 0;
      setReceitaMes(receitaMensal);

    } catch (error) {
      console.error('Erro ao carregar dados do dashboard:', error);
      toast({
        title: "Erro",
        description: "Não foi possível carregar os dados do dashboard",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
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

      fetchDashboardData();
    } catch (error) {
      console.error('Erro ao atualizar status:', error);
      toast({
        title: "Erro",
        description: "Não foi possível atualizar o status",
        variant: "destructive",
      });
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-muted-foreground">Carregando dashboard...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold">Dashboard</h2>

      {/* Cards de métricas principais */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <Users className="h-8 w-8 text-blue-600" />
              <div>
                <div className="text-2xl font-bold">{totalClientes}</div>
                <div className="text-sm text-muted-foreground">Clientes</div>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <Calendar className="h-8 w-8 text-green-600" />
              <div>
                <div className="text-2xl font-bold">{agendamentosHoje.length}</div>
                <div className="text-sm text-muted-foreground">Hoje</div>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <DollarSign className="h-8 w-8 text-purple-600" />
              <div>
                <div className="text-2xl font-bold">R$ {receitaMes.toFixed(0)}</div>
                <div className="text-sm text-muted-foreground">Mês</div>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <TrendingUp className="h-8 w-8 text-orange-600" />
              <div>
                <div className="text-2xl font-bold">R$ {receitaSemana.toFixed(0)}</div>
                <div className="text-sm text-muted-foreground">Semana</div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Resumo financeiro da semana */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5" />
            Resumo Financeiro da Semana
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-3 gap-4">
            <div className="text-center">
              <div className="text-2xl font-bold text-green-600">R$ {entradasSemana.toFixed(2)}</div>
              <div className="text-sm text-muted-foreground">Entradas</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-red-600">R$ {saidasSemana.toFixed(2)}</div>
              <div className="text-sm text-muted-foreground">Saídas</div>
            </div>
            <div className="text-center">
              <div className={`text-2xl font-bold ${receitaSemana >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                R$ {receitaSemana.toFixed(2)}
              </div>
              <div className="text-sm text-muted-foreground">Saldo</div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Agendamentos lado a lado */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Agendamentos de hoje */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CalendarCheck className="h-5 w-5" />
              Agendamentos de Hoje
            </CardTitle>
          </CardHeader>
          <CardContent>
            {agendamentosHoje.length === 0 ? (
              <div className="text-center py-4 text-muted-foreground">
                Nenhum agendamento para hoje
              </div>
            ) : (
              <div className="space-y-3">
                {agendamentosHoje.map((agendamento) => (
                  <div key={agendamento.id} className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                    <div className="flex-1">
                      <div className="font-medium">{agendamento.nome}</div>
                      <div className="text-sm text-muted-foreground">
                        {agendamento.hora_agendamento.substring(0, 5)} - R$ {agendamento.preco.toFixed(2)}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge className={getStatusColor(agendamento.status)}>
                        {agendamento.status}
                      </Badge>
                      {agendamento.status === 'Agendado' && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => updateAgendamentoStatus(agendamento.id, 'Concluído')}
                        >
                          Concluir
                        </Button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Agendamentos de amanhã */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CalendarClock className="h-5 w-5" />
              Agendamentos de Amanhã
            </CardTitle>
          </CardHeader>
          <CardContent>
            {agendamentosAmanha.length === 0 ? (
              <div className="text-center py-4 text-muted-foreground">
                Nenhum agendamento para amanhã
              </div>
            ) : (
              <div className="space-y-3">
                {agendamentosAmanha.map((agendamento) => (
                  <div key={agendamento.id} className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                    <div className="flex-1">
                      <div className="font-medium">{agendamento.nome}</div>
                      <div className="text-sm text-muted-foreground">
                        {agendamento.hora_agendamento.substring(0, 5)} - R$ {agendamento.preco.toFixed(2)}
                      </div>
                    </div>
                    <Badge className={getStatusColor(agendamento.status)}>
                      {agendamento.status}
                    </Badge>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default DashboardTab;