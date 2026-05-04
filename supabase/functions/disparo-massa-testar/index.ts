// Modo TESTE: envia para 1 único número várias mensagens simulando os contatos reais.
// Persiste estado em `disparos_massa_testes` para retomar caso a função seja interrompida (timeout ~150s).
// Auto-reagendamento: se passar de MAX_RUN_MS, reinvoca a si mesma para continuar.
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

const MAX_RUN_MS = 110_000; // 110s — abaixo do limite de 150s

type EvoCfg = { url: string; instance: string; key: string };

async function loadEvoConfig(admin: any, userId: string): Promise<EvoCfg> {
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

async function evoSend(cfg: EvoCfg, path: string, body: Record<string, unknown>) {
  const r = await fetch(`${cfg.url}${path}/${cfg.instance}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", apikey: cfg.key },
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
  const primeiro = nomeCompleto.split(/\s+/)[0] || "";
  return String(msg || "")
    .replace(/\[\s*nome\s*\]/gi, primeiro)
    .replace(/\[\s*primeiro[_\s-]?nome\s*\]/gi, primeiro)
    .replace(/\[\s*cliente\s*\]/gi, primeiro)
    .replace(/\{\s*nome\s*\}/gi, primeiro)
    .replace(/\{\s*primeiro[_\s-]?nome\s*\}/gi, primeiro)
    .replace(/\{\s*cliente\s*\}/gi, primeiro);
}

const delay = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function reagendar(testeId: string, auth: string) {
  // Reinvoca a si mesma para continuar de onde parou
  await fetch(`${SUPABASE_URL}/functions/v1/disparo-massa-testar`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: auth,
      apikey: SUPABASE_ANON_KEY,
    },
    body: JSON.stringify({ teste_id: testeId, modo: "retomar" }),
  }).catch((e) => console.error("Falha ao reagendar:", e));
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
    const modo = String(body.modo || "novo");

    let testeId: string;

    if (modo === "retomar") {
      testeId = String(body.teste_id || "").trim();
      if (!testeId) throw new Error("teste_id obrigatório");
    } else {
      // Novo teste: cria registro
      const disparoId = String(body.disparo_id || "").trim();
      const telefoneTeste = String(body.telefone_teste || "").trim();
      const quantidade = Math.max(1, Math.min(500, Number(body.quantidade) || 1));

      if (!disparoId) throw new Error("disparo_id obrigatório");
      const numero = normalizarTelefone(telefoneTeste);
      if (!numero || numero.length < 12) throw new Error("Telefone de teste inválido");

      const { data: novoTeste, error: insErr } = await admin
        .from("disparos_massa_testes")
        .insert({
          user_id: userId,
          disparo_id: disparoId,
          telefone_teste: numero,
          quantidade_total: quantidade,
          status: "pendente",
        })
        .select("id")
        .single();
      if (insErr || !novoTeste) throw new Error(`Falha ao criar teste: ${insErr?.message}`);
      testeId = novoTeste.id;
    }

    // Carrega o teste
    const { data: teste, error: tErr } = await admin
      .from("disparos_massa_testes")
      .select("*")
      .eq("id", testeId)
      .eq("user_id", userId)
      .single();
    if (tErr || !teste) throw new Error("Teste não encontrado");

    if (teste.status === "cancelado" || teste.status === "concluido") {
      return new Response(
        JSON.stringify({ ok: true, teste_id: testeId, status: teste.status, ja_finalizado: true }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // Carrega disparo + variações + delay config
    const { data: disparo, error: dErr } = await admin
      .from("disparos_massa")
      .select("*")
      .eq("id", teste.disparo_id)
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
      .eq("disparo_id", teste.disparo_id)
      .order("ordem");

    const pool = variacoes && variacoes.length
      ? variacoes
      : [{ id: null, mensagem: disparo.mensagem_sugestao, ordem: 1 }];

    // Pega N nomes de clientes reais
    const { data: clientes } = await admin
      .from("clientes")
      .select("nome")
      .eq("user_id", userId)
      .order("nome")
      .limit(teste.quantidade_total);

    // Marca como em_andamento (preserva iniciado_at se já existir, senão grava agora)
    const updateInicio: Record<string, unknown> = { status: "em_andamento" };
    if (!teste.iniciado_at) updateInicio.iniciado_at = new Date().toISOString();
    await admin
      .from("disparos_massa_testes")
      .update(updateInicio)
      .eq("id", testeId);

    const numero = teste.telefone_teste;
    const mediaUrl = disparo.media_url as string | null;
    const mediaType = disparo.media_type as string | null;
    const mediaMime = disparo.media_mime as string | null;
    const mediaFilename = disparo.media_filename as string | null;

    // Distribuição balanceada de variações (recalcula com base no proximo_indice)
    const uso = new Map<string, number>();
    pool.forEach((v: any) => v.id && uso.set(v.id, 0));

    const processar = async () => {
      const startedAt = Date.now();
      let enviadas = teste.enviadas;
      let falhas = teste.falhas;
      let i = teste.proximo_indice;
      const logEnvios: any[] = Array.isArray(teste.log_envios) ? [...teste.log_envios] : [];

      while (i < teste.quantidade_total) {
        // Verifica se foi cancelado
        const { data: estado } = await admin
          .from("disparos_massa_testes")
          .select("status")
          .eq("id", testeId)
          .single();
        if (estado?.status === "cancelado") {
          console.log(`Teste ${testeId} cancelado pelo usuário`);
          return;
        }

        // Limite de tempo: salva e reagenda
        if (Date.now() - startedAt > MAX_RUN_MS) {
          await admin
            .from("disparos_massa_testes")
            .update({
              enviadas, falhas, proximo_indice: i,
              log_envios: logEnvios,
              status: "em_andamento",
            })
            .eq("id", testeId);
          console.log(`Teste ${testeId}: reagendando em ${i}/${teste.quantidade_total}`);
          await reagendar(testeId, auth);
          return;
        }

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
        const texto = `🧪 [TESTE ${i + 1}/${teste.quantidade_total}] (simulando ${nomeSimulado})\n\n` +
          personalizar(escolhida.mensagem, nomeSimulado);

        const inicioEnvio = Date.now();
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
          logEnvios.push({
            indice: i + 1,
            status: "enviado",
            simulando: nomeSimulado,
            variacao_ordem: escolhida.ordem,
            duracao_ms: Date.now() - inicioEnvio,
            timestamp: new Date().toISOString(),
          });
        } catch (err) {
          falhas++;
          const erroMsg = String((err as Error)?.message || err).slice(0, 500);
          console.error(`Teste falha #${i + 1}:`, erroMsg);
          logEnvios.push({
            indice: i + 1,
            status: "falhou",
            simulando: nomeSimulado,
            variacao_ordem: escolhida.ordem,
            erro: erroMsg,
            timestamp: new Date().toISOString(),
          });
          // Salva o erro mais recente
          await admin
            .from("disparos_massa_testes")
            .update({ ultimo_erro: erroMsg })
            .eq("id", testeId);
        }

        i++;

        // Persiste após CADA envio para que o progresso atualize em tempo real na UI
        await admin
          .from("disparos_massa_testes")
          .update({ enviadas, falhas, proximo_indice: i, log_envios: logEnvios })
          .eq("id", testeId);

        // Delay entre mensagens
        if (i < teste.quantidade_total) {
          const ms = (Math.floor(Math.random() * (delayMax - delayMin + 1)) + delayMin) * 1000;
          await delay(ms);
        }
      }

      // Finaliza
      await admin
        .from("disparos_massa_testes")
        .update({
          enviadas, falhas, proximo_indice: i,
          log_envios: logEnvios,
          status: "concluido",
          finalizado_at: new Date().toISOString(),
        })
        .eq("id", testeId);
      console.log(`Teste ${testeId} concluído: ${enviadas} enviadas, ${falhas} falhas`);
    };

    // @ts-ignore
    if (typeof EdgeRuntime !== "undefined" && EdgeRuntime.waitUntil) {
      // @ts-ignore
      EdgeRuntime.waitUntil(processar().catch(async (e) => {
        console.error("erro processamento:", e);
        await admin
          .from("disparos_massa_testes")
          .update({ status: "erro", ultimo_erro: String((e as Error)?.message || e).slice(0, 500) })
          .eq("id", testeId);
      }));
    } else {
      processar().catch((e) => console.error("erro:", e));
    }

    return new Response(
      JSON.stringify({
        ok: true,
        teste_id: testeId,
        total: teste.quantidade_total,
        numero,
        delay_min: delayMin,
        delay_max: delayMax,
        retomando_em: teste.proximo_indice,
        tempo_estimado_segundos: Math.round(
          (teste.quantidade_total - teste.proximo_indice - 1) * ((delayMin + delayMax) / 2),
        ),
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
