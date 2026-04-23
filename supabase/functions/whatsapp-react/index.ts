// Envia uma reação (emoji) para uma mensagem do WhatsApp via Evolution API.
// Para remover a reação, envie emoji vazio "".
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

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const auth = req.headers.get("Authorization");
    if (!auth) return new Response(JSON.stringify({ error: "no auth" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });

    const userClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: { headers: { Authorization: auth } },
    });
    const { data: userData } = await userClient.auth.getUser(auth.replace("Bearer ", ""));
    const userId = userData?.user?.id;
    if (!userId) return new Response(JSON.stringify({ error: "unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });

    const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    const body = await req.json();
    const { chat_id, remote_jid, message_id, from_me, emoji } = body;

    if (!remote_jid || !message_id || !chat_id) {
      return new Response(JSON.stringify({ error: "campos obrigatórios faltando" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const reactionEmoji = typeof emoji === "string" ? emoji : "";
    const url = `${EVOLUTION_API_URL.replace(/\/$/, "")}/message/sendReaction/${EVOLUTION_INSTANCE}`;
    const evoBody = {
      reactionMessage: {
        key: { id: message_id, remoteJid: remote_jid, fromMe: !!from_me },
        reaction: reactionEmoji,
      },
    };

    const r = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json", apikey: EVOLUTION_API_KEY },
      body: JSON.stringify(evoBody),
    });
    const txt = await r.text();
    if (!r.ok) {
      console.error("Evolution sendReaction falhou", r.status, txt);
      throw new Error(`Evolution ${r.status}: ${txt}`);
    }

    // Persiste localmente (upsert por user_id + message_id + reactor_jid)
    // O reator quando from_me é o próprio usuário. Como JID, usamos o chat remote_jid sem dígitos.
    const reactorJid = `me@${userId}`;

    if (!reactionEmoji) {
      // Remoção
      await admin
        .from("whatsapp_reactions")
        .delete()
        .eq("user_id", userId)
        .eq("message_id", message_id)
        .eq("reactor_jid", reactorJid);
    } else {
      await admin
        .from("whatsapp_reactions")
        .upsert(
          {
            user_id: userId,
            chat_id,
            message_id,
            reactor_jid: reactorJid,
            from_me: true,
            emoji: reactionEmoji,
            timestamp: new Date().toISOString(),
          },
          { onConflict: "user_id,message_id,reactor_jid" },
        );
    }

    return new Response(JSON.stringify({ ok: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("React erro:", e);
    return new Response(JSON.stringify({ error: String((e as Error).message || e) }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
