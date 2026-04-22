// Exclui uma mensagem do WhatsApp (Evolution API) e do banco
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
    if (!auth) {
      return new Response(JSON.stringify({ error: "no auth" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const userClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: { headers: { Authorization: auth } },
    });
    const { data: userData } = await userClient.auth.getUser();
    const userId = userData?.user?.id;
    if (!userId) {
      return new Response(JSON.stringify({ error: "unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    const body = await req.json();
    const { message_db_id } = body;
    if (!message_db_id) throw new Error("message_db_id obrigatório");

    // Busca a mensagem
    const { data: msg, error: msgErr } = await admin
      .from("whatsapp_messages")
      .select("*")
      .eq("id", message_db_id)
      .eq("user_id", userId)
      .maybeSingle();
    if (msgErr) throw msgErr;
    if (!msg) throw new Error("Mensagem não encontrada");
    if (!msg.from_me) throw new Error("Só é possível excluir mensagens enviadas por você");

    // Tenta excluir na Evolution API (somente se temos message_id e remote_jid)
    let evoOk = false;
    let evoError: string | null = null;
    if (msg.message_id && msg.remote_jid) {
      try {
        const url = `${EVOLUTION_API_URL.replace(/\/$/, "")}/chat/deleteMessageForEveryone/${EVOLUTION_INSTANCE}`;
        const r = await fetch(url, {
          method: "DELETE",
          headers: { "Content-Type": "application/json", apikey: EVOLUTION_API_KEY },
          body: JSON.stringify({
            id: msg.message_id,
            remoteJid: msg.remote_jid,
            fromMe: true,
          }),
        });
        const text = await r.text();
        if (!r.ok) {
          evoError = `Evolution ${r.status}: ${text.slice(0, 200)}`;
          console.error("Evolution delete erro:", evoError);
        } else {
          evoOk = true;
        }
      } catch (err) {
        evoError = String((err as Error).message || err);
        console.error("Evolution fetch erro:", evoError);
      }
    }

    // Remove do banco (sempre — assim a UI fica limpa mesmo se a Evolution falhar)
    const { error: delErr } = await admin
      .from("whatsapp_messages")
      .delete()
      .eq("id", message_db_id)
      .eq("user_id", userId);
    if (delErr) throw delErr;

    return new Response(JSON.stringify({ ok: true, evo_deleted: evoOk, evo_error: evoError }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("Delete erro:", e);
    return new Response(JSON.stringify({ error: String((e as Error).message || e) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
