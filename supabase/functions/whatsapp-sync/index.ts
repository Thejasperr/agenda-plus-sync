// Sincroniza chats existentes da Evolution API para o banco (otimizado em batch)
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
    const { data: userData, error: userErr } = await userClient.auth.getUser(auth.replace("Bearer ", ""));
    const userId = userData?.user?.id;
    if (!userId || userErr) throw new Error("unauthorized");

    const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // 1) Buscar chats da Evolution
    const url = `${EVOLUTION_API_URL.replace(/\/$/, "")}/chat/findChats/${EVOLUTION_INSTANCE}`;
    const r = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json", apikey: EVOLUTION_API_KEY },
      body: JSON.stringify({}),
    });
    const txt = await r.text();
    let chats: any = [];
    try { chats = JSON.parse(txt); } catch { chats = []; }
    if (!Array.isArray(chats)) chats = (chats as any)?.chats || [];

    // 2) Pré-carregar todos os clientes do user uma única vez
    const { data: clientes } = await admin
      .from("clientes")
      .select("id, nome, telefone")
      .eq("user_id", userId);
    const clientesByTail: Record<string, { id: string; nome: string }> = {};
    for (const cli of clientes || []) {
      const tail = (cli.telefone || "").replace(/\D/g, "").slice(-8);
      if (tail && !clientesByTail[tail]) clientesByTail[tail] = { id: cli.id, nome: cli.nome };
    }

    // 3) Pré-carregar todos os chats existentes uma única vez
    const { data: existingChats } = await admin
      .from("whatsapp_chats")
      .select("id, remote_jid")
      .eq("user_id", userId);
    const existingByJid: Record<string, string> = {};
    for (const ec of existingChats || []) existingByJid[ec.remote_jid] = ec.id;

    // 4) Montar arrays de upserts
    const toInsert: any[] = [];
    const toUpdate: { id: string; payload: any }[] = [];

    for (const c of chats) {
      const remoteJid = c.remoteJid || c.id;
      if (!remoteJid || remoteJid === "status@broadcast") continue;
      const telefone = jidToPhone(remoteJid);
      const tail = telefone.slice(-8);
      const cli = tail ? clientesByTail[tail] : null;
      const nome = cli?.nome || c.pushName || c.name || telefone;
      const lastTs = c.updatedAt ? new Date(c.updatedAt).toISOString() : null;
      const lastMsg = c.lastMessage?.message?.conversation || null;
      const profilePic = c.profilePicUrl || null;

      const payload = {
        user_id: userId,
        remote_jid: remoteJid,
        telefone,
        nome,
        cliente_id: cli?.id || null,
        profile_pic_url: profilePic,
        last_message: lastMsg,
        last_message_at: lastTs,
      };

      if (existingByJid[remoteJid]) {
        toUpdate.push({ id: existingByJid[remoteJid], payload });
      } else {
        toInsert.push(payload);
      }
    }

    // 5) Insert em chunks de 200
    let inserted = 0;
    for (let i = 0; i < toInsert.length; i += 200) {
      const chunk = toInsert.slice(i, i + 200);
      const { error } = await admin.from("whatsapp_chats").insert(chunk);
      if (error) console.error("Insert chunk erro:", error);
      else inserted += chunk.length;
    }

    // 6) Updates: limita a 50 mais recentes para não estourar tempo
    const recentUpdates = toUpdate.slice(0, 50);
    await Promise.all(recentUpdates.map(u =>
      admin.from("whatsapp_chats").update(u.payload).eq("id", u.id)
    ));

    return new Response(JSON.stringify({
      ok: true, total: chats.length, inserted, updated: recentUpdates.length,
    }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e) {
    console.error("Sync erro:", e);
    return new Response(JSON.stringify({ error: String((e as Error).message || e) }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
