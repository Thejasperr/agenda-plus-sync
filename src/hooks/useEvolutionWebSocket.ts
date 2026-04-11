import { useEffect, useRef, useCallback, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';

const FUNCTION_URL = `https://ecqvukaxrjtanyhknrhe.supabase.co/functions/v1/evolution-api`;

export interface WebSocketMessage {
  event: string;
  data: any;
  instance?: string;
}

interface UseEvolutionWebSocketOptions {
  onMessage?: (msg: any) => void;
  onStatusChange?: (status: any) => void;
  onConnectionUpdate?: (connected: boolean) => void;
}

export function useEvolutionWebSocket(options: UseEvolutionWebSocketOptions) {
  const [wsConnected, setWsConnected] = useState(false);
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimerRef = useRef<ReturnType<typeof setTimeout>>();
  const optionsRef = useRef(options);
  optionsRef.current = options;

  const connect = useCallback(async () => {
    // Get WebSocket URL from edge function
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return;

    try {
      const res = await fetch(`${FUNCTION_URL}?action=getWebSocketInfo`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
          'apikey': 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVjcXZ1a2F4cmp0YW55aGtucmhlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTM0NTYzOTIsImV4cCI6MjA2OTAzMjM5Mn0.BTUl2z8j2QFCSVgmhWhGnWrVmcbXy_quRgi7cY5LD_o',
        },
        body: JSON.stringify({}),
      });

      if (!res.ok) {
        console.error('Failed to get WebSocket info');
        return;
      }

      const { wsUrl } = await res.json();
      if (!wsUrl) {
        console.error('No WebSocket URL returned');
        return;
      }

      // Close existing connection
      if (wsRef.current) {
        wsRef.current.close();
      }

      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;

      ws.onopen = () => {
        console.log('Evolution WebSocket connected');
        setWsConnected(true);
        optionsRef.current.onConnectionUpdate?.(true);
      };

      ws.onmessage = (event) => {
        try {
          const data: WebSocketMessage = JSON.parse(event.data);
          
          switch (data.event) {
            case 'messages.upsert':
              optionsRef.current.onMessage?.(data.data);
              break;
            case 'messages.update':
              optionsRef.current.onStatusChange?.(data.data);
              break;
            case 'connection.update':
              optionsRef.current.onConnectionUpdate?.(data.data?.state === 'open');
              break;
            default:
              // Other events like presence, typing, etc.
              break;
          }
        } catch (err) {
          console.error('WebSocket message parse error:', err);
        }
      };

      ws.onclose = () => {
        console.log('Evolution WebSocket disconnected');
        setWsConnected(false);
        optionsRef.current.onConnectionUpdate?.(false);
        // Auto-reconnect after 5s
        reconnectTimerRef.current = setTimeout(connect, 5000);
      };

      ws.onerror = (err) => {
        console.error('WebSocket error:', err);
        ws.close();
      };
    } catch (err) {
      console.error('WebSocket connect error:', err);
      reconnectTimerRef.current = setTimeout(connect, 5000);
    }
  }, []);

  const disconnect = useCallback(() => {
    if (reconnectTimerRef.current) {
      clearTimeout(reconnectTimerRef.current);
    }
    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }
    setWsConnected(false);
  }, []);

  useEffect(() => {
    connect();
    return () => disconnect();
  }, [connect, disconnect]);

  return { wsConnected, reconnect: connect, disconnect };
}
