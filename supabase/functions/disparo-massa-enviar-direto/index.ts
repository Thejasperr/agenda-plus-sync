// Envio direto pela Evolution API com delay aleatório e progresso em tempo real
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
  const primeiro = (nome || "").split(" ")[0];
  return String(msg || "")
    .replace(/\{nome\}/gi, nome || "")
    .replace(/\{primeiro_nome\}/gi, primeiro);
}

function delay(ms: number) {
  return new Promise((res) => setTimeout(res, ms));
}

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
    const clienteIds: string[] = Array.isArray(body.cliente_ids) ? body.cliente_ids : [];
    const delayMin = Math.max(2, Number(body.delay_min ?? 5));
    const delayMax = Math.max(delayMin, Number(body.delay_max ?? 15));

    if (!disparoId) throw new Error("disparo_id obrigatório");
    if (!clienteIds.length) throw new Error("Selecione pelo menos um cliente");

    // Carrega disparo + variações
    const { data: disparo, error: dErr } = await admin
      .from("disparos_massa")
      .select("*")
      .eq("id", disparoId)
      .eq("user_id", userId)
      .single();
    if (dErr || !disparo) throw new Error("Disparo não encontrado");

    const { data: variacoes } = await admin
      .from("disparos_massa_variacoes")
      .select("*")
      .eq("disparo_id", disparoId)
      .order("ordem");

    // Se não houver variações, usa a mensagem base
    const mensagensPool: Array<{ id: string | null; mensagem: string }> =
      variacoes && variacoes.length
        ? variacoes.map((v) => ({ id: v.id, mensagem: v.mensagem }))
        : [{ id: null, mensagem: disparo.mensagem_sugestao }];

    // Carrega clientes selecionados
    const { data: clientes, error: cErr } = await admin
      .from("clientes")
      .select("id, nome, telefone")
      .eq("user_id", userId)
      .in("id", clienteIds);
    if (cErr) throw cErr;
    if (!clientes || !clientes.length) throw new Error("Nenhum cliente válido");

    // Cria registros pendentes (idempotente: limpa antigos do disparo)
    await admin.from("disparos_massa_envios").delete().eq("disparo_id", disparoId);

    const envios = clientes.map((c) => {
      const v = mensagensPool[Math.floor(Math.random() * mensagensPool.length)];
      return {
        disparo_id: disparoId,
        user_id: userId,
        cliente_id: c.id,
        cliente_nome: c.nome,
        telefone: c.telefone,
        variacao_id: v.id,
        mensagem_enviada: personalizar(v.mensagem, c.nome),
        status: "pendente",
      };
    });

    const { data: enviosInseridos, error: eErr } = await admin
      .from("disparos_massa_envios")
      .insert(envios)
      .select("*");
    if (eErr) throw eErr;

    await admin
      .from("disparos_massa")
      .update({
        status: "enviando",
        total_destinatarios: envios.length,
        total_enviados: 0,
        total_falhas: 0,
      })
      .eq("id", disparoId);

    // Inicia envio em background (não bloqueia a resposta)
    const mediaUrl = disparo.media_url as string | null;
    const mediaType = disparo.media_type as string | null; // image | video | document
    const mediaMime = disparo.media_mime as string | null;
    const mediaFilename = disparo.media_filename as string | null;

    const processar = async () => {
      let enviados = 0;
      let falhas = 0;

      for (const env of enviosInseridos!) {
        const number = normalizarTelefone(env.telefone);
        if (!number) {
          await admin.from("disparos_massa_envios")
            .update({ status: "falha", erro: "Telefone inválido" })
            .eq("id", env.id);
          falhas++;
          continue;
        }

        try {
          if (mediaUrl && mediaType) {
            // Envia mídia com mensagem como caption
            await evoSend("/message/sendMedia", {
              number,
              mediatype: mediaType,
              media: mediaUrl,
              caption: env.mensagem_enviada || "",
              fileName: mediaFilename || `file.${(mediaMime?.split("/")[1]) || "bin"}`,
            });
          } else {
            await evoSend("/message/sendText", {
              number,
              text: env.mensagem_enviada || "",
            });
          }

          await admin.from("disparos_massa_envios")
            .update({ status: "enviado", enviado_at: new Date().toISOString() })
            .eq("id", env.id);
          enviados++;
        } catch (err) {
          await admin.from("disparos_massa_envios")
            .update({ status: "falha", erro: String((err as Error).message || err).slice(0, 500) })
            .eq("id", env.id);
          falhas++;
        }

        // Atualiza contadores no disparo
        await admin.from("disparos_massa")
          .update({ total_enviados: enviados, total_falhas: falhas })
          .eq("id", disparoId);

        // Delay aleatório
        const ms = (Math.floor(Math.random() * (delayMax - delayMin + 1)) + delayMin) * 1000;
        await delay(ms);
      }

      await admin.from("disparos_massa")
        .update({ status: "concluido" })
        .eq("id", disparoId);
    };

    // EdgeRuntime.waitUntil mantém o processo após retornar a resposta
    // @ts-ignore - EdgeRuntime existe no runtime do Supabase
    if (typeof EdgeRuntime !== "undefined" && EdgeRuntime.waitUntil) {
      // @ts-ignore
      EdgeRuntime.waitUntil(processar());
    } else {
      // Fallback: dispara sem await
      processar().catch((e) => console.error("processar erro:", e));
    }

    return new Response(
      JSON.stringify({ ok: true, total: envios.length }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (e) {
    console.error("disparo-massa-enviar-direto erro:", e);
    return new Response(
      JSON.stringify({ error: String((e as Error).message || e) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
