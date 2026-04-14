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
    const url = new URL(req.url);
    const userId = url.searchParams.get('user_id');
    const token = url.searchParams.get('token');

    // Validate webhook token
    const expectedToken = Deno.env.get('WEBHOOK_SECRET') || Deno.env.get('EVOLUTION_API_KEY');
    if (!token || token !== expectedToken) {
      console.error('Webhook: invalid token');
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (!userId) {
      console.error('Webhook: missing user_id');
      return new Response(JSON.stringify({ error: 'Missing user_id' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const body = await req.json();
    console.log('Webhook received:', JSON.stringify(body).substring(0, 200));

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    );

    // Determine event type and remote JID
    const event = body.event || 'unknown';
    let remoteJid = '';

    if (event === 'messages.upsert') {
      const msgData = body.data;
      remoteJid = msgData?.key?.remoteJid || '';
    } else if (event === 'connection.update') {
      remoteJid = '__connection__';
    } else if (event === 'messages.update') {
      const msgData = Array.isArray(body.data) ? body.data[0] : body.data;
      remoteJid = msgData?.key?.remoteJid || '';
    }

    // Insert event
    const { error: insertError } = await supabase.from('whatsapp_events').insert({
      user_id: userId,
      event_type: event,
      remote_jid: remoteJid,
      data: body.data || body,
    });

    if (insertError) {
      console.error('Webhook insert error:', insertError);
      return new Response(JSON.stringify({ error: 'Insert failed' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Clean up old events (older than 24h) for this user
    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    await supabase.from('whatsapp_events')
      .delete()
      .eq('user_id', userId)
      .lt('created_at', oneDayAgo);

    return new Response(JSON.stringify({ ok: true }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (err) {
    console.error('Webhook error:', err);
    return new Response(JSON.stringify({ error: 'Internal error' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
