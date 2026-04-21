// Send messages via Evolution API: text, image, audio, video, document
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_ANON = Deno.env.get("SUPABASE_ANON_KEY")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const EVOLUTION_API_URL = Deno.env.get("EVOLUTION_API_URL")!;
const EVOLUTION_API_KEY = Deno.env.get("EVOLUTION_API_KEY")!;
const EVOLUTION_INSTANCE = Deno.env.get("EVOLUTION_INSTANCE_NAME")!;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const auth = req.headers.get("Authorization");
    if (!auth?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const userClient = createClient(SUPABASE_URL, SUPABASE_ANON, {
      global: { headers: { Authorization: auth } },
    });
    const { data: claims, error: claimsError } = await userClient.auth.getClaims(auth.replace("Bearer ", ""));
    if (claimsError || !claims?.claims) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const userId = claims.claims.sub;

    const { remote_jid, telefone, type, text, media_base64, media_mime, filename, caption } = await req.json();

    const number = (remote_jid || telefone || "").replace(/\D/g, "");
    if (!number) {
      return new Response(JSON.stringify({ error: "Missing number" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    let endpoint = "";
    let body: any = { number };

    switch (type) {
      case "text":
        endpoint = `/message/sendText/${EVOLUTION_INSTANCE}`;
        body.text = text;
        break;
      case "image":
      case "video":
      case "document":
        endpoint = `/message/sendMedia/${EVOLUTION_INSTANCE}`;
        body.mediatype = type;
        body.media = media_base64;
        body.mimetype = media_mime;
        if (filename) body.fileName = filename;
        if (caption) body.caption = caption;
        break;
      case "audio":
        endpoint = `/message/sendWhatsAppAudio/${EVOLUTION_INSTANCE}`;
        body.audio = media_base64;
        break;
      default:
        return new Response(JSON.stringify({ error: "Invalid type" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
    }

    const evoResp = await fetch(`${EVOLUTION_API_URL}${endpoint}`, {
      method: "POST",
      headers: { "Content-Type": "application/json", apikey: EVOLUTION_API_KEY },
      body: JSON.stringify(body),
    });

    const respText = await evoResp.text();
    let respJson: any = {};
    try {
      respJson = JSON.parse(respText);
    } catch {
      respJson = { raw: respText };
    }

    if (!evoResp.ok) {
      console.error("Evolution send error:", evoResp.status, respText);
      return new Response(JSON.stringify({ error: "Send failed", details: respJson }), {
        status: 502,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Optimistically log message
    const admin = createClient(SUPABASE_URL, SERVICE_ROLE);
    const jid = remote_jid || `${number}@s.whatsapp.net`;
    const messageId = respJson?.key?.id || crypto.randomUUID();

    // Ensure chat exists
    const { data: chat } = await admin
      .from("whatsapp_chats")
      .upsert(
        {
          user_id: userId,
          remote_jid: jid,
          telefone: number,
          nome: number,
          last_message: type === "text" ? text : `[${type}]`,
          last_message_at: new Date().toISOString(),
        },
        { onConflict: "user_id,remote_jid" },
      )
      .select("id")
      .single();

    if (chat) {
      await admin.from("whatsapp_messages").insert({
        user_id: userId,
        chat_id: chat.id,
        remote_jid: jid,
        message_id: messageId,
        from_me: true,
        message_type: type,
        content: type === "text" ? text : null,
        caption: caption || null,
        media_mime_type: media_mime || null,
        media_filename: filename || null,
        status: "sent",
        timestamp: new Date().toISOString(),
      });
    }

    return new Response(JSON.stringify({ ok: true, response: respJson }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("send error:", e);
    return new Response(JSON.stringify({ error: String(e) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
