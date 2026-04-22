import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const DEFAULT_WEBHOOK_URL = 'https://n8n-n8n.xwskpb.easypanel.host/webhook-test/disparoemmassaappagenda';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Não autorizado' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    );

    const userClient = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: authHeader } } },
    );

    const { data: userData, error: userError } = await userClient.auth.getUser();
    if (userError || !userData.user) {
      return new Response(JSON.stringify({ error: 'Usuário inválido' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const userId = userData.user.id;
    const body = await req.json();
    const mensagemSugestao = String(body.mensagem_sugestao || '').trim();
    const observacoes = body.observacoes ? String(body.observacoes) : null;

    if (!mensagemSugestao || mensagemSugestao.length < 3) {
      return new Response(JSON.stringify({ error: 'Mensagem de sugestão muito curta' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Cria o disparo
    const { data: disparo, error: disparoError } = await supabase
      .from('disparos_massa')
      .insert({
        user_id: userId,
        mensagem_sugestao: mensagemSugestao,
        observacoes,
        status: 'gerando',
      })
      .select()
      .single();

    if (disparoError) throw disparoError;

    // Busca a URL configurada pelo usuário, ou usa o default
    const { data: config } = await supabase
      .from('disparos_massa_config')
      .select('webhook_url')
      .eq('user_id', userId)
      .maybeSingle();
    const webhookUrl = config?.webhook_url?.trim() || DEFAULT_WEBHOOK_URL;

    // Chama o webhook do n8n
    let variacoes: Array<{ estilo?: string; mensagem: string }> = [];
    try {
      const webhookRes = await fetch(webhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          disparo_id: disparo.id,
          user_id: userId,
          mensagem_sugestao: mensagemSugestao,
          observacoes,
          quantidade: 10,
        }),
      });

      const text = await webhookRes.text();
      let parsed: any = null;
      try { parsed = JSON.parse(text); } catch { /* ignore */ }

      // Aceita múltiplos formatos de resposta
      if (Array.isArray(parsed)) {
        variacoes = parsed.map((v: any) => ({
          estilo: v.estilo || v.style || v.titulo || null,
          mensagem: v.mensagem || v.message || v.text || (typeof v === 'string' ? v : ''),
        })).filter((v) => v.mensagem);
      } else if (parsed && Array.isArray(parsed.variacoes)) {
        variacoes = parsed.variacoes.map((v: any) => ({
          estilo: v.estilo || v.style || null,
          mensagem: v.mensagem || v.message || v.text || '',
        })).filter((v: any) => v.mensagem);
      } else if (parsed && Array.isArray(parsed.messages)) {
        variacoes = parsed.messages.map((v: any) => ({
          estilo: v.estilo || v.style || null,
          mensagem: v.mensagem || v.message || v.text || '',
        })).filter((v: any) => v.mensagem);
      }
    } catch (e) {
      console.error('Erro ao chamar webhook:', e);
    }

    if (variacoes.length > 0) {
      const rows = variacoes.slice(0, 10).map((v, idx) => ({
        user_id: userId,
        disparo_id: disparo.id,
        estilo: v.estilo || `Estilo ${idx + 1}`,
        mensagem: v.mensagem,
        ordem: idx + 1,
      }));

      const { error: insertVarError } = await supabase
        .from('disparos_massa_variacoes')
        .insert(rows);

      if (insertVarError) throw insertVarError;

      await supabase
        .from('disparos_massa')
        .update({ status: 'concluido' })
        .eq('id', disparo.id);
    } else {
      await supabase
        .from('disparos_massa')
        .update({ status: 'aguardando_webhook' })
        .eq('id', disparo.id);
    }

    return new Response(
      JSON.stringify({ success: true, disparo_id: disparo.id, variacoes_geradas: variacoes.length }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  } catch (error) {
    console.error('Erro:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Erro desconhecido' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  }
});
