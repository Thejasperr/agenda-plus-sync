import React, { useState } from 'react';
import { Settings, Clock, Wrench, Download, QrCode, Package, Megaphone, Sparkles, Plug, CreditCard, LayoutGrid, Database } from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import ServicosTab from './ServicosTab';
import HorariosTab from './HorariosTab';
import FormasPagamentoTab from './FormasPagamentoTab';
import ConfiguracaoPixTab from './ConfiguracaoPixTab';
import PacotesTab from './PacotesTab';
import DisparosMassaTab from './DisparosMassaTab';
import TransacoesTab from './TransacoesTab';
import GruposConfigTab from './GruposConfigTab';
import EvolutionConfigTab from './EvolutionConfigTab';
import { supabase } from '@/integrations/supabase/client';
import * as XLSX from 'xlsx';
import { useIsMobile } from '@/hooks/use-mobile';

const ConfiguracoesTab = () => {
  const [activeTab, setActiveTab] = useState('servicos');
  const [exporting, setExporting] = useState(false);
  const { toast } = useToast();
  const isMobile = useIsMobile();

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

  const menuItems = [
    { id: 'servicos', label: 'Serviços', icon: Wrench, category: 'Cadastro' },
    { id: 'pacotes', label: 'Pacotes', icon: Package, category: 'Cadastro' },
    { id: 'horarios', label: 'Horários', icon: Clock, category: 'Agendamento' },
    { id: 'evolution', label: 'WhatsApp (Evolution)', icon: Plug, category: 'Integrações' },
    { id: 'disparos', label: 'Mensagens em Massa', icon: Megaphone, category: 'Marketing' },
    { id: 'grupos', label: 'Grupos WhatsApp', icon: Sparkles, category: 'Marketing' },
    { id: 'pagamentos', label: 'Formas de Pagamento', icon: CreditCard, category: 'Financeiro' },
    { id: 'caixa', label: 'Fluxo de Caixa', icon: TrendingUp, category: 'Financeiro' },
    { id: 'pix', label: 'Configuração PIX', icon: QrCode, category: 'Financeiro' },
    { id: 'backup', label: 'Backup e Exportação', icon: Database, category: 'Sistema' },
  ];

  const categories = Array.from(new Set(menuItems.map(item => item.category)));

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-1">
        <h2 className="text-2xl font-bold tracking-tight">Configurações</h2>
        <p className="text-muted-foreground">Gerencie os parâmetros do seu sistema em um só lugar.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Menu Lateral Estilizado */}
        <div className="lg:col-span-1 space-y-4">
          <Card className="p-2">
            <nav className="space-y-1">
              {categories.map(category => (
                <div key={category} className="py-2">
                  <h3 className="px-3 text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-1">
                    {category}
                  </h3>
                  {menuItems.filter(item => item.category === category).map((item) => (
                    <button
                      key={item.id}
                      onClick={() => setActiveTab(item.id)}
                      className={`w-full flex items-center gap-3 px-3 py-2 text-sm font-medium rounded-md transition-all ${
                        activeTab === item.id 
                        ? 'bg-primary text-primary-foreground shadow-sm' 
                        : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                      }`}
                    >
                      <item.icon className={`h-4 w-4 ${activeTab === item.id ? 'text-primary-foreground' : 'text-muted-foreground'}`} />
                      {item.label}
                    </button>
                  ))}
                </div>
              ))}
            </nav>
          </Card>
        </div>

        {/* Conteúdo Central */}
        <div className="lg:col-span-3">
          <Card className="min-h-[500px]">
            <CardHeader className="border-b bg-muted/20 pb-4">
              <div className="flex items-center gap-2">
                {(() => {
                  const Icon = menuItems.find(i => i.id === activeTab)?.icon || Settings;
                  return <Icon className="h-5 w-5 text-primary" />;
                })()}
                <div>
                  <CardTitle className="text-lg">
                    {menuItems.find(i => i.id === activeTab)?.label}
                  </CardTitle>
                  <CardDescription>
                    {activeTab === 'servicos' && 'Gerencie os procedimentos oferecidos.'}
                    {activeTab === 'pacotes' && 'Configure combos e pacotes promocionais.'}
                    {activeTab === 'horarios' && 'Defina seus horários de atendimento.'}
                    {activeTab === 'evolution' && 'Configure sua API do WhatsApp.'}
                    {activeTab === 'disparos' && 'Crie campanhas de mensagens.'}
                    {activeTab === 'grupos' && 'Gerencie disparos para grupos.'}
                    {activeTab === 'pagamentos' && 'Configure métodos aceitos.'}
                    {activeTab === 'caixa' && 'Gerencie o fluxo de caixa e transações.'}
                    {activeTab === 'pix' && 'Configure as chaves para recebimento.'}
                    {activeTab === 'backup' && 'Exporte seus dados para segurança.'}
                  </CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="pt-6">
              {activeTab === 'servicos' && <ServicosTab />}
              {activeTab === 'pacotes' && <PacotesTab />}
              {activeTab === 'horarios' && <HorariosTab />}
              {activeTab === 'evolution' && <EvolutionConfigTab />}
              {activeTab === 'disparos' && <DisparosMassaTab />}
              {activeTab === 'grupos' && <GruposConfigTab />}
              {activeTab === 'pagamentos' && <FormasPagamentoTab />}
              {activeTab === 'caixa' && <TransacoesTab />}
              {activeTab === 'pix' && <ConfiguracaoPixTab />}
              {activeTab === 'backup' && (
                <div className="space-y-4">
                  <div className="p-4 border rounded-lg bg-muted/30">
                    <div className="flex items-start gap-4">
                      <div className="p-2 bg-primary/10 rounded-full">
                        <Download className="h-6 w-6 text-primary" />
                      </div>
                      <div className="space-y-1">
                        <h4 className="font-medium text-sm">Exportar todos os dados</h4>
                        <p className="text-xs text-muted-foreground">
                          Gera uma planilha Excel contendo Clientes, Agendamentos e Transações Financeiras.
                        </p>
                      </div>
                    </div>
                    <Button 
                      onClick={exportToExcel} 
                      disabled={exporting} 
                      className="w-full mt-4"
                    >
                      {exporting ? 'Exportando...' : 'Fazer Download do Backup (.xlsx)'}
                    </Button>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default ConfiguracoesTab;
