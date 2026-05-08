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
    const cfg = await loadEvoConfig(admin, userId);
    const body = await req.json();
    const { remote_jid } = body;

    if (!remote_jid) throw new Error("remote_jid obrigatório");

    await evoFetch(cfg, "/chat/markMessageAsRead", {
      number: remote_jid.split("@")[0],
      read: true
    });

    return new Response(JSON.stringify({ ok: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("Read mark error:", e);
    return new Response(JSON.stringify({ error: String((e as Error).message || e) }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
