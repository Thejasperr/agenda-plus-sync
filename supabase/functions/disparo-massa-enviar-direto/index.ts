// Envio direto pela Evolution API com auto-reagendamento (chunks),
// cancelamento e seleção inteligente de variação por cliente.
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

// Limites do edge function: paramos antes de bater no timeout (~150s)
const MAX_RUN_MS = 110_000; // 110s por execução, depois reagenda

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

function delay(ms: number) {
  return new Promise((res) => setTimeout(res, ms));
}

// Auto-reagendar a função para continuar processando os pendentes
async function reagendar(disparoId: string, userId: string, authHeader: string) {
  try {
    await fetch(`${SUPABASE_URL}/functions/v1/disparo-massa-enviar-direto`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: authHeader,
      },
      body: JSON.stringify({
        disparo_id: disparoId,
        modo: "continuar",
        user_id: userId,
      }),
    });
  } catch (err) {
    console.error("reagendar erro:", err);
  }
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
    const modo = String(body.modo || "novo"); // "novo" ou "continuar"
    const clienteIds: string[] = Array.isArray(body.cliente_ids) ? body.cliente_ids : [];

    if (!disparoId) throw new Error("disparo_id obrigatório");

    // Carrega disparo + variações + config (delay)
    const { data: disparo, error: dErr } = await admin
      .from("disparos_massa")
      .select("*")
      .eq("id", disparoId)
      .eq("user_id", userId)
      .single();
    if (dErr || !disparo) throw new Error("Disparo não encontrado");

    if (disparo.status === "cancelado") {
      return new Response(JSON.stringify({ ok: true, cancelado: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: configRow } = await admin
      .from("disparos_massa_config")
      .select("delay_min, delay_max")
      .eq("user_id", userId)
      .maybeSingle();
    const delayMin = Math.max(2, Number(configRow?.delay_min ?? 5));
    const delayMax = Math.max(delayMin, Number(configRow?.delay_max ?? 15));

    const { data: variacoes } = await admin
      .from("disparos_massa_variacoes")
      .select("*")
      .eq("disparo_id", disparoId)
      .order("ordem");

    const mensagensPool: Array<{ id: string | null; mensagem: string }> =
      variacoes && variacoes.length
        ? variacoes.map((v) => ({ id: v.id, mensagem: v.mensagem }))
        : [{ id: null, mensagem: disparo.mensagem_sugestao }];

    // === MODO NOVO: cria os envios pendentes com seleção inteligente ===
    if (modo === "novo") {
      if (!clienteIds.length) throw new Error("Selecione pelo menos um cliente");

      const { data: clientes, error: cErr } = await admin
        .from("clientes")
        .select("id, nome, telefone")
        .eq("user_id", userId)
        .in("id", clienteIds);
      if (cErr) throw cErr;
      if (!clientes || !clientes.length) throw new Error("Nenhum cliente válido");

      // Histórico: variações já enviadas a cada cliente
      const { data: historico } = await admin
        .from("disparos_massa_envios")
        .select("cliente_id, variacao_id")
        .eq("user_id", userId)
        .eq("status", "enviado")
        .in("cliente_id", clienteIds);

      const enviadasPorCliente = new Map<string, Set<string>>();
      (historico || []).forEach((h: any) => {
        if (!h.cliente_id || !h.variacao_id) return;
        if (!enviadasPorCliente.has(h.cliente_id)) {
          enviadasPorCliente.set(h.cliente_id, new Set());
        }
        enviadasPorCliente.get(h.cliente_id)!.add(h.variacao_id);
      });

      // Contador para balancear distribuição no disparo atual
      const usoVariacao = new Map<string, number>();
      mensagensPool.forEach((v) => v.id && usoVariacao.set(v.id, 0));

      // Limpa envios antigos do disparo (idempotente)
      await admin.from("disparos_massa_envios").delete().eq("disparo_id", disparoId);

      const envios = clientes.map((c) => {
        const jaEnviadas = enviadasPorCliente.get(c.id) || new Set();

        // Filtra variações ainda não enviadas para essa pessoa
        let candidatas = mensagensPool.filter(
          (v) => !v.id || !jaEnviadas.has(v.id),
        );
        // Se todas já foram enviadas, libera todas (fallback)
        if (candidatas.length === 0) candidatas = mensagensPool;

        // Escolhe a candidata menos usada neste disparo (balanceamento)
        candidatas.sort((a, b) => {
          const ua = a.id ? (usoVariacao.get(a.id) ?? 0) : 0;
          const ub = b.id ? (usoVariacao.get(b.id) ?? 0) : 0;
          return ua - ub;
        });
        const minUso = candidatas[0].id ? (usoVariacao.get(candidatas[0].id) ?? 0) : 0;
        const empatadas = candidatas.filter(
          (v) => (v.id ? (usoVariacao.get(v.id) ?? 0) : 0) === minUso,
        );
        const escolhida = empatadas[Math.floor(Math.random() * empatadas.length)];
        if (escolhida.id) usoVariacao.set(escolhida.id, (usoVariacao.get(escolhida.id) ?? 0) + 1);

        return {
          disparo_id: disparoId,
          user_id: userId,
          cliente_id: c.id,
          cliente_nome: c.nome,
          telefone: c.telefone,
          variacao_id: escolhida.id,
          mensagem_enviada: personalizar(escolhida.mensagem, c.nome),
          status: "pendente",
        };
      });

      const { error: eErr } = await admin
        .from("disparos_massa_envios")
        .insert(envios);
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
    }

    // === Processa pendentes (com limite de tempo) ===
    const startedAt = Date.now();
    const mediaUrl = disparo.media_url as string | null;
    const mediaType = disparo.media_type as string | null;
    const mediaMime = disparo.media_mime as string | null;
    const mediaFilename = disparo.media_filename as string | null;

    const processar = async () => {
      let enviados = Number(disparo.total_enviados ?? 0);
      let falhas = Number(disparo.total_falhas ?? 0);
      let processadosNestaRun = 0;

      while (true) {
        // Verifica tempo restante
        if (Date.now() - startedAt > MAX_RUN_MS) {
          // Reagenda para continuar
          await reagendar(disparoId, userId, auth);
          return;
        }

        // Verifica cancelamento
        const { data: dStatus } = await admin
          .from("disparos_massa")
          .select("status")
          .eq("id", disparoId)
          .single();
        if (dStatus?.status === "cancelado") {
          // Marca pendentes como cancelado
          await admin
            .from("disparos_massa_envios")
            .update({ status: "cancelado" })
            .eq("disparo_id", disparoId)
            .eq("status", "pendente");
          return;
        }

        // Pega o próximo pendente
        const { data: proximos } = await admin
          .from("disparos_massa_envios")
          .select("*")
          .eq("disparo_id", disparoId)
          .eq("status", "pendente")
          .order("created_at", { ascending: true })
          .limit(1);

        const env = proximos?.[0];
        if (!env) {
          // Acabou
          await admin
            .from("disparos_massa")
            .update({ status: "concluido" })
            .eq("id", disparoId);
          return;
        }

        // Delay ANTES de enviar (exceto na primeira mensagem desta run)
        if (processadosNestaRun > 0) {
          const ms = (Math.floor(Math.random() * (delayMax - delayMin + 1)) + delayMin) * 1000;
          // Quebra o sleep em pedaços de 2s para checar cancelamento e tempo
          const chunks = Math.ceil(ms / 2000);
          for (let i = 0; i < chunks; i++) {
            if (Date.now() - startedAt > MAX_RUN_MS) {
              await reagendar(disparoId, userId, auth);
              return;
            }
            await delay(Math.min(2000, ms - i * 2000));
          }
        }

        const number = normalizarTelefone(env.telefone);
        if (!number) {
          await admin.from("disparos_massa_envios")
            .update({ status: "falha", erro: "Telefone inválido" })
            .eq("id", env.id);
          falhas++;
        } else {
          try {
            if (mediaUrl && mediaType) {
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
        }

        await admin.from("disparos_massa")
          .update({ total_enviados: enviados, total_falhas: falhas })
          .eq("id", disparoId);

        processadosNestaRun++;
      }
    };

    // Executa em background
    // @ts-ignore
    if (typeof EdgeRuntime !== "undefined" && EdgeRuntime.waitUntil) {
      // @ts-ignore
      EdgeRuntime.waitUntil(processar());
    } else {
      processar().catch((e) => console.error("processar erro:", e));
    }

    return new Response(
      JSON.stringify({ ok: true, modo }),
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
