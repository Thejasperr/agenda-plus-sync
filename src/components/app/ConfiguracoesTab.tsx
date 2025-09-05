import React, { useState } from 'react';
import { Settings, Clock, Wrench, Download } from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import ServicosTab from './ServicosTab';
import HorariosTab from './HorariosTab';
import FormasPagamentoTab from './FormasPagamentoTab';
import { supabase } from '@/integrations/supabase/client';
import * as XLSX from 'xlsx';

const ConfiguracoesTab = () => {
  const [activeTab, setActiveTab] = useState('servicos');
  const [exporting, setExporting] = useState(false);
  const { toast } = useToast();

  const exportToExcel = async () => {
    try {
      setExporting(true);

      // Buscar dados dos clientes
      const { data: clientes, error: clientesError } = await supabase
        .from('clientes')
        .select('*')
        .order('nome');

      if (clientesError) throw clientesError;

      // Buscar dados das transações
      const { data: transacoes, error: transacoesError } = await supabase
        .from('transacoes')
        .select('*')
        .order('data_transacao', { ascending: false });

      if (transacoesError) throw transacoesError;

      // Buscar dados dos agendamentos
      const { data: agendamentos, error: agendamentosError } = await supabase
        .from('agendamentos')
        .select('*')
        .order('data_agendamento', { ascending: false });

      if (agendamentosError) throw agendamentosError;

      // Criar workbook
      const workbook = XLSX.utils.book_new();

      // Planilha de Clientes
      const clientesWS = XLSX.utils.json_to_sheet(
        clientes?.map(cliente => ({
          'Nome': cliente.nome,
          'Telefone': cliente.telefone,
          'Status': cliente.status || 'Ativo',
          'Último Atendimento': cliente.ultimo_atendimento ? new Date(cliente.ultimo_atendimento).toLocaleDateString('pt-BR') : '',
          'Data de Cadastro': new Date(cliente.created_at).toLocaleDateString('pt-BR')
        })) || []
      );
      XLSX.utils.book_append_sheet(workbook, clientesWS, 'Clientes');

      // Planilha de Transações
      const transacoesWS = XLSX.utils.json_to_sheet(
        transacoes?.map(transacao => ({
          'Data': new Date(transacao.data_transacao).toLocaleDateString('pt-BR'),
          'Tipo': transacao.tipo,
          'Operação': transacao.tipo_operacao === 'entrada' ? 'Entrada' : 'Saída',
          'Valor': transacao.valor,
          'Observações': transacao.observacoes || '',
          'Data de Criação': new Date(transacao.created_at).toLocaleDateString('pt-BR')
        })) || []
      );
      XLSX.utils.book_append_sheet(workbook, transacoesWS, 'Transações');

      // Planilha de Agendamentos
      const agendamentosWS = XLSX.utils.json_to_sheet(
        agendamentos?.map(agendamento => ({
          'Nome': agendamento.nome,
          'Telefone': agendamento.telefone,
          'Data': new Date(agendamento.data_agendamento).toLocaleDateString('pt-BR'),
          'Hora': agendamento.hora_agendamento,
          'Preço': agendamento.preco,
          'Status': agendamento.status,
          'Tem Desconto': agendamento.tem_desconto ? 'Sim' : 'Não',
          'Porcentagem Desconto': agendamento.porcentagem_desconto || 0,
          'Observações': agendamento.observacoes || '',
          'Data de Criação': new Date(agendamento.created_at).toLocaleDateString('pt-BR')
        })) || []
      );
      XLSX.utils.book_append_sheet(workbook, agendamentosWS, 'Agendamentos');

      // Gerar e baixar arquivo
      const fileName = `backup_dados_${new Date().toISOString().split('T')[0]}.xlsx`;
      XLSX.writeFile(workbook, fileName);

      toast({
        title: "Sucesso",
        description: "Dados exportados com sucesso!",
      });

    } catch (error) {
      console.error('Erro ao exportar dados:', error);
      toast({
        title: "Erro",
        description: "Não foi possível exportar os dados",
        variant: "destructive",
      });
    } finally {
      setExporting(false);
    }
  };

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold">Configurações</h2>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="servicos" className="flex items-center gap-2">
            <Wrench className="h-4 w-4" />
            Serviços
          </TabsTrigger>
          <TabsTrigger value="horarios" className="flex items-center gap-2">
            <Clock className="h-4 w-4" />
            Horários
          </TabsTrigger>
          <TabsTrigger value="pagamentos" className="flex items-center gap-2">
            <Settings className="h-4 w-4" />
            Pagamentos
          </TabsTrigger>
        </TabsList>

        <TabsContent value="servicos">
          <ServicosTab />
        </TabsContent>

        <TabsContent value="horarios">
          <HorariosTab />
        </TabsContent>

        <TabsContent value="pagamentos">
          <FormasPagamentoTab />
        </TabsContent>
      </Tabs>

      {/* Opção de exportar dados */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Download className="h-5 w-5" />
            Exportar Dados
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground mb-4">
            Exporte um backup completo de todos os seus dados (clientes, agendamentos e financeiro) em formato Excel.
          </p>
          <Button 
            onClick={exportToExcel} 
            disabled={exporting}
            className="w-full md:w-auto"
          >
            <Download className="h-4 w-4 mr-2" />
            {exporting ? 'Exportando...' : 'Exportar Planilha Excel'}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
};

export default ConfiguracoesTab;