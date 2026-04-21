import { useEffect, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';

/**
 * Subscribes to realtime changes on `agendamentos`, `transacoes` and `clientes`
 * tables and invokes `onChange` whenever any of them change.
 *
 * Used so that confirming an appointment / payment in one screen
 * (Dashboard, Calendário, WhatsApp, Clientes, etc.) instantly
 * refreshes every other screen that lists the same data.
 */
export function useAgendamentosRealtime(onChange: () => void) {
  const callbackRef = useRef(onChange);

  // Keep latest callback without re-subscribing
  useEffect(() => {
    callbackRef.current = onChange;
  }, [onChange]);

  useEffect(() => {
    const channel = supabase
      .channel(`agendamentos-sync-${Math.random().toString(36).slice(2)}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'agendamentos' }, () => callbackRef.current())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'transacoes' }, () => callbackRef.current())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'clientes' }, () => callbackRef.current())
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);
}
