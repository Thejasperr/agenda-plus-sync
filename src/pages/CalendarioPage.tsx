import React, { useState, useEffect } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Calendar } from '@/components/ui/calendar';
import { Badge } from '@/components/ui/badge';
import { format, isSameDay } from 'date-fns';
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

const CalendarioPage = () => {
  const [agendamentos, setAgendamentos] = useState<Agendamento[]>([]);
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(new Date());

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
      console.error('Erro ao carregar agendamentos:', error);
    }
  };

  useEffect(() => {
    fetchAgendamentos();
  }, []);

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'Agendado':
        return 'bg-blue-500';
      case 'Concluído':
        return 'bg-green-500';
      case 'Cancelado':
        return 'bg-red-500';
      default:
        return 'bg-gray-500';
    }
  };

  const agendamentosDodia = selectedDate
    ? agendamentos.filter(agendamento =>
        isSameDay(new Date(agendamento.data_agendamento), selectedDate)
      )
    : [];

  const hasAgendamentos = (date: Date) => {
    return agendamentos.some(agendamento =>
      isSameDay(new Date(agendamento.data_agendamento), date)
    );
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold">Calendário</h2>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Calendário */}
        <Card>
          <CardContent className="p-6">
            <Calendar
              mode="single"
              selected={selectedDate}
              onSelect={setSelectedDate}
              locale={ptBR}
              modifiers={{
                hasEvent: (date) => hasAgendamentos(date)
              }}
              modifiersStyles={{
                hasEvent: {
                  backgroundColor: 'hsl(var(--primary))',
                  color: 'hsl(var(--primary-foreground))',
                  fontWeight: 'bold'
                }
              }}
              className="rounded-md border"
            />
          </CardContent>
        </Card>

        {/* Agendamentos do dia selecionado */}
        <Card>
          <CardContent className="p-6">
            <h3 className="text-lg font-semibold mb-4">
              {selectedDate 
                ? `Agendamentos de ${format(selectedDate, "dd 'de' MMMM", { locale: ptBR })}`
                : 'Selecione uma data'
              }
            </h3>
            
            {agendamentosDodia.length === 0 ? (
              <p className="text-muted-foreground">
                Nenhum agendamento para esta data.
              </p>
            ) : (
              <div className="space-y-3">
                {agendamentosDodia.map((agendamento) => (
                  <div key={agendamento.id} className="p-3 border rounded-lg">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <span className="font-medium">{agendamento.nome}</span>
                        <Badge 
                          variant="secondary" 
                          className={`${getStatusColor(agendamento.status)} text-white`}
                        >
                          {agendamento.status}
                        </Badge>
                      </div>
                      <span className="text-sm text-muted-foreground">
                        {agendamento.hora_agendamento}
                      </span>
                    </div>
                    
                    <div className="text-sm text-muted-foreground">
                      <p>Telefone: {agendamento.telefone}</p>
                      <p>Preço: R$ {agendamento.preco.toFixed(2)}</p>
                      {agendamento.observacoes && (
                        <p>Obs: {agendamento.observacoes}</p>
                      )}
                    </div>
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

export default CalendarioPage;