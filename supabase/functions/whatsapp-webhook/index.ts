// Webhook receiver for Evolution API events
// Handles: messages.upsert (text, audio, image, video, document)
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const EVOLUTION_API_URL = Deno.env.get("EVOLUTION_API_URL")!;
const EVOLUTION_API_KEY = Deno.env.get("EVOLUTION_API_KEY")!;
const EVOLUTION_INSTANCE = Deno.env.get("EVOLUTION_INSTANCE_NAME")!;

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE);

function jidToPhone(jid: string): string {
  return (jid || "").split("@")[0].replace(/\D/g, "");
}

function formatPhoneDisplay(phone: string): string {
  const clean = phone.replace(/\D/g, "");
  if (clean.length === 13) return `+${clean.slice(0, 2)} (${clean.slice(2, 4)}) ${clean.slice(4, 9)}-${clean.slice(9)}`;
  if (clean.length === 12) return `+${clean.slice(0, 2)} (${clean.slice(2, 4)}) ${clean.slice(4, 8)}-${clean.slice(8)}`;
  return phone;
}

async function downloadAndStoreMedia(
  userId: string,
  messageId: string,
  mediaType: string,
): Promise<{ url: string; mime: string; filename: string } | null> {
  try {
    // Use Evolution's getBase64FromMediaMessage endpoint
    const resp = await fetch(`${EVOLUTION_API_URL}/chat/getBase64FromMediaMessage/${EVOLUTION_INSTANCE}`, {
      method: "POST",
      headers: { "Content-Type": "application/json", apikey: EVOLUTION_API_KEY },
      body: JSON.stringify({ message: { key: { id: messageId } }, convertToMp4: false }),
    });
    if (!resp.ok) {
      console.error("getBase64FromMediaMessage failed", resp.status, await resp.text());
      return null;
    }
    const json = await resp.json();
    const base64 = json.base64 || json.media || "";
    const mime = json.mimetype || "application/octet-stream";
    if (!base64) return null;

    const ext = mime.split("/")[1]?.split(";")[0] || "bin";
    const filename = json.fileName || `${messageId}.${ext}`;
    const path = `${userId}/${mediaType}/${messageId}.${ext}`;

    // Decode base64
    const binStr = atob(base64);
    const bytes = new Uint8Array(binStr.length);
    for (let i = 0; i < binStr.length; i++) bytes[i] = binStr.charCodeAt(i);

    const { error } = await supabase.storage
      .from("whatsapp-media")
      .upload(path, bytes, { contentType: mime, upsert: true });
    if (error) {
      console.error("Storage upload error:", error);
      return null;
    }
    return { url: path, mime, filename };
  } catch (e) {
    console.error("downloadAndStoreMedia error:", e);
    return null;
  }
}

