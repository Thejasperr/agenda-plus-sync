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

const MAX_RECONNECT_DELAY = 60000; // 60s max
const BASE_DELAY = 3000; // 3s initial
const MAX_RETRIES = 10;

export function useEvolutionWebSocket(options: UseEvolutionWebSocketOptions) {
  const [wsConnected, setWsConnected] = useState(false);
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimerRef = useRef<ReturnType<typeof setTimeout>>();
  const optionsRef = useRef(options);
  const retriesRef = useRef(0);
  const mountedRef = useRef(true);
  optionsRef.current = options;

  const connect = useCallback(async () => {
    if (!mountedRef.current) return;

    const { data: { session } } = await supabase.auth.getSession();
    if (!session || !mountedRef.current) return;

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

      if (!res.ok || !mountedRef.current) return;

      const { wsUrl } = await res.json();
      if (!wsUrl || !mountedRef.current) return;

      if (wsRef.current) {
        wsRef.current.close();
      }

      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;

      ws.onopen = () => {
        if (!mountedRef.current) return;
        console.log('Evolution WebSocket connected');
        setWsConnected(true);
        retriesRef.current = 0; // Reset retries on successful connection
        optionsRef.current.onConnectionUpdate?.(true);
      };

      ws.onmessage = (event) => {
        if (!mountedRef.current) return;
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
          }
        } catch (err) {
          console.error('WebSocket message parse error:', err);
        }
      };

      ws.onclose = () => {
        if (!mountedRef.current) return;
        console.log('Evolution WebSocket disconnected');
        setWsConnected(false);
        optionsRef.current.onConnectionUpdate?.(false);
        scheduleReconnect();
      };

      ws.onerror = () => {
        // Don't log full error object to avoid noise; onclose handles reconnect
        if (wsRef.current) {
          wsRef.current.close();
        }
      };
    } catch (err) {
      console.error('WebSocket connect error:', err);
      if (mountedRef.current) scheduleReconnect();
    }
  }, []);

  const scheduleReconnect = useCallback(() => {
    if (!mountedRef.current) return;
    if (retriesRef.current >= MAX_RETRIES) {
      console.log(`WebSocket: max retries (${MAX_RETRIES}) reached, stopping reconnection`);
      return;
    }
    // Exponential backoff with jitter
    const delay = Math.min(BASE_DELAY * Math.pow(2, retriesRef.current), MAX_RECONNECT_DELAY);
    const jitter = delay * 0.3 * Math.random();
    const finalDelay = delay + jitter;
    retriesRef.current += 1;
    console.log(`WebSocket: reconnecting in ${Math.round(finalDelay / 1000)}s (attempt ${retriesRef.current}/${MAX_RETRIES})`);
    reconnectTimerRef.current = setTimeout(connect, finalDelay);
  }, [connect]);

  const disconnect = useCallback(() => {
    mountedRef.current = false;
    if (reconnectTimerRef.current) {
      clearTimeout(reconnectTimerRef.current);
    }
    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }
    setWsConnected(false);
  }, []);

  const reconnect = useCallback(() => {
    retriesRef.current = 0;
    if (reconnectTimerRef.current) clearTimeout(reconnectTimerRef.current);
    connect();
  }, [connect]);

  useEffect(() => {
    mountedRef.current = true;
    connect();
    return () => disconnect();
  }, [connect, disconnect]);

  return { wsConnected, reconnect, disconnect };
}
