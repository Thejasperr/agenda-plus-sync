import React, { useState, useEffect } from 'react';
import { Search, Calendar, DollarSign, Phone } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface Agendamento {
  id: string;
  nome: string;
  telefone: string;
  data_agendamento: string;
  hora_agendamento: string;
  preco: number;
  tem_desconto: boolean;
  porcentagem_desconto: number | null;
  status: string;
  observacoes: string | null;
  procedimento_id: string | null;
  created_at: string;
}

const HistoricoTab = () => {
  const [agendamentos, setAgendamentos] = useState<Agendamento[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  useEffect(() => {
    fetchAgendamentos();
  }, []);

  const fetchAgendamentos = async () => {
    try {
      const { data, error } = await supabase
        .from('agendamentos')
        .select('*')
        .order('data_agendamento', { ascending: false })
        .order('hora_agendamento', { ascending: false });

      if (error) throw error;
      setAgendamentos(data || []);
    } catch (error) {
      console.error('Erro ao buscar histórico:', error);
      toast({
        title: "Erro",
        description: "Não foi possível carregar o histórico",
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

  const calcularPrecoFinal = (preco: number, temDesconto: boolean, porcentagemDesconto: number | null) => {
    if (!temDesconto || !porcentagemDesconto) return preco;
    return preco * (1 - porcentagemDesconto / 100);
  };

  const filteredAgendamentos = agendamentos.filter(agendamento =>
    agendamento.nome.toLowerCase().includes(searchTerm.toLowerCase()) ||
    agendamento.telefone.includes(searchTerm) ||
    agendamento.status.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (agendamento.observacoes && agendamento.observacoes.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-muted-foreground">Carregando histórico...</div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header com busca */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Buscar por nome, telefone, status ou observações..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="pl-10"
        />
      </div>

      {/* Lista de agendamentos */}
      {filteredAgendamentos.length === 0 ? (
        <div className="text-center py-8 text-muted-foreground">
          {searchTerm ? 'Nenhum agendamento encontrado' : 'Nenhum agendamento no histórico'}
        </div>
      ) : (
        <div className="space-y-3">
          {filteredAgendamentos.map((agendamento) => {
            const precoFinal = calcularPrecoFinal(
              agendamento.preco,
              agendamento.tem_desconto,
              agendamento.porcentagem_desconto
            );

            return (
              <Card key={agendamento.id} className="mobile-card">
                <CardContent className="p-4">
                  <div className="space-y-3">
                    {/* Cabeçalho */}
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <h3 className="font-semibold text-foreground">{agendamento.nome}</h3>
                        <div className="flex items-center text-muted-foreground text-sm mt-1">
                          <Phone className="h-3 w-3 mr-1" />
                          <span>{agendamento.telefone}</span>
                        </div>
                      </div>
                      <Badge className={getStatusColor(agendamento.status)}>
                        {agendamento.status}
                      </Badge>
                    </div>

                    {/* Data e Hora */}
                    <div className="flex items-center text-sm text-muted-foreground">
                      <Calendar className="h-3 w-3 mr-1" />
                      <span>
                        {format(new Date(agendamento.data_agendamento), "dd 'de' MMMM 'de' yyyy", { locale: ptBR })} às {agendamento.hora_agendamento}
                      </span>
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
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Resumo */}
      {filteredAgendamentos.length > 0 && (
        <Card className="mobile-card bg-muted/50">
          <CardContent className="p-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="text-center">
                <div className="text-2xl font-bold text-foreground">
                  {filteredAgendamentos.length}
                </div>
                <div className="text-xs text-muted-foreground">Total</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-success">
                  R$ {filteredAgendamentos.reduce((acc, a) => {
                    const preco = calcularPrecoFinal(a.preco, a.tem_desconto, a.porcentagem_desconto);
                    return acc + preco;
                  }, 0).toFixed(2)}
                </div>
                <div className="text-xs text-muted-foreground">Receita</div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default HistoricoTab;