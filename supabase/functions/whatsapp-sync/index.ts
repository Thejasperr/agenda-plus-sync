// Sincroniza chats existentes da Evolution API para o banco
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

function jidToPhone(jid: string) { return (jid || "").split("@")[0].replace(/\D/g, ""); }

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const auth = req.headers.get("Authorization");
    if (!auth) throw new Error("no auth");
    const userClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, { global: { headers: { Authorization: auth } } });
    const { data: claims } = await userClient.auth.getClaims(auth.replace("Bearer ", ""));
    const userId = claims?.claims?.sub;
    if (!userId) throw new Error("unauthorized");

    const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    const url = `${EVOLUTION_API_URL.replace(/\/$/, "")}/chat/findChats/${EVOLUTION_INSTANCE}`;
    const r = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json", apikey: EVOLUTION_API_KEY }, body: JSON.stringify({}) });
    const txt = await r.text();
    let chats: any[] = [];
    try { chats = JSON.parse(txt); } catch { chats = []; }
    if (!Array.isArray(chats)) chats = chats?.chats || [];

    let inserted = 0;
    for (const c of chats) {
      const remoteJid = c.remoteJid || c.id;
      if (!remoteJid || remoteJid.endsWith("@g.us") || remoteJid === "status@broadcast") continue;
      const telefone = jidToPhone(remoteJid);

      // tenta vincular cliente
      let clienteId: string | null = null;
      let clienteNome: string | null = null;
      if (telefone) {
        const { data: cli } = await admin.from("clientes").select("id, nome").eq("user_id", userId).ilike("telefone", `%${telefone.slice(-8)}%`).limit(1).maybeSingle();
        if (cli) { clienteId = cli.id; clienteNome = cli.nome; }
      }

      const nome = clienteNome || c.pushName || c.name || telefone;
      const lastTs = c.updatedAt ? new Date(c.updatedAt).toISOString() : null;

      const { data: existing } = await admin.from("whatsapp_chats").select("id").eq("user_id", userId).eq("remote_jid", remoteJid).maybeSingle();
      if (existing) {
        await admin.from("whatsapp_chats").update({
          nome, telefone, cliente_id: clienteId, profile_pic_url: c.profilePicUrl || null,
          last_message: c.lastMessage?.message?.conversation || null,
          last_message_at: lastTs,
        }).eq("id", existing.id);
      } else {
        await admin.from("whatsapp_chats").insert({
          user_id: userId, remote_jid: remoteJid, telefone, nome,
          cliente_id: clienteId, profile_pic_url: c.profilePicUrl || null,
          last_message: c.lastMessage?.message?.conversation || null,
          last_message_at: lastTs,
        });
        inserted++;
      }
    }

    return new Response(JSON.stringify({ ok: true, total: chats.length, inserted }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("Sync erro:", e);
    return new Response(JSON.stringify({ error: String((e as Error).message || e) }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
