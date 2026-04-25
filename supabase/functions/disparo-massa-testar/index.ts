// Modo TESTE: envia para 1 único número várias mensagens simulando os contatos reais.
// Não grava nada em disparos_massa_envios e não altera totais do disparo.
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

const MAX_RUN_MS = 110_000;

function evoUrl(path: string) {
  return `${EVOLUTION_API_URL.replace(/\/$/, "")}${path}/${EVOLUTION_INSTANCE}`;
}

async function evoSend(path: string, body: Record<string, unknown>) {
  const r = await fetch(evoUrl(path), {
    method: "POST",
    headers: { "Content-Type": "application/json", apikey: EVOLUTION_API_KEY },
    body: JSON.stringify(body),
  });
  const text = await r.text();
  if (!r.ok) throw new Error(`Evolution ${r.status}: ${text.slice(0, 300)}`);
  try { return JSON.parse(text); } catch { return { raw: text }; }
}

function normalizarTelefone(tel: string): string {
  let limpo = String(tel || "").replace(/\D/g, "");
  if (!limpo) return "";
  if (!limpo.startsWith("55")) limpo = "55" + limpo;
  return limpo;
}

function personalizar(msg: string, nome: string): string {
  const nomeCompleto = (nome || "").trim();
  const primeiro = nomeCompleto.split(" ")[0] || "";
  return String(msg || "")
    .replace(/\[\s*nome\s*\]/gi, nomeCompleto)
    .replace(/\[\s*primeiro[_\s-]?nome\s*\]/gi, primeiro)
    .replace(/\[\s*cliente\s*\]/gi, nomeCompleto)
    .replace(/\{\s*nome\s*\}/gi, nomeCompleto)
    .replace(/\{\s*primeiro[_\s-]?nome\s*\}/gi, primeiro)
    .replace(/\{\s*cliente\s*\}/gi, nomeCompleto);
}

const delay = (ms: number) => new Promise((r) => setTimeout(r, ms));

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const auth = req.headers.get("Authorization");
    if (!auth) {
      return new Response(JSON.stringify({ error: "no auth" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const userClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: { headers: { Authorization: auth } },
    });
    const { data: userData } = await userClient.auth.getUser();
    const userId = userData?.user?.id;
    if (!userId) {
      return new Response(JSON.stringify({ error: "unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    const body = await req.json();
    const disparoId = String(body.disparo_id || "").trim();
    const telefoneTeste = String(body.telefone_teste || "").trim();
    const quantidade = Math.max(1, Math.min(500, Number(body.quantidade) || 1));

    if (!disparoId) throw new Error("disparo_id obrigatório");
    const numero = normalizarTelefone(telefoneTeste);
    if (!numero || numero.length < 12) throw new Error("Telefone de teste inválido");

    // Carrega disparo + variações + delay config
    const { data: disparo, error: dErr } = await admin
      .from("disparos_massa")
      .select("*")
      .eq("id", disparoId)
      .eq("user_id", userId)
      .single();
    if (dErr || !disparo) throw new Error("Disparo não encontrado");

    const { data: configRow } = await admin
      .from("disparos_massa_config")
      .select("delay_min, delay_max")
      .eq("user_id", userId)
      .maybeSingle();
    const delayMin = Math.max(2, Number(configRow?.delay_min ?? 5));
    const delayMax = Math.max(delayMin, Number(configRow?.delay_max ?? 15));

    const { data: variacoes } = await admin
      .from("disparos_massa_variacoes")
      .select("id, mensagem, ordem")
      .eq("disparo_id", disparoId)
      .order("ordem");

    const pool = variacoes && variacoes.length
      ? variacoes
      : [{ id: null, mensagem: disparo.mensagem_sugestao, ordem: 1 }];

    // Pega N nomes de clientes reais (para simular nomes em [nome])
    const { data: clientes } = await admin
      .from("clientes")
      .select("nome")
      .eq("user_id", userId)
      .order("nome")
      .limit(quantidade);

    // Distribui variações balanceadamente entre as N mensagens
    const uso = new Map<string, number>();
    pool.forEach((v: any) => v.id && uso.set(v.id, 0));

    const mediaUrl = disparo.media_url as string | null;
    const mediaType = disparo.media_type as string | null;
    const mediaMime = disparo.media_mime as string | null;
    const mediaFilename = disparo.media_filename as string | null;

    const processar = async () => {
      const startedAt = Date.now();
      let enviadas = 0;
      let falhas = 0;

      for (let i = 0; i < quantidade; i++) {
        if (Date.now() - startedAt > MAX_RUN_MS) break;

        // Escolhe variação menos usada
        const sorted = [...pool].sort((a: any, b: any) => {
          const ua = a.id ? (uso.get(a.id) ?? 0) : 0;
          const ub = b.id ? (uso.get(b.id) ?? 0) : 0;
          return ua - ub;
        });
        const minUso = sorted[0].id ? (uso.get(sorted[0].id) ?? 0) : 0;
        const empatadas = sorted.filter((v: any) =>
          (v.id ? (uso.get(v.id) ?? 0) : 0) === minUso,
        );
        const escolhida: any = empatadas[Math.floor(Math.random() * empatadas.length)];
        if (escolhida.id) uso.set(escolhida.id, (uso.get(escolhida.id) ?? 0) + 1);

        const nomeSimulado = clientes?.[i]?.nome || `Cliente ${i + 1}`;
        const texto = `🧪 [TESTE ${i + 1}/${quantidade}] (simulando ${nomeSimulado})\n\n` +
          personalizar(escolhida.mensagem, nomeSimulado);

        try {
          if (mediaUrl && mediaType) {
            await evoSend("/message/sendMedia", {
              number: numero,
              mediatype: mediaType,
              media: mediaUrl,
              caption: texto,
              fileName: mediaFilename || `file.${(mediaMime?.split("/")[1]) || "bin"}`,
            });
          } else {
            await evoSend("/message/sendText", { number: numero, text: texto });
          }
          enviadas++;
        } catch (err) {
          console.error("teste falha:", err);
          falhas++;
        }

        // Delay entre mensagens (igual ao disparo real)
        if (i < quantidade - 1) {
          const ms = (Math.floor(Math.random() * (delayMax - delayMin + 1)) + delayMin) * 1000;
          await delay(ms);
        }
      }

      console.log(`Teste concluído: ${enviadas} enviadas, ${falhas} falhas`);
    };

    // @ts-ignore
    if (typeof EdgeRuntime !== "undefined" && EdgeRuntime.waitUntil) {
      // @ts-ignore
      EdgeRuntime.waitUntil(processar());
    } else {
      processar().catch((e) => console.error("erro:", e));
    }

    return new Response(
      JSON.stringify({
        ok: true,
        total: quantidade,
        numero,
        delay_min: delayMin,
        delay_max: delayMax,
        tempo_estimado_segundos: Math.round((quantidade - 1) * ((delayMin + delayMax) / 2)),
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (e) {
    console.error("disparo-massa-testar erro:", e);
    return new Response(
      JSON.stringify({ error: String((e as Error).message || e) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
