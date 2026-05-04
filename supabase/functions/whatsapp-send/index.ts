// Envio de mensagens via Evolution API: texto, áudio, imagem, vídeo e documentos
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const EVOLUTION_API_URL = Deno.env.get("EVOLUTION_API_URL")!;
const EVOLUTION_API_KEY = Deno.env.get("EVOLUTION_API_KEY")!;
const EVOLUTION_INSTANCE = Deno.env.get("EVOLUTION_INSTANCE_NAME")!;

async function loadEvoConfig(admin: any, userId: string) {
  const { data } = await admin
    .from("evolution_config")
    .select("api_url, instance_name, api_key")
    .eq("user_id", userId)
    .maybeSingle();
  return {
    url: (data?.api_url || EVOLUTION_API_URL || "").replace(/\/$/, ""),
    instance: data?.instance_name || EVOLUTION_INSTANCE,
    key: data?.api_key || EVOLUTION_API_KEY,
  };
}

async function evoFetch(cfg: { url: string; instance: string; key: string }, path: string, body: any) {
  const r = await fetch(`${cfg.url}${path}/${cfg.instance}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", apikey: cfg.key },
    body: JSON.stringify(body),
  });
  const text = await r.text();
  let data: any; try { data = JSON.parse(text); } catch { data = { raw: text }; }
  if (!r.ok) throw new Error(`Evolution ${r.status}: ${text}`);
  return data;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const auth = req.headers.get("Authorization");
    if (!auth) return new Response(JSON.stringify({ error: "no auth" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });

    const userClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: { headers: { Authorization: auth } },
    });
    const { data: userData, error: userErr } = await userClient.auth.getUser(auth.replace("Bearer ", ""));
    const userId = userData?.user?.id;
    if (!userId || userErr) return new Response(JSON.stringify({ error: "unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });

    const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    const body = await req.json();
    const { chat_id, remote_jid, type, content, media_base64, media_mime, filename, caption, quoted } = body;

    if (!remote_jid) throw new Error("remote_jid obrigatório");
    const number = remote_jid.split("@")[0];

    // Monta opcionalmente o objeto "quoted" no formato esperado pela Evolution API
    let quotedPayload: any = undefined;
    if (quoted?.message_id) {
      quotedPayload = {
        key: { id: quoted.message_id, remoteJid: remote_jid, fromMe: !!quoted.from_me },
        message: { conversation: quoted.content || quoted.caption || "" },
      };
    }

    let evoResp: any; let mediaUrl: string | null = null;

    if (type === "text") {
      evoResp = await evoFetch("/message/sendText", { number, text: content, ...(quotedPayload ? { quoted: quotedPayload } : {}) });
    } else if (type === "image" || type === "video" || type === "document") {
      // Upload para storage primeiro
      if (media_base64) {
        const bin = atob(media_base64.includes(",") ? media_base64.split(",")[1] : media_base64);
        const bytes = new Uint8Array(bin.length);
        for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
        const ext = (filename?.split(".").pop()) || (media_mime?.split("/")[1]) || "bin";
        const tempId = crypto.randomUUID();
        const path = `${userId}/${tempId}.${ext}`;
        const { error: upErr } = await admin.storage.from("whatsapp-media").upload(path, bytes, { contentType: media_mime, upsert: true });
        if (upErr) throw upErr;
        const { data: pub } = admin.storage.from("whatsapp-media").getPublicUrl(path);
        mediaUrl = pub.publicUrl;
      }
      evoResp = await evoFetch("/message/sendMedia", {
        number,
        mediatype: type, // image | video | document
        media: mediaUrl || media_base64,
        caption: caption || "",
        fileName: filename || `file.${(media_mime?.split("/")[1]) || "bin"}`,
        ...(quotedPayload ? { quoted: quotedPayload } : {}),
      });
    } else if (type === "sticker") {
      // Sticker: aceita imagem (webp ideal). Faz upload e envia
      if (media_base64) {
        const bin = atob(media_base64.includes(",") ? media_base64.split(",")[1] : media_base64);
        const bytes = new Uint8Array(bin.length);
        for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
        const tempId = crypto.randomUUID();
        const path = `${userId}/${tempId}.webp`;
        const { error: upErr } = await admin.storage.from("whatsapp-media").upload(path, bytes, { contentType: media_mime || "image/webp", upsert: true });
        if (upErr) throw upErr;
        const { data: pub } = admin.storage.from("whatsapp-media").getPublicUrl(path);
        mediaUrl = pub.publicUrl;
      }
      evoResp = await evoFetch("/message/sendSticker", {
        number, sticker: mediaUrl || media_base64,
        ...(quotedPayload ? { quoted: quotedPayload } : {}),
      });
    } else if (type === "audio") {
      // Para áudio o evolution prefere endpoint próprio
      if (media_base64) {
        const bin = atob(media_base64.includes(",") ? media_base64.split(",")[1] : media_base64);
        const bytes = new Uint8Array(bin.length);
        for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
        const tempId = crypto.randomUUID();
        const path = `${userId}/${tempId}.ogg`;
        const { error: upErr } = await admin.storage.from("whatsapp-media").upload(path, bytes, { contentType: media_mime || "audio/ogg", upsert: true });
        if (upErr) throw upErr;
        const { data: pub } = admin.storage.from("whatsapp-media").getPublicUrl(path);
        mediaUrl = pub.publicUrl;
      }
      evoResp = await evoFetch("/message/sendWhatsAppAudio", {
        number, audio: mediaUrl || media_base64,
        ...(quotedPayload ? { quoted: quotedPayload } : {}),
      });
    } else {
      throw new Error("Tipo inválido");
    }

    // Persistir mensagem enviada
    const messageId = evoResp?.key?.id || crypto.randomUUID();
    await admin.from("whatsapp_messages").insert({
      user_id: userId, chat_id, remote_jid,
      message_id: messageId, from_me: true,
      message_type: type, content: type === "text" ? content : null,
      caption: caption || null, media_url: mediaUrl, media_mime_type: media_mime || null,
      media_filename: filename || null,
      quoted_message_id: quoted?.message_id || null,
      timestamp: new Date().toISOString(), status: "sent", raw_data: evoResp,
    });

    const preview = type === "text" ? content : `[${type}]`;
    await admin.from("whatsapp_chats").update({
      last_message: preview, last_message_at: new Date().toISOString(),
    }).eq("id", chat_id);

    return new Response(JSON.stringify({ ok: true, message_id: messageId, media_url: mediaUrl }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("Send erro:", e);
    return new Response(JSON.stringify({ error: String((e as Error).message || e) }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
