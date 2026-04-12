import { useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';

const FUNCTION_URL = `https://ecqvukaxrjtanyhknrhe.supabase.co/functions/v1/evolution-api`;

async function callEvolution(action: string, body?: any) {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) throw new Error('Not authenticated');

  const res = await fetch(`${FUNCTION_URL}?action=${action}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${session.access_token}`,
      'apikey': 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVjcXZ1a2F4cmp0YW55aGtucmhlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTM0NTYzOTIsImV4cCI6MjA2OTAzMjM5Mn0.BTUl2z8j2QFCSVgmhWhGnWrVmcbXy_quRgi7cY5LD_o',
    },
    body: body ? JSON.stringify(body) : JSON.stringify({}),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || `API error: ${res.status}`);
  }

  return res.json();
}

export interface Chat {
  id: string;
  remoteJid: string;
  name?: string;
  lastMessage?: string;
  lastMessageTimestamp?: number;
  unreadCount?: number;
  profilePictureUrl?: string;
}

export interface Message {
  key: {
    remoteJid: string;
    fromMe: boolean;
    id: string;
  };
  message?: any;
  messageTimestamp?: number;
  pushName?: string;
  messageType?: string;
}

export function useEvolutionApi() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchChats = useCallback(async (): Promise<Chat[]> => {
    setLoading(true);
    setError(null);
    try {
      const data = await callEvolution('fetchChats');
      return Array.isArray(data) ? data : [];
    } catch (e: any) {
      setError(e.message);
      return [];
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchMessages = useCallback(async (remoteJid: string, limit = 50): Promise<Message[]> => {
    setLoading(true);
    setError(null);
    try {
      const data = await callEvolution('fetchMessages', { remoteJid, limit });
      const messages = Array.isArray(data) ? data : Array.isArray(data?.messages) ? data.messages : [];
      return messages;
    } catch (e: any) {
      setError(e.message);
      return [];
    } finally {
      setLoading(false);
    }
  }, []);

  const sendText = useCallback(async (number: string, text: string) => {
    setLoading(true);
    setError(null);
    try {
      return await callEvolution('sendText', { number, text });
    } catch (e: any) {
      setError(e.message);
      throw e;
    } finally {
      setLoading(false);
    }
  }, []);

  const sendMedia = useCallback(async (number: string, mediatype: 'image' | 'video' | 'document', media: string, caption?: string, fileName?: string) => {
    setLoading(true);
    setError(null);
    try {
      return await callEvolution('sendMedia', { number, mediatype, media, caption, fileName });
    } catch (e: any) {
      setError(e.message);
      throw e;
    } finally {
      setLoading(false);
    }
  }, []);

  const sendAudio = useCallback(async (number: string, audio: string) => {
    setLoading(true);
    setError(null);
    try {
      return await callEvolution('sendAudio', { number, audio });
    } catch (e: any) {
      setError(e.message);
      throw e;
    } finally {
      setLoading(false);
    }
  }, []);

  const checkConnection = useCallback(async () => {
    try {
      return await callEvolution('connectionState');
    } catch (e: any) {
      setError(e.message);
      return null;
    }
  }, []);

  const fetchProfilePicture = useCallback(async (number: string): Promise<string | null> => {
    try {
      const data = await callEvolution('fetchProfilePicture', { number });
      if (data?.profilePictureUrl && typeof data.profilePictureUrl === 'string') {
        return data.profilePictureUrl;
      }
      if (data?.picture && typeof data.picture === 'string') {
        return data.picture;
      }
      if (typeof data === 'string' && data.startsWith('http')) {
        return data;
      }
      return null;
    } catch {
      return null;
    }
  }, []);

  return {
    loading,
    error,
    fetchChats,
    fetchMessages,
    sendText,
    sendMedia,
    sendAudio,
    checkConnection,
    fetchProfilePicture,
  };
}
