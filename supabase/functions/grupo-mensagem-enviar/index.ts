// Envia a mensagem reestruturada (texto + mídias opcionais) para um grupo via Evolution API
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY')!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const EVOLUTION_API_URL = Deno.env.get('EVOLUTION_API_URL')!;
const EVOLUTION_API_KEY = Deno.env.get('EVOLUTION_API_KEY')!;
const EVOLUTION_INSTANCE = Deno.env.get('EVOLUTION_INSTANCE_NAME')!;

type EvoCfg = { url: string; instance: string; key: string };

async function loadEvoConfig(admin: any, userId: string): Promise<EvoCfg> {
  const { data } = await admin
    .from('evolution_config')
    .select('api_url, instance_name, api_key')
    .eq('user_id', userId)
    .maybeSingle();
  return {
    url: (data?.api_url || EVOLUTION_API_URL || '').replace(/\/$/, ''),
    instance: data?.instance_name || EVOLUTION_INSTANCE,
    key: data?.api_key || EVOLUTION_API_KEY,
  };
}

async function evoSend(cfg: EvoCfg, path: string, body: Record<string, unknown>) {
  const r = await fetch(`${cfg.url}${path}/${cfg.instance}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', apikey: cfg.key },
    body: JSON.stringify(body),
  });
  const text = await r.text();
  if (!r.ok) throw new Error(`Evolution ${r.status}: ${text}`);
  try { return JSON.parse(text); } catch { return { raw: text }; }
}

const delay = (ms: number) => new Promise(res => setTimeout(res, ms));

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

    const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    const userClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: userData, error: userError } = await userClient.auth.getUser();
    if (userError || !userData.user) {
      return new Response(JSON.stringify({ error: 'Usuário inválido' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const userId = userData.user.id;
    const body = await req.json();
    const mensagemId = String(body.mensagem_id || '');
    const remoteJid = String(body.remote_jid || '');

    if (!mensagemId || !remoteJid) {
      return new Response(JSON.stringify({ error: 'mensagem_id e remote_jid são obrigatórios' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Carrega a mensagem
    const { data: msg, error: msgErr } = await admin
      .from('grupos_mensagens')
      .select('*')
      .eq('id', mensagemId)
      .eq('user_id', userId)
      .maybeSingle();

    if (msgErr || !msg) throw new Error('Mensagem não encontrada');
    if (!msg.mensagem_reestruturada) throw new Error('Mensagem ainda não foi reestruturada');

    // Carrega mídias
    const { data: midias } = await admin
      .from('grupos_mensagens_midias')
      .select('*')
      .eq('mensagem_id', mensagemId)
      .order('ordem', { ascending: true });

    await admin
      .from('grupos_mensagens')
      .update({ status: 'enviando', grupo_remote_jid: remoteJid })
      .eq('id', mensagemId);

    const number = remoteJid.split('@')[0];
    const texto = msg.mensagem_reestruturada;

    try {
      if (!midias || midias.length === 0) {
        // Apenas texto
        await evoSend('/message/sendText', { number, text: texto });
      } else {
        // 1ª mídia leva a legenda; demais sem legenda
        for (let i = 0; i < midias.length; i++) {
          const m = midias[i];
          const isFirst = i === 0;
          await evoSend('/message/sendMedia', {
            number,
            mediatype: m.media_type, // image | video
            media: m.media_url,
            caption: isFirst ? texto : '',
            fileName: m.media_filename || `file_${i + 1}`,
          });
          if (i < midias.length - 1) await delay(800);
        }
      }

      await admin
        .from('grupos_mensagens')
        .update({
          status: 'enviado',
          enviado_at: new Date().toISOString(),
        })
        .eq('id', mensagemId);

      // Tenta achar o chat correspondente para registrar a mensagem localmente
      const { data: chat } = await admin
        .from('whatsapp_chats')
        .select('id')
        .eq('user_id', userId)
        .eq('remote_jid', remoteJid)
        .maybeSingle();

      if (chat) {
        // Registra localmente para aparecer na conversa
        await admin.from('whatsapp_messages').insert({
          user_id: userId,
          chat_id: chat.id,
          remote_jid: remoteJid,
          message_id: crypto.randomUUID(),
          from_me: true,
          message_type: midias && midias.length > 0 ? midias[0].media_type : 'text',
          content: midias && midias.length > 0 ? null : texto,
          caption: midias && midias.length > 0 ? texto : null,
          media_url: midias && midias.length > 0 ? midias[0].media_url : null,
          media_mime_type: midias && midias.length > 0 ? midias[0].media_mime : null,
          timestamp: new Date().toISOString(),
          status: 'sent',
        });

        await admin
          .from('whatsapp_chats')
          .update({
            last_message: midias && midias.length > 0 ? `[${midias[0].media_type}] ${texto.slice(0, 60)}` : texto.slice(0, 80),
            last_message_at: new Date().toISOString(),
          })
          .eq('id', chat.id);
      }

      return new Response(
        JSON.stringify({ success: true, mensagem_id: mensagemId }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    } catch (sendErr) {
      const msgErro = sendErr instanceof Error ? sendErr.message : 'Erro no envio';
      await admin
        .from('grupos_mensagens')
        .update({ status: 'erro', erro: msgErro })
        .eq('id', mensagemId);
      throw sendErr;
    }
  } catch (error) {
    console.error('Erro:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Erro desconhecido' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  }
});
