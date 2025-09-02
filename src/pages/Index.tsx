import React, { useState } from 'react';
import { Users, Calendar, Package, Settings, History, TrendingUp, CalendarDays, Menu, LogOut, User } from 'lucide-react';
import ClientesTab from '@/components/app/ClientesTab';
import AgendamentosTab from '@/components/app/AgendamentosTab';
import CalendarioPage from '@/pages/CalendarioPage';
import EstoqueTab from '@/components/app/EstoqueTab';
import ServicosTab from '@/components/app/ServicosTab';
import HistoricoTab from '@/components/app/HistoricoTab';
import TransacoesTab from '@/components/app/TransacoesTab';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';

type TabType = 'clientes' | 'agendamentos' | 'calendario' | 'estoque' | 'servicos' | 'historico' | 'transacoes';

const Index = () => {
  const [activeTab, setActiveTab] = useState<TabType>('agendamentos');
  const [showMobileMenu, setShowMobileMenu] = useState(false);
  const { user, signOut } = useAuth();
  const { toast } = useToast();

  const handleSignOut = async () => {
    try {
      await signOut();
      toast({
        title: "Logout realizado",
        description: "Você foi desconectado com sucesso.",
      });
    } catch (error) {
      toast({
        title: "Erro",
        description: "Erro ao fazer logout.",
        variant: "destructive",
      });
    }
  };

  const tabs = [
    { id: 'clientes' as TabType, label: 'Clientes', icon: Users },
    { id: 'agendamentos' as TabType, label: 'Agenda', icon: Calendar },
    { id: 'calendario' as TabType, label: 'Calendário', icon: CalendarDays },
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
      case 'calendario':
        return <CalendarioPage />;
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
      <div className="mobile-header flex items-center justify-between px-4">
        <h1 className="text-xl font-bold">Espaço Gabriela Aimola</h1>
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <User size={16} />
            <span className="hidden sm:inline">{user?.email}</span>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={handleSignOut}
            className="text-muted-foreground hover:text-destructive"
          >
            <LogOut size={16} />
            <span className="hidden sm:ml-2 sm:inline">Sair</span>
          </Button>
        </div>
      </div>

      {/* Content */}
      <div className="mobile-content">
        {renderTabContent()}
      </div>

      {/* Navigation */}
      <div className="mobile-nav">
        {/* Mobile: 4 principais + hamburguer */}
        <div className="flex md:hidden items-center justify-around h-full">
          {tabs.slice(0, 4).map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex flex-col items-center py-2 px-1 rounded-lg transition-colors ${
                  isActive 
                    ? 'text-primary bg-primary/10' 
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                <Icon size={18} />
                <span className="text-xs mt-1 font-medium">{tab.label}</span>
              </button>
            );
          })}
          
          {/* Menu hamburguer */}
          <div className="relative">
            <button
              onClick={() => setShowMobileMenu(!showMobileMenu)}
              className="flex flex-col items-center py-2 px-1 rounded-lg transition-colors text-muted-foreground hover:text-foreground"
            >
              <Menu size={18} />
              <span className="text-xs mt-1 font-medium">Mais</span>
            </button>
            
            {showMobileMenu && (
              <div className="absolute bottom-full mb-2 right-0 bg-background border rounded-lg shadow-lg p-2 min-w-[120px]">
                {tabs.slice(4).map((tab) => {
                  const Icon = tab.icon;
                  const isActive = activeTab === tab.id;
                  
                  return (
                    <button
                      key={tab.id}
                      onClick={() => {
                        setActiveTab(tab.id);
                        setShowMobileMenu(false);
                      }}
                      className={`w-full flex items-center gap-2 py-2 px-3 rounded transition-colors ${
                        isActive 
                          ? 'text-primary bg-primary/10' 
                          : 'text-muted-foreground hover:text-foreground'
                      }`}
                    >
                      <Icon size={16} />
                      <span className="text-sm">{tab.label}</span>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Desktop: todos os itens */}
        <div className="hidden md:flex items-center justify-around h-full">
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
    </div>
  );
};

export default Index;
