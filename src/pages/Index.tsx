import React, { useState } from 'react';
import { Users, Calendar, Package, Settings, History, TrendingUp } from 'lucide-react';
import ClientesTab from '@/components/app/ClientesTab';
import AgendamentosTab from '@/components/app/AgendamentosTab';
import EstoqueTab from '@/components/app/EstoqueTab';
import ServicosTab from '@/components/app/ServicosTab';
import HistoricoTab from '@/components/app/HistoricoTab';
import TransacoesTab from '@/components/app/TransacoesTab';

type TabType = 'clientes' | 'agendamentos' | 'estoque' | 'servicos' | 'historico' | 'transacoes';

const Index = () => {
  const [activeTab, setActiveTab] = useState<TabType>('agendamentos');

  const tabs = [
    { id: 'clientes' as TabType, label: 'Clientes', icon: Users },
    { id: 'agendamentos' as TabType, label: 'Agenda', icon: Calendar },
    { id: 'historico' as TabType, label: 'Histórico', icon: History },
    { id: 'transacoes' as TabType, label: 'Transações', icon: TrendingUp },
    { id: 'estoque' as TabType, label: 'Estoque', icon: Package },
    { id: 'servicos' as TabType, label: 'Serviços', icon: Settings },
  ];

  const renderTabContent = () => {
    switch (activeTab) {
      case 'clientes':
        return <ClientesTab />;
      case 'agendamentos':
        return <AgendamentosTab />;
      case 'historico':
        return <HistoricoTab />;
      case 'transacoes':
        return <TransacoesTab />;
      case 'estoque':
        return <EstoqueTab />;
      case 'servicos':
        return <ServicosTab />;
      default:
        return <AgendamentosTab />;
    }
  };

  return (
    <div className="mobile-container">
      {/* Header */}
      <div className="mobile-header flex items-center justify-center">
        <h1 className="text-xl font-bold">Agenda Plus</h1>
      </div>

      {/* Content */}
      <div className="mobile-content">
        {renderTabContent()}
      </div>

      {/* Navigation */}
      <div className="mobile-nav flex items-center justify-around">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex flex-col items-center py-2 px-3 rounded-lg transition-colors ${
                isActive 
                  ? 'text-primary bg-primary/10' 
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              <Icon size={20} />
              <span className="text-xs mt-1 font-medium">{tab.label}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
};

export default Index;
