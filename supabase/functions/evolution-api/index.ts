import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Auth check
    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const EVOLUTION_API_URL = Deno.env.get('EVOLUTION_API_URL');
    const EVOLUTION_API_KEY = Deno.env.get('EVOLUTION_API_KEY');
    const EVOLUTION_INSTANCE_NAME = Deno.env.get('EVOLUTION_INSTANCE_NAME');

    if (!EVOLUTION_API_URL || !EVOLUTION_API_KEY || !EVOLUTION_INSTANCE_NAME) {
      return new Response(JSON.stringify({ error: 'Evolution API not configured' }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const url = new URL(req.url);
    const action = url.searchParams.get('action');

    const baseUrl = EVOLUTION_API_URL.replace(/\/$/, '');
    const headers = {
      'Content-Type': 'application/json',
      'apikey': EVOLUTION_API_KEY,
    };

    let response: Response;

    switch (action) {
      case 'fetchChats': {
        response = await fetch(`${baseUrl}/chat/findChats/${EVOLUTION_INSTANCE_NAME}`, {
          method: 'POST',
          headers,
          body: JSON.stringify({}),
        });
        break;
      }

      case 'fetchMessages': {
        const body = await req.json();
        const remoteJid = body.remoteJid;
        if (!remoteJid) {
          return new Response(JSON.stringify({ error: 'remoteJid is required' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
        }
        response = await fetch(`${baseUrl}/chat/findMessages/${EVOLUTION_INSTANCE_NAME}`, {
          method: 'POST',
          headers,
          body: JSON.stringify({
            where: { key: { remoteJid } },
            limit: body.limit || 50,
          }),
        });
        break;
      }

      case 'sendText': {
        const body = await req.json();
        if (!body.number || !body.text) {
          return new Response(JSON.stringify({ error: 'number and text are required' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
        }
        response = await fetch(`${baseUrl}/message/sendText/${EVOLUTION_INSTANCE_NAME}`, {
          method: 'POST',
          headers,
          body: JSON.stringify({
            number: body.number,
            text: body.text,
          }),
        });
        break;
      }

      case 'sendMedia': {
        const body = await req.json();
        if (!body.number || !body.mediatype || !body.media) {
          return new Response(JSON.stringify({ error: 'number, mediatype and media are required' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
        }
        response = await fetch(`${baseUrl}/message/sendMedia/${EVOLUTION_INSTANCE_NAME}`, {
          method: 'POST',
          headers,
          body: JSON.stringify({
            number: body.number,
            mediatype: body.mediatype,
            media: body.media,
            caption: body.caption || '',
            fileName: body.fileName || '',
          }),
        });
        break;
      }

      case 'sendAudio': {
        const body = await req.json();
        if (!body.number || !body.audio) {
          return new Response(JSON.stringify({ error: 'number and audio are required' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
        }
        response = await fetch(`${baseUrl}/message/sendWhatsAppAudio/${EVOLUTION_INSTANCE_NAME}`, {
          method: 'POST',
          headers,
          body: JSON.stringify({
            number: body.number,
            audio: body.audio,
          }),
        });
        break;
      }

      case 'fetchContacts': {
        response = await fetch(`${baseUrl}/chat/findContacts/${EVOLUTION_INSTANCE_NAME}`, {
          method: 'POST',
          headers,
          body: JSON.stringify({}),
        });
        break;
      }

      case 'connectionState': {
        response = await fetch(`${baseUrl}/instance/connectionState/${EVOLUTION_INSTANCE_NAME}`, {
          method: 'GET',
          headers,
        });
        break;
      }

      case 'fetchProfilePicture': {
        const body = await req.json();
        if (!body.number) {
          return new Response(JSON.stringify({ error: 'number is required' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
        }
        response = await fetch(`${baseUrl}/chat/fetchProfilePictureUrl/${EVOLUTION_INSTANCE_NAME}`, {
          method: 'POST',
          headers,
          body: JSON.stringify({ number: body.number }),
        });
        break;
      }

      case 'getWebSocketInfo': {
        const wsBaseUrl = baseUrl.replace('https://', 'wss://').replace('http://', 'ws://');
        const wsUrl = `${wsBaseUrl}/ws/events/${EVOLUTION_INSTANCE_NAME}?apikey=${EVOLUTION_API_KEY}`;
        return new Response(JSON.stringify({ wsUrl }), {
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      case 'setWebhook': {
        const body = await req.json();
        const webhookUrl = body.webhookUrl;
        if (!webhookUrl) {
          return new Response(JSON.stringify({ error: 'webhookUrl is required' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
        }
        response = await fetch(`${baseUrl}/webhook/set/${EVOLUTION_INSTANCE_NAME}`, {
          method: 'POST',
          headers,
          body: JSON.stringify({
            url: webhookUrl,
            webhook_by_events: false,
            webhook_base64: false,
            events: [
              'MESSAGES_UPSERT',
              'MESSAGES_UPDATE',
              'CONNECTION_UPDATE',
            ],
          }),
        });
        break;
      }

      case 'getBase64FromMedia': {
        const body = await req.json();
        if (!body.messageId || !body.remoteJid) {
          return new Response(JSON.stringify({ error: 'messageId and remoteJid are required' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
        }
        response = await fetch(`${baseUrl}/chat/getBase64FromMediaMessage/${EVOLUTION_INSTANCE_NAME}`, {
          method: 'POST',
          headers,
          body: JSON.stringify({
            message: {
              key: {
                id: body.messageId,
                remoteJid: body.remoteJid,
                fromMe: body.fromMe ?? false,
              },
            },
            convertToMp4: body.convertToMp4 ?? false,
          }),
        });
        break;
      }

      default:
        return new Response(JSON.stringify({ error: 'Invalid action' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const data = await response.json();
    return new Response(JSON.stringify(data), {
      status: response.status,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Evolution API error:', error);
    return new Response(JSON.stringify({ error: 'Internal server error' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
