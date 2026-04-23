// Recebe um exemplo de mensagem do usuário e envia ao webhook n8n para reestruturar
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

    const admin = createClient(
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
    const mensagemOriginal = String(body.mensagem_original || '').trim();
    const grupoRemoteJid = body.grupo_remote_jid ? String(body.grupo_remote_jid) : null;
    const grupoNome = body.grupo_nome ? String(body.grupo_nome) : null;

    if (!mensagemOriginal || mensagemOriginal.length < 3) {
      return new Response(JSON.stringify({ error: 'Mensagem muito curta' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Cria registro com status "gerando"
    const { data: msg, error: insertError } = await admin
      .from('grupos_mensagens')
      .insert({
        user_id: userId,
        mensagem_original: mensagemOriginal,
        grupo_remote_jid: grupoRemoteJid,
        grupo_nome: grupoNome,
        status: 'gerando',
      })
      .select()
      .single();

    if (insertError) throw insertError;

    // Busca a URL do webhook n8n configurada
    const { data: config } = await admin
      .from('grupos_mensagens_config')
      .select('webhook_url')
      .eq('user_id', userId)
      .maybeSingle();

    const webhookUrl = config?.webhook_url?.trim();

    if (!webhookUrl) {
      await admin
        .from('grupos_mensagens')
        .update({ status: 'erro', erro: 'Webhook do n8n não configurado em Configurações' })
        .eq('id', msg.id);
      return new Response(
        JSON.stringify({ error: 'Webhook do n8n não configurado. Vá em Config > Grupos para adicionar.' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    // Chama o webhook do n8n
    let mensagemReestruturada = '';
    try {
      const webhookRes = await fetch(webhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mensagem_id: msg.id,
          user_id: userId,
          mensagem_original: mensagemOriginal,
          grupo_nome: grupoNome,
        }),
      });

      const text = await webhookRes.text();
      let parsed: any = null;
      try { parsed = JSON.parse(text); } catch { /* ignore */ }

      // Aceita múltiplos formatos de resposta
      if (typeof parsed === 'string') {
        mensagemReestruturada = parsed;
      } else if (parsed) {
        mensagemReestruturada =
          parsed.mensagem_reestruturada ||
          parsed.mensagem ||
          parsed.message ||
          parsed.text ||
          parsed.output ||
          (Array.isArray(parsed) && parsed[0]
            ? (parsed[0].mensagem_reestruturada || parsed[0].mensagem || parsed[0].message || parsed[0].text || parsed[0].output || '')
            : '');
      } else if (text && text.trim()) {
        // Se o webhook retornou texto puro
        mensagemReestruturada = text.trim();
      }
    } catch (e) {
      console.error('Erro ao chamar webhook n8n:', e);
    }

    if (mensagemReestruturada) {
      await admin
        .from('grupos_mensagens')
        .update({
          mensagem_reestruturada: mensagemReestruturada,
          status: 'pronto',
        })
        .eq('id', msg.id);

      return new Response(
        JSON.stringify({
          success: true,
          mensagem_id: msg.id,
          mensagem_reestruturada: mensagemReestruturada,
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    } else {
      await admin
        .from('grupos_mensagens')
        .update({ status: 'erro', erro: 'Webhook n8n não retornou mensagem reestruturada' })
        .eq('id', msg.id);

      return new Response(
        JSON.stringify({ error: 'Webhook n8n não retornou mensagem reestruturada' }),
        { status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }
  } catch (error) {
    console.error('Erro:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Erro desconhecido' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  }
});
