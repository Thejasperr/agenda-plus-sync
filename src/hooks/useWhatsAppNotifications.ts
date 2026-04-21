import { useEffect, useRef, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";

/**
 * Notificações de novas mensagens do WhatsApp:
 * - Em background: notificação do navegador (Service Worker / Notification API)
 * - Em foreground: toast no topo com nome de quem enviou
 * - Sempre: mantém contagem total de não lidas (badge no menu)
 */
export function useWhatsAppNotifications() {
  const { user } = useAuth();
  const startedAtRef = useRef<number>(Date.now());
  const [unreadTotal, setUnreadTotal] = useState(0);

  // Carrega total de não lidas a partir dos chats
  const refreshUnread = useCallback(async () => {
    if (!user) return;
    const { data } = await supabase
      .from("whatsapp_chats")
      .select("unread_count")
      .eq("user_id", user.id);
    const total = (data || []).reduce(
      (acc, c: any) => acc + (c.unread_count || 0),
      0
    );
    setUnreadTotal(total);
  }, [user]);

  useEffect(() => {
    if (!user) {
      setUnreadTotal(0);
      return;
    }
    refreshUnread();

    // Realtime: novas mensagens
    const msgChannel = supabase
      .channel("wa-notify-messages")
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "whatsapp_messages",
          filter: `user_id=eq.${user.id}`,
        },
        async (payload) => {
          const msg = payload.new as any;
          if (msg.from_me) return;
          const ts = new Date(msg.timestamp || msg.created_at).getTime();
          if (ts < startedAtRef.current - 5000) return;

          // Busca dados do chat
          const { data: chat } = await supabase
            .from("whatsapp_chats")
            .select("id, nome, profile_pic_url")
            .eq("id", msg.chat_id)
            .maybeSingle();

          const nome = chat?.nome || "Nova mensagem";
          const body =
            msg.content ||
            msg.caption ||
            (msg.message_type === "image"
              ? "📷 Imagem"
              : msg.message_type === "audio"
              ? "🎤 Áudio"
              : msg.message_type === "video"
              ? "🎥 Vídeo"
              : msg.message_type === "document"
              ? "📄 Documento"
              : "Nova mensagem");

          const isVisible =
            typeof document !== "undefined" &&
            document.visibilityState === "visible";

          if (isVisible) {
            // Toast no topo dentro do app
            toast(nome, {
              description: body,
              action: {
                label: "Abrir",
                onClick: () => {
                  window.dispatchEvent(
                    new CustomEvent("app:navigate", {
                      detail: { tab: "whatsapp", chatId: chat?.id },
                    })
                  );
                },
              },
            });
          } else if (
            typeof window !== "undefined" &&
            "Notification" in window &&
            Notification.permission === "granted"
          ) {
            try {
              const reg = await navigator.serviceWorker?.getRegistration();
              if (reg && "showNotification" in reg) {
                reg.showNotification(nome, {
                  body,
                  icon: chat?.profile_pic_url || "/icon-192.png",
                  badge: "/icon-192.png",
                  tag: `wa-${msg.chat_id}`,
                  data: { chatId: msg.chat_id, url: "/" },
                });
              } else {
                const n = new Notification(nome, {
                  body,
                  icon: chat?.profile_pic_url || "/icon-192.png",
                  tag: `wa-${msg.chat_id}`,
                });
                n.onclick = () => {
                  window.focus();
                  n.close();
                };
              }
            } catch (err) {
              console.warn("Falha ao mostrar notificação:", err);
            }
          }
        }
      )
      .subscribe();

    // Realtime: alterações em chats (unread_count muda)
    const chatChannel = supabase
      .channel("wa-notify-chats")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "whatsapp_chats",
          filter: `user_id=eq.${user.id}`,
        },
        () => {
          refreshUnread();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(msgChannel);
      supabase.removeChannel(chatChannel);
    };
  }, [user, refreshUnread]);

  return { unreadTotal, refreshUnread };
}

/** Pede permissão de notificação ao usuário (deve ser chamado em um clique). */
export async function requestNotificationPermission(): Promise<NotificationPermission> {
  if (typeof window === "undefined" || !("Notification" in window)) {
    return "denied";
  }
  if (Notification.permission === "granted") return "granted";
  if (Notification.permission === "denied") return "denied";
  try {
    return await Notification.requestPermission();
  } catch {
    return "denied";
  }
}