async function findUserIdForInstance(): Promise<string | null> {
  // Single-tenant: find any user that has whatsapp_events. For multi-tenant, map instance->user_id.
  const { data } = await supabase
    .from("whatsapp_events")
    .select("user_id")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (data?.user_id) return data.user_id;
  // Fallback: first user in clientes
  const { data: c } = await supabase.from("clientes").select("user_id").not("user_id", "is", null).limit(1).maybeSingle();
  return c?.user_id || null;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const body = await req.json();
    console.log("Webhook event:", body.event, body.instance);

    const event = body.event || body.type;
    const data = body.data || body;

    // Determine target user
    const userId = await findUserIdForInstance();
    if (!userId) {
      console.warn("No userId found, skipping");
      return new Response(JSON.stringify({ ok: true }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Log raw event
    await supabase.from("whatsapp_events").insert({
      user_id: userId,
      event_type: event || "unknown",
      remote_jid: data?.key?.remoteJid || null,
      data: body,
    });

    if (event === "messages.upsert" || event === "MESSAGES_UPSERT") {
      const messages = Array.isArray(data) ? data : data.messages ? data.messages : [data];
      for (const msg of messages) {
        await processMessage(userId, msg);
      }
    }

    return new Response(JSON.stringify({ ok: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("Webhook error:", e);
    return new Response(JSON.stringify({ error: String(e) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

async function processMessage(userId: string, msg: any) {
  const key = msg.key || {};
  const remoteJid: string = key.remoteJid || "";
  if (!remoteJid || remoteJid.includes("@g.us") || remoteJid === "status@broadcast") return;

  const messageId = key.id || crypto.randomUUID();
  const fromMe = !!key.fromMe;
  const phone = jidToPhone(remoteJid);
  const pushName = msg.pushName || formatPhoneDisplay(phone);
  const ts = msg.messageTimestamp ? new Date(Number(msg.messageTimestamp) * 1000).toISOString() : new Date().toISOString();

  // Determine message content
  const m = msg.message || {};
  let messageType = "text";
  let content: string | null = null;
  let caption: string | null = null;
  let mediaInfo: { url: string; mime: string; filename: string } | null = null;
  let duration: number | null = null;

  if (m.conversation) {
    content = m.conversation;
  } else if (m.extendedTextMessage) {
    content = m.extendedTextMessage.text;
  } else if (m.imageMessage) {
    messageType = "image";
    caption = m.imageMessage.caption || null;
    mediaInfo = await downloadAndStoreMedia(userId, messageId, "image");
  } else if (m.videoMessage) {
    messageType = "video";
    caption = m.videoMessage.caption || null;
    duration = m.videoMessage.seconds || null;
    mediaInfo = await downloadAndStoreMedia(userId, messageId, "video");
  } else if (m.audioMessage) {
    messageType = "audio";
    duration = m.audioMessage.seconds || null;
    mediaInfo = await downloadAndStoreMedia(userId, messageId, "audio");
  } else if (m.documentMessage) {
    messageType = "document";
    caption = m.documentMessage.caption || null;
    mediaInfo = await downloadAndStoreMedia(userId, messageId, "document");
  } else if (m.stickerMessage) {
    messageType = "sticker";
    mediaInfo = await downloadAndStoreMedia(userId, messageId, "sticker");
  } else {
    content = "[Mensagem não suportada]";
  }

  // Find or create chat; check if cliente exists
  const { data: existingCliente } = await supabase
    .from("clientes")
    .select("id, nome")
    .eq("user_id", userId)
    .ilike("telefone", `%${phone.slice(-9)}%`)
    .maybeSingle();

  let clienteId = existingCliente?.id || null;
  let displayName = existingCliente?.nome || pushName;

  // Auto-add cliente if it doesn't exist (and message is incoming)
  if (!clienteId && !fromMe) {
    const { data: newCliente } = await supabase
      .from("clientes")
      .insert({ user_id: userId, nome: pushName, telefone: formatPhoneDisplay(phone) })
      .select("id")
      .single();
    if (newCliente) clienteId = newCliente.id;
  }

  // Upsert chat
  const { data: chat } = await supabase
    .from("whatsapp_chats")
    .upsert(
      {
        user_id: userId,
        remote_jid: remoteJid,
        telefone: phone,
        nome: displayName,
        cliente_id: clienteId,
        last_message: content || caption || `[${messageType}]`,
        last_message_at: ts,
      },
      { onConflict: "user_id,remote_jid" },
    )
    .select("id, unread_count")
    .single();

  if (!chat) return;

  // Increment unread for incoming
  if (!fromMe) {
    await supabase
      .from("whatsapp_chats")
      .update({ unread_count: (chat.unread_count || 0) + 1 })
      .eq("id", chat.id);
  }

  // Insert message
  await supabase.from("whatsapp_messages").upsert(
    {
      user_id: userId,
      chat_id: chat.id,
      remote_jid: remoteJid,
      message_id: messageId,
      from_me: fromMe,
      message_type: messageType,
      content,
      caption,
      media_url: mediaInfo?.url || null,
      media_mime_type: mediaInfo?.mime || null,
      media_filename: mediaInfo?.filename || null,
      media_duration: duration,
      status: fromMe ? "sent" : "received",
      timestamp: ts,
      raw_data: msg,
    },
    { onConflict: "user_id,message_id" },
  );
}
