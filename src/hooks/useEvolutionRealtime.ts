import { useState, useCallback, useEffect, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';

const FUNCTION_URL = `https://ecqvukaxrjtanyhknrhe.supabase.co/functions/v1/evolution-api`;

interface UseEvolutionRealtimeOptions {
  onMessage?: (msg: any) => void;
  onStatusChange?: (status: any) => void;
  onConnectionUpdate?: (connected: boolean) => void;
}

export function useEvolutionRealtime(options: UseEvolutionRealtimeOptions) {
  const [realtimeConnected, setRealtimeConnected] = useState(false);
  const optionsRef = useRef(options);
  const webhookSetRef = useRef(false);
  optionsRef.current = options;

  // Setup webhook on mount
  useEffect(() => {
    if (webhookSetRef.current) return;
    webhookSetRef.current = true;

    const setupWebhook = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      const userId = session.user.id;
      // Use Evolution API key as webhook token
      const supabaseUrl = 'https://ecqvukaxrjtanyhknrhe.supabase.co';
      
      try {
        // Get the API key to use as token
        const res = await fetch(`${FUNCTION_URL}?action=getWebhookToken`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${session.access_token}`,
            'apikey': 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVjcXZ1a2F4cmp0YW55aGtucmhlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTM0NTYzOTIsImV4cCI6MjA2OTAzMjM5Mn0.BTUl2z8j2QFCSVgmhWhGnWrVmcbXy_quRgi7cY5LD_o',
          },
          body: JSON.stringify({}),
        });

        if (!res.ok) {
          console.error('Failed to get webhook token');
          return;
        }

        const { token } = await res.json();
        const webhookUrl = `${supabaseUrl}/functions/v1/evolution-webhook?user_id=${userId}&token=${token}`;

        // Set webhook on Evolution API
        const setRes = await fetch(`${FUNCTION_URL}?action=setWebhook`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${session.access_token}`,
            'apikey': 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVjcXZ1a2F4cmp0YW55aGtucmhlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTM0NTYzOTIsImV4cCI6MjA2OTAzMjM5Mn0.BTUl2z8j2QFCSVgmhWhGnWrVmcbXy_quRgi7cY5LD_o',
          },
          body: JSON.stringify({ webhookUrl }),
        });

        if (setRes.ok) {
          console.log('Webhook configured successfully');
        } else {
          console.error('Failed to set webhook:', await setRes.text());
        }
      } catch (err) {
        console.error('Webhook setup error:', err);
      }
    };

    setupWebhook();
  }, []);

  // Subscribe to Supabase Realtime for whatsapp_events
  useEffect(() => {
    let userId: string | null = null;

    const setupRealtime = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;
      userId = session.user.id;

      const channel = supabase
        .channel('whatsapp-events')
        .on(
          'postgres_changes',
          {
            event: 'INSERT',
            schema: 'public',
            table: 'whatsapp_events',
            filter: `user_id=eq.${userId}`,
          },
          (payload) => {
            const event = payload.new as any;
            if (!event) return;

            setRealtimeConnected(true);

            switch (event.event_type) {
              case 'messages.upsert':
                optionsRef.current.onMessage?.(event.data);
                break;
              case 'messages.update':
                optionsRef.current.onStatusChange?.(event.data);
                break;
              case 'connection.update':
                optionsRef.current.onConnectionUpdate?.(event.data?.state === 'open');
                break;
            }
          }
        )
        .subscribe((status) => {
          console.log('Realtime subscription status:', status);
          setRealtimeConnected(status === 'SUBSCRIBED');
        });

      return () => {
        supabase.removeChannel(channel);
      };
    };

    const cleanup = setupRealtime();
    return () => {
      cleanup.then(fn => fn?.());
    };
  }, []);

  return { realtimeConnected };
}
