// Import historical chats and messages from Evolution API
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

function jidToPhone(jid: string): string {
  return (jid || "").split("@")[0].replace(/\D/g, "");
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const auth = req.headers.get("Authorization");
    if (!auth?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    const userClient = createClient(SUPABASE_URL, SUPABASE_ANON, { global: { headers: { Authorization: auth } } });
    const { data: claims } = await userClient.auth.getClaims(auth.replace("Bearer ", ""));
    if (!claims?.claims) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    const userId = claims.claims.sub;
    const admin = createClient(SUPABASE_URL, SERVICE_ROLE);

    // Fetch all chats from Evolution
    const chatsResp = await fetch(`${EVOLUTION_API_URL}/chat/findChats/${EVOLUTION_INSTANCE}`, {
      method: "POST",
      headers: { "Content-Type": "application/json", apikey: EVOLUTION_API_KEY },
      body: JSON.stringify({}),
    });

    if (!chatsResp.ok) {
      const txt = await chatsResp.text();
      console.error("findChats failed:", chatsResp.status, txt);
      return new Response(JSON.stringify({ error: "Failed to fetch chats", details: txt }), {
        status: 502,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const chatsRaw = await chatsResp.json();
    const chats = Array.isArray(chatsRaw) ? chatsRaw : chatsRaw.chats || [];

    let imported = 0;
    for (const c of chats) {
      const remoteJid: string = c.remoteJid || c.id || c.jid;
      if (!remoteJid || remoteJid.includes("@g.us") || remoteJid === "status@broadcast") continue;

      const phone = jidToPhone(remoteJid);
      const name = c.pushName || c.name || phone;

      // Check if cliente exists
      const { data: existingCliente } = await admin
        .from("clientes")
        .select("id, nome")
        .eq("user_id", userId)
        .ilike("telefone", `%${phone.slice(-9)}%`)
        .maybeSingle();

      let clienteId = existingCliente?.id || null;
      const displayName = existingCliente?.nome || name;

      if (!clienteId) {
        const { data: newCliente } = await admin
          .from("clientes")
          .insert({ user_id: userId, nome: name, telefone: phone })
          .select("id")
          .single();
        if (newCliente) clienteId = newCliente.id;
      }

      await admin.from("whatsapp_chats").upsert(
        {
          user_id: userId,
          remote_jid: remoteJid,
          telefone: phone,
          nome: displayName,
          cliente_id: clienteId,
          last_message: c.lastMessage?.message?.conversation || null,
          last_message_at: c.updatedAt || c.lastMessageTimestamp || null,
        },
        { onConflict: "user_id,remote_jid" },
      );
      imported++;
    }

    return new Response(JSON.stringify({ ok: true, imported }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("import error:", e);
    return new Response(JSON.stringify({ error: String(e) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
