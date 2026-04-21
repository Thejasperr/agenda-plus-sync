// Webhook receptor de eventos da Evolution API
// Recebe MESSAGES_UPSERT, CHATS_UPSERT, etc., persiste em whatsapp_chats e whatsapp_messages
// e baixa as mídias para o bucket whatsapp-media.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const EVOLUTION_API_URL = Deno.env.get("EVOLUTION_API_URL")!;
const EVOLUTION_API_KEY = Deno.env.get("EVOLUTION_API_KEY")!;
const EVOLUTION_INSTANCE = Deno.env.get("EVOLUTION_INSTANCE_NAME")!;

const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

function jidToPhone(jid: string): string {
  return (jid || "").split("@")[0].replace(/\D/g, "");
}

function pickContent(msg: any): { type: string; content: string | null; caption?: string } {
  if (!msg) return { type: "text", content: null };
  if (msg.conversation) return { type: "text", content: msg.conversation };
  if (msg.extendedTextMessage?.text) return { type: "text", content: msg.extendedTextMessage.text };
  if (msg.imageMessage) return { type: "image", content: null, caption: msg.imageMessage.caption };
  if (msg.videoMessage) return { type: "video", content: null, caption: msg.videoMessage.caption };
  if (msg.audioMessage) return { type: "audio", content: null };
  if (msg.documentMessage) return { type: "document", content: null, caption: msg.documentMessage.fileName };
  if (msg.stickerMessage) return { type: "sticker", content: null };
  return { type: "text", content: null };
}

async function downloadMediaFromEvolution(messageId: string): Promise<{ base64: string; mimetype: string } | null> {
  try {
    const url = `${EVOLUTION_API_URL.replace(/\/$/, "")}/chat/getBase64FromMediaMessage/${EVOLUTION_INSTANCE}`;
    const resp = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json", apikey: EVOLUTION_API_KEY },
      body: JSON.stringify({ message: { key: { id: messageId } }, convertToMp4: false }),
    });
    if (!resp.ok) {
      console.error("getBase64FromMediaMessage falhou", resp.status, await resp.text());
      return null;
    }
    const data = await resp.json();
    const base64 = data.base64 || data.data || data;
    const mimetype = data.mimetype || data.mime || "application/octet-stream";
    if (typeof base64 !== "string") return null;
    return { base64, mimetype };
  } catch (e) {
    console.error("Erro download mídia:", e);
    return null;
  }
}

function base64ToBytes(b64: string): Uint8Array {
  const clean = b64.includes(",") ? b64.split(",")[1] : b64;
  const bin = atob(clean);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return bytes;
}

function extFromMime(mime: string): string {
  const map: Record<string, string> = {
    "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp", "image/gif": "gif",
    "video/mp4": "mp4", "video/webm": "webm", "video/quicktime": "mov",
    "audio/ogg": "ogg", "audio/mpeg": "mp3", "audio/mp4": "m4a", "audio/wav": "wav",
    "application/pdf": "pdf", "application/zip": "zip",
  };
  return map[mime] || "bin";
}

async function uploadMedia(userId: string, messageId: string, base64: string, mimetype: string): Promise<string | null> {
  try {
    const bytes = base64ToBytes(base64);
    const ext = extFromMime(mimetype);
    const path = `${userId}/${messageId}.${ext}`;
    const { error } = await admin.storage.from("whatsapp-media").upload(path, bytes, {
      contentType: mimetype, upsert: true,
    });
    if (error) { console.error("Upload falhou", error); return null; }
    const { data } = admin.storage.from("whatsapp-media").getPublicUrl(path);
    return data.publicUrl;
  } catch (e) { console.error("Upload erro:", e); return null; }
}

async function findUserByInstance(): Promise<string | null> {
  // Estratégia: prioriza chats existentes (mais confiável), depois clientes.
  const { data: chat } = await admin
    .from("whatsapp_chats")
    .select("user_id")
    .not("user_id", "is", null)
    .limit(1)
    .maybeSingle();
  if (chat?.user_id) return chat.user_id;

  const { data: cli } = await admin
    .from("clientes")
    .select("user_id")
    .not("user_id", "is", null)
    .limit(1)
    .maybeSingle();
  return cli?.user_id ?? null;
}

