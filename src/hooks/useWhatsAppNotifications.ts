import { useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

/**
 * Dispara uma notificação do navegador quando chega uma nova mensagem do WhatsApp
 * (somente quando from_me=false e o app não está focado naquela conversa).
 */
export function useWhatsAppNotifications() {
  const { user } = useAuth();
  const startedAtRef = useRef<number>(Date.now());

  useEffect(() => {
    if (!user) return;
    if (typeof window === "undefined" || !("Notification" in window)) return;

    const channel = supabase
      .channel("wa-notify-global")
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

          // Ignora mensagens enviadas por nós ou antigas (sync inicial)
          if (msg.from_me) return;
          const ts = new Date(msg.timestamp || msg.created_at).getTime();
          if (ts < startedAtRef.current - 5000) return;

          // Se o app está visível, deixa o toast/UI cuidar — só notifica em background
          if (document.visibilityState === "visible") return;

          if (Notification.permission !== "granted") return;

          // Busca dados do chat para mostrar nome
          const { data: chat } = await supabase
            .from("whatsapp_chats")
            .select("nome, profile_pic_url")
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

          try {
            // Prefere ServiceWorker (notif. persistente) — fallback para Notification
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
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user]);
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
