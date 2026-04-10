import React, { useState } from 'react';
import { Settings, Clock, Wrench, Download, QrCode, Package } from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import ServicosTab from './ServicosTab';
import HorariosTab from './HorariosTab';
import FormasPagamentoTab from './FormasPagamentoTab';
import ConfiguracaoPixTab from './ConfiguracaoPixTab';
import PacotesTab from './PacotesTab';
import { supabase } from '@/integrations/supabase/client';
import * as XLSX from 'xlsx';

const ConfiguracoesTab = () => {
  const [activeTab, setActiveTab] = useState('servicos');
  const [exporting, setExporting] = useState(false);
  const { toast } = useToast();

  const exportToExcel = async () => {
    try {
      setExporting(true);

      const { data: clientes, error: clientesError } = await supabase
        .from('clientes')
        .select('*')
        .order('nome');

      if (clientesError) throw clientesError;

      const { data: transacoes, error: transacoesError } = await supabase
        .from('transacoes')
        .select('*')
        .order('data_transacao', { ascending: false });

      if (transacoesError) throw transacoesError;

      const { data: agendamentos, error: agendamentosError } = await supabase
        .from('agendamentos')
        .select('*')
        .order('data_agendamento', { ascending: false });

      if (agendamentosError) throw agendamentosError;

      const workbook = XLSX.utils.book_new();

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

      const fileName = `backup_dados_${new Date().toISOString().split('T')[0]}.xlsx`;
      XLSX.writeFile(workbook, fileName);

      toast({ title: "Sucesso", description: "Dados exportados com sucesso!" });
    } catch (error) {
      console.error('Erro ao exportar dados:', error);
      toast({ title: "Erro", description: "Não foi possível exportar os dados", variant: "destructive" });
    } finally {
      setExporting(false);
    }
  };

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold">Configurações</h2>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-5">
          <TabsTrigger value="servicos" className="flex items-center gap-1 text-xs sm:text-sm">
            <Wrench className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Serviços</span>
          </TabsTrigger>
          <TabsTrigger value="pacotes" className="flex items-center gap-1 text-xs sm:text-sm">
            <Package className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Pacotes</span>
          </TabsTrigger>
          <TabsTrigger value="horarios" className="flex items-center gap-1 text-xs sm:text-sm">
            <Clock className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Horários</span>
          </TabsTrigger>
          <TabsTrigger value="pagamentos" className="flex items-center gap-1 text-xs sm:text-sm">
            <Settings className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Pagam.</span>
          </TabsTrigger>
          <TabsTrigger value="pix" className="flex items-center gap-1 text-xs sm:text-sm">
            <QrCode className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">PIX</span>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="servicos">
          <ServicosTab />
        </TabsContent>

        <TabsContent value="pacotes">
          <PacotesTab />
        </TabsContent>

        <TabsContent value="horarios">
          <HorariosTab />
        </TabsContent>

        <TabsContent value="pagamentos">
          <FormasPagamentoTab />
        </TabsContent>

        <TabsContent value="pix">
          <ConfiguracaoPixTab />
        </TabsContent>
      </Tabs>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Download className="h-5 w-5" />
            Exportar Dados
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground mb-4">
            Exporte um backup completo de todos os seus dados em formato Excel.
          </p>
          <Button onClick={exportToExcel} disabled={exporting} className="w-full md:w-auto">
            <Download className="h-4 w-4 mr-2" />
            {exporting ? 'Exportando...' : 'Exportar Planilha Excel'}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
};

export default ConfiguracoesTab;