async function ensureChat(userId: string, remoteJid: string, pushName?: string): Promise<string | null> {
  const telefone = jidToPhone(remoteJid);
  const { data: existing } = await admin
    .from("whatsapp_chats")
    .select("id, nome, cliente_id")
    .eq("user_id", userId).eq("remote_jid", remoteJid).maybeSingle();

  // Vincular cliente se telefone bater
  let clienteId: string | null = null;
  let clienteNome: string | null = null;
  if (telefone) {
    const { data: cli } = await admin
      .from("clientes")
      .select("id, nome")
      .eq("user_id", userId)
      .ilike("telefone", `%${telefone.slice(-8)}%`)
      .limit(1).maybeSingle();
    if (cli) { clienteId = cli.id; clienteNome = cli.nome; }
  }

  if (existing) {
    if ((clienteId && existing.cliente_id !== clienteId) || (clienteNome && !existing.nome)) {
      await admin.from("whatsapp_chats").update({
        cliente_id: clienteId ?? existing.cliente_id,
        nome: clienteNome || existing.nome,
      }).eq("id", existing.id);
    }
    return existing.id;
  }

  const { data: created, error } = await admin.from("whatsapp_chats").insert({
    user_id: userId,
    remote_jid: remoteJid,
    telefone,
    nome: clienteNome || pushName || telefone,
    cliente_id: clienteId,
  }).select("id").single();
  if (error) { console.error("ensureChat insert", error); return null; }
  return created.id;
}

async function processMessageUpsert(payload: any) {
  const userId = await findUserByInstance();
  if (!userId) { console.error("Sem user_id mapeado"); return; }

  const messages = Array.isArray(payload?.data) ? payload.data : [payload?.data];
  for (const m of messages) {
    if (!m) continue;
    const key = m.key || {};
    const remoteJid = key.remoteJid;
    if (!remoteJid || remoteJid.endsWith("@g.us")) continue; // ignora grupos

    const messageId = key.id;
    const fromMe = !!key.fromMe;
    const pushName = m.pushName;
    const ts = m.messageTimestamp ? new Date(Number(m.messageTimestamp) * 1000).toISOString() : new Date().toISOString();

    const chatId = await ensureChat(userId, remoteJid, pushName);
    if (!chatId) continue;

    // Dedupe
    if (messageId) {
      const { data: existing } = await admin
        .from("whatsapp_messages").select("id").eq("message_id", messageId).maybeSingle();
      if (existing) continue;
    }

    const picked = pickContent(m.message);
    let mediaUrl: string | null = null;
    let mimetype: string | null = null;
    let duration: number | null = null;
    let filename: string | null = null;

    if (["image", "video", "audio", "document", "sticker"].includes(picked.type)) {
      mimetype = m.message?.[`${picked.type}Message`]?.mimetype || null;
      duration = m.message?.audioMessage?.seconds || m.message?.videoMessage?.seconds || null;
      filename = m.message?.documentMessage?.fileName || null;
      if (messageId) {
        const dl = await downloadMediaFromEvolution(messageId);
        if (dl) {
          mediaUrl = await uploadMedia(userId, messageId, dl.base64, dl.mimetype || mimetype || "application/octet-stream");
          if (!mimetype) mimetype = dl.mimetype;
        }
      }
    }

    await admin.from("whatsapp_messages").insert({
      user_id: userId, chat_id: chatId, remote_jid: remoteJid,
      message_id: messageId, from_me: fromMe, message_type: picked.type,
      content: picked.content, caption: picked.caption || null,
      media_url: mediaUrl, media_mime_type: mimetype, media_duration: duration, media_filename: filename,
      timestamp: ts, status: "received", raw_data: m,
    });

    // Atualiza last_message do chat
    const preview = picked.content || picked.caption || `[${picked.type}]`;
    await admin.from("whatsapp_chats").update({
      last_message: preview, last_message_at: ts,
      unread_count: fromMe ? 0 : undefined,
    }).eq("id", chatId);

    if (!fromMe) {
      await admin.rpc as any; // noop placeholder
      // incrementar manualmente
      const { data: c } = await admin.from("whatsapp_chats").select("unread_count").eq("id", chatId).single();
      await admin.from("whatsapp_chats").update({ unread_count: (c?.unread_count || 0) + 1 }).eq("id", chatId);
    }
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const payload = await req.json();
    console.log("Webhook event:", payload?.event || payload?.type);

    const eventType: string = payload?.event || payload?.type || "";
    if (eventType === "messages.upsert" || eventType === "MESSAGES_UPSERT") {
      await processMessageUpsert(payload);
    }
    // Outros eventos (chats.upsert, contacts.upsert) podem ser tratados aqui

    return new Response(JSON.stringify({ ok: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("Webhook erro:", e);
    return new Response(JSON.stringify({ error: String(e) }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
