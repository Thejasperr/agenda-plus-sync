import React, { useEffect, useState } from 'react';
import { Users, Settings, TrendingUp, CalendarDays, LogOut, User, BarChart3, MessageCircle } from 'lucide-react';
import ClientesTab from '@/components/app/ClientesTab';
import CalendarioPage from '@/pages/CalendarioPage';
import ConfiguracoesTab from '@/components/app/ConfiguracoesTab';
import TransacoesTab from '@/components/app/TransacoesTab';
import DashboardTab from '@/components/app/DashboardTab';
import WhatsAppPage from '@/pages/WhatsAppPage';
import InstallPwaPrompt from '@/components/InstallPwaPrompt';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { useWhatsAppNotifications } from '@/hooks/useWhatsAppNotifications';

type TabType = 'dashboard' | 'calendario' | 'whatsapp' | 'clientes' | 'transacoes' | 'configuracoes';

const Index = () => {
  const [activeTab, setActiveTab] = useState<TabType>('dashboard');
  const { user, signOut } = useAuth();
  const { toast } = useToast();

  // Notificações instantâneas de novas mensagens WhatsApp + contador
  const { unreadTotal } = useWhatsAppNotifications();

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
      {/* Header elegante */}
      <header className="mobile-header flex items-center justify-between px-5 relative z-10">
        <div className="flex items-center gap-3 relative z-10">
          <div className="h-10 w-10 rounded-full bg-accent/30 backdrop-blur-sm border border-accent/40 flex items-center justify-center shadow-glow">
            <span className="font-display text-lg text-primary-foreground font-extrabold">G</span>
          </div>
          <div className="leading-tight">
            <h1 className="font-display text-lg sm:text-xl font-semibold tracking-wide">
              Espaço Gabriela Aimola
            </h1>
            <p className="text-[10px] uppercase tracking-[0.2em] text-primary-foreground/60 font-medium hidden sm:block">
              Beauty · Wellness · Care
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2 relative z-10">
          <div className="hidden sm:flex items-center gap-2 text-xs text-primary-foreground/75 px-3 py-1.5 rounded-full bg-primary-foreground/5 border border-primary-foreground/10">
            <User size={14} />
            <span className="max-w-[160px] truncate">{user?.email}</span>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={handleSignOut}
            className="text-primary-foreground/80 hover:text-primary-foreground hover:bg-primary-foreground/10 rounded-full"
          >
            <LogOut size={16} />
            <span className="hidden sm:ml-2 sm:inline">Sair</span>
          </Button>
        </div>
      </header>

      {/* Content — todas as abas montadas para que dialogs (ex.: agendar do WhatsApp) funcionem em qualquer aba */}
      <div
        className={activeTab === 'whatsapp' ? 'overflow-hidden' : 'mobile-content'}
        style={activeTab === 'whatsapp' ? { height: 'calc(100vh - var(--mobile-header-height) - var(--mobile-nav-height))' } : undefined}
      >
        <div style={{ display: activeTab === 'dashboard' ? 'block' : 'none' }}><DashboardTab /></div>
        <div style={{ display: activeTab === 'clientes' ? 'block' : 'none' }}><ClientesTab /></div>
        <div style={{ display: activeTab === 'transacoes' ? 'block' : 'none' }}><TransacoesTab /></div>
        <div style={{ display: activeTab === 'configuracoes' ? 'block' : 'none' }}><ConfiguracoesTab /></div>
        <div style={{ display: activeTab === 'whatsapp' ? 'block' : 'none', height: '100%' }}><WhatsAppPage /></div>
        <div style={{ display: activeTab === 'calendario' ? 'block' : 'none' }}><CalendarioPage /></div>
      </div>

      {/* Navigation charmosa */}
      <nav className="mobile-nav">
        <div className="flex items-center justify-around h-full px-2">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            const showBadge = tab.id === 'whatsapp' && unreadTotal > 0;

            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`relative flex flex-col items-center justify-center py-1.5 px-3 rounded-2xl transition-all duration-300 group ${
                  isActive
                    ? 'text-primary-foreground'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                {/* Pílula ativa */}
                {isActive && (
                  <span className="absolute inset-x-1 inset-y-0 rounded-2xl bg-gradient-elegant shadow-glow -z-0" />
                )}
                <div className="relative z-10 flex flex-col items-center">
                  <div className="relative">
                    <Icon size={20} strokeWidth={isActive ? 2.2 : 1.8} />
                    {showBadge && (
                      <span className="absolute -top-1.5 -right-2 min-w-[18px] h-[18px] px-1 rounded-full bg-destructive text-destructive-foreground text-[10px] font-bold flex items-center justify-center shadow-md ring-2 ring-card">
                        {unreadTotal > 99 ? '99+' : unreadTotal}
                      </span>
                    )}
                  </div>
                  <span className={`text-[10px] mt-0.5 font-medium tracking-wide ${isActive ? 'opacity-100' : 'opacity-80'}`}>
                    {tab.label}
                  </span>
                </div>
              </button>
            );
          })}
        </div>
      </nav>

      <InstallPwaPrompt />
    </div>
  );
};

export default Index;
