import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Bell, Download, X } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { requestNotificationPermission } from "@/hooks/useWhatsAppNotifications";

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

const DISMISS_KEY = "pwa-install-dismissed-at";
const DISMISS_DAYS = 7;

const isStandalone = () =>
  window.matchMedia("(display-mode: standalone)").matches ||
  // iOS
  (window.navigator as any).standalone === true;

const isIOS = () =>
  /iPad|iPhone|iPod/.test(navigator.userAgent) && !(window as any).MSStream;

const InstallPwaPrompt = () => {
  const { toast } = useToast();
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(null);
  const [show, setShow] = useState(false);
  const [showIosHint, setShowIosHint] = useState(false);

  useEffect(() => {
    if (isStandalone()) return;

    const dismissedAt = Number(localStorage.getItem(DISMISS_KEY) || 0);
    const daysSince = (Date.now() - dismissedAt) / (1000 * 60 * 60 * 24);
    if (dismissedAt && daysSince < DISMISS_DAYS) return;

    const handler = (e: Event) => {
      e.preventDefault();
      setDeferred(e as BeforeInstallPromptEvent);
      setShow(true);
    };
    window.addEventListener("beforeinstallprompt", handler);

    // iOS não dispara beforeinstallprompt — mostrar instruções manuais
    if (isIOS()) {
      setShowIosHint(true);
      setShow(true);
    }

    return () => window.removeEventListener("beforeinstallprompt", handler);
  }, []);

  const handleInstall = async () => {
    if (!deferred) return;
    await deferred.prompt();
    const choice = await deferred.userChoice;
    if (choice.outcome === "accepted") {
      // Após instalar, pede permissão de notificação
      const perm = await requestNotificationPermission();
      if (perm === "granted") {
        toast({ title: "Notificações ativadas!" });
      }
    }
    setDeferred(null);
    setShow(false);
  };

  const handleDismiss = () => {
    localStorage.setItem(DISMISS_KEY, String(Date.now()));
    setShow(false);
  };

  const handleEnableNotifications = async () => {
    const perm = await requestNotificationPermission();
    if (perm === "granted") {
      toast({ title: "Notificações ativadas!", description: "Você receberá novas mensagens do WhatsApp." });
    } else if (perm === "denied") {
      toast({
        title: "Notificações bloqueadas",
        description: "Ative nas configurações do navegador.",
        variant: "destructive",
      });
    }
  };

  if (!show) {
    // Mostra apenas botão flutuante de notificação se já instalado mas sem permissão
    if (isStandalone() && "Notification" in window && Notification.permission === "default") {
      return (
        <button
          onClick={handleEnableNotifications}
          className="fixed bottom-20 right-3 z-40 flex items-center gap-1.5 rounded-full bg-primary text-primary-foreground px-3 py-2 text-xs shadow-lg"
        >
          <Bell className="h-3.5 w-3.5" /> Ativar notificações
        </button>
      );
    }
    return null;
  }

  return (
    <div className="fixed bottom-20 left-3 right-3 z-40 rounded-2xl bg-card border border-border shadow-xl p-3 flex items-start gap-3 md:left-auto md:right-3 md:w-80">
      <div className="rounded-xl bg-primary/10 p-2">
        <Download className="h-5 w-5 text-primary" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="font-semibold text-sm text-foreground">Instalar Agenda+</p>
        {showIosHint ? (
          <p className="text-xs text-muted-foreground mt-0.5">
            Toque em <span className="font-semibold">Compartilhar</span> e depois em{" "}
            <span className="font-semibold">Adicionar à Tela de Início</span>.
          </p>
        ) : (
          <p className="text-xs text-muted-foreground mt-0.5">
            Receba notificações instantâneas de novas mensagens.
          </p>
        )}
        {!showIosHint && (
          <Button size="sm" className="mt-2 h-8" onClick={handleInstall}>
            Instalar agora
          </Button>
        )}
      </div>
      <button onClick={handleDismiss} className="text-muted-foreground hover:text-foreground p-1">
        <X className="h-4 w-4" />
      </button>
    </div>
  );
};

export default InstallPwaPrompt;
