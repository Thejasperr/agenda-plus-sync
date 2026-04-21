import React, { useEffect, useState } from 'react';
import { Users, Settings, TrendingUp, CalendarDays, LogOut, User, BarChart3, MessageCircle } from 'lucide-react';
import ClientesTab from '@/components/app/ClientesTab';
import CalendarioPage from '@/pages/CalendarioPage';
import ConfiguracoesTab from '@/components/app/ConfiguracoesTab';
import TransacoesTab from '@/components/app/TransacoesTab';
import DashboardTab from '@/components/app/DashboardTab';
import WhatsAppPage from '@/pages/WhatsAppPage';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';

type TabType = 'dashboard' | 'calendario' | 'whatsapp' | 'clientes' | 'transacoes' | 'configuracoes';

const Index = () => {
  const [activeTab, setActiveTab] = useState<TabType>('dashboard');
  const { user, signOut } = useAuth();
  const { toast } = useToast();

  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      if (detail?.tab) setActiveTab(detail.tab as TabType);
    };
    window.addEventListener('app:navigate', handler);
    return () => window.removeEventListener('app:navigate', handler);
  }, []);

  const handleSignOut = async () => {
    try {
      await signOut();
      toast({ title: "Logout realizado", description: "Você foi desconectado com sucesso." });
    } catch (error) {
      toast({ title: "Erro", description: "Erro ao fazer logout.", variant: "destructive" });
    }
  };

  const tabs = [
    { id: 'dashboard' as TabType, label: 'Início', icon: BarChart3 },
    { id: 'calendario' as TabType, label: 'Agenda', icon: CalendarDays },
    { id: 'whatsapp' as TabType, label: 'WhatsApp', icon: MessageCircle },
    { id: 'clientes' as TabType, label: 'Clientes', icon: Users },
    { id: 'transacoes' as TabType, label: 'Caixa', icon: TrendingUp },
    { id: 'configuracoes' as TabType, label: 'Config', icon: Settings },
  ];

  return (
    <div className="mobile-container">
      {/* Header */}
      <div className="mobile-header flex items-center justify-between px-4">
        <h1 className="text-xl font-bold">Espaço Gabriela Aimola</h1>
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-2 text-sm text-primary-foreground/80">
            <User size={16} />
            <span className="hidden sm:inline">{user?.email}</span>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={handleSignOut}
            className="text-primary-foreground/80 hover:text-primary-foreground hover:bg-primary-foreground/10"
          >
            <LogOut size={16} />
            <span className="hidden sm:ml-2 sm:inline">Sair</span>
          </Button>
        </div>
      </div>

      {/* Content — todas as abas montadas para que dialogs (ex.: agendar do WhatsApp) funcionem em qualquer aba */}
      <div className={activeTab === 'whatsapp' ? 'overflow-hidden' : 'mobile-content'} style={activeTab === 'whatsapp' ? { height: 'calc(100vh - 3.5rem - 4rem)' } : undefined}>
        <div style={{ display: activeTab === 'dashboard' ? 'block' : 'none' }}><DashboardTab /></div>
        <div style={{ display: activeTab === 'clientes' ? 'block' : 'none' }}><ClientesTab /></div>
        <div style={{ display: activeTab === 'transacoes' ? 'block' : 'none' }}><TransacoesTab /></div>
        <div style={{ display: activeTab === 'configuracoes' ? 'block' : 'none' }}><ConfiguracoesTab /></div>
        <div style={{ display: activeTab === 'whatsapp' ? 'block' : 'none', height: '100%' }}><WhatsAppPage /></div>
        {/* CalendarioPage SEMPRE montado para que o dialog de "Agendar" do WhatsApp funcione fora da aba calendário */}
        <div style={{ display: activeTab === 'calendario' ? 'block' : 'none' }}><CalendarioPage /></div>
      </div>

      {/* Navigation */}
      <div className="mobile-nav">
        <div className="flex items-center justify-around h-full">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex flex-col items-center py-2 px-2 rounded-xl transition-all duration-200 ${
                  isActive 
                    ? 'text-primary bg-primary/10 scale-105' 
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                <Icon size={20} />
                <span className="text-[10px] mt-1 font-medium">{tab.label}</span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
};

export default Index;
