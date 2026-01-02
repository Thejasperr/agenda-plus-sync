import React, { useState } from 'react';
import { Users, Settings, TrendingUp, CalendarDays, Menu, LogOut, User, BarChart3, Footprints } from 'lucide-react';
import ClientesTab from '@/components/app/ClientesTab';
import CalendarioPage from '@/pages/CalendarioPage';
import ConfiguracoesTab from '@/components/app/ConfiguracoesTab';
import TransacoesTab from '@/components/app/TransacoesTab';
import DashboardTab from '@/components/app/DashboardTab';
import SpasTab from '@/components/app/SpasTab';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';

type TabType = 'dashboard' | 'clientes' | 'calendario' | 'transacoes' | 'spas' | 'configuracoes';

const Index = () => {
  const [activeTab, setActiveTab] = useState<TabType>('dashboard');
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
    { id: 'dashboard' as TabType, label: 'Dashboard', icon: BarChart3 },
    { id: 'clientes' as TabType, label: 'Clientes', icon: Users },
    { id: 'calendario' as TabType, label: 'Calendário', icon: CalendarDays },
    { id: 'transacoes' as TabType, label: 'Transações', icon: TrendingUp },
    { id: 'spas' as TabType, label: 'Spa', icon: Footprints },
    { id: 'configuracoes' as TabType, label: 'Config', icon: Settings },
  ];

  const renderTabContent = () => {
    switch (activeTab) {
      case 'dashboard':
        return <DashboardTab />;
      case 'clientes':
        return <ClientesTab />;
      case 'calendario':
        return <CalendarioPage />;
      case 'transacoes':
        return <TransacoesTab />;
      case 'spas':
        return <SpasTab />;
      case 'configuracoes':
        return <ConfiguracoesTab />;
      default:
        return <DashboardTab />;
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
        {/* Mobile: todas as 5 abas */}
        <div className="flex md:hidden items-center justify-around h-full">
          {tabs.map((tab) => {
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
