import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

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
    const disparoId = String(body.disparo_id || '').trim();

    if (!disparoId) {
      return new Response(JSON.stringify({ error: 'disparo_id obrigatório' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Busca o webhook de envio configurado
    const { data: config } = await supabase
      .from('disparos_massa_config')
      .select('webhook_envio_url')
      .eq('user_id', userId)
      .maybeSingle();

    const webhookUrl = config?.webhook_envio_url?.trim();
    if (!webhookUrl) {
      return new Response(
        JSON.stringify({ error: 'Configure a URL do webhook de envio antes de disparar.' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    // Busca disparo + variações
    const { data: disparo, error: dErr } = await supabase
      .from('disparos_massa')
      .select('*')
      .eq('id', disparoId)
      .eq('user_id', userId)
      .single();
    if (dErr || !disparo) throw new Error('Disparo não encontrado');

    const { data: variacoes, error: vErr } = await supabase
      .from('disparos_massa_variacoes')
      .select('*')
      .eq('disparo_id', disparoId)
      .order('ordem');
    if (vErr) throw vErr;

    if (!variacoes || variacoes.length === 0) {
      return new Response(JSON.stringify({ error: 'Sem variações para enviar' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Busca clientes do usuário para o webhook saber para quem disparar
    const { data: clientes } = await supabase
      .from('clientes')
      .select('id, nome, telefone')
      .eq('user_id', userId);

    const webhookRes = await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        disparo_id: disparoId,
        user_id: userId,
        mensagem_base: disparo.mensagem_sugestao,
        observacoes: disparo.observacoes,
        variacoes: variacoes.map((v) => ({
          id: v.id,
          ordem: v.ordem,
          estilo: v.estilo,
          mensagem: v.mensagem,
        })),
        clientes: clientes || [],
      }),
    });

    const text = await webhookRes.text();

    if (!webhookRes.ok) {
      throw new Error(`Webhook respondeu ${webhookRes.status}: ${text.slice(0, 200)}`);
    }

    await supabase
      .from('disparos_massa')
      .update({ status: 'enviado' })
      .eq('id', disparoId);

    return new Response(
      JSON.stringify({ success: true, total_variacoes: variacoes.length, total_clientes: clientes?.length || 0 }),
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
