import React, { useEffect, useMemo, useRef, useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import { Search, ArrowLeft, RefreshCw, MessageCircle, BadgeCheck, UserPlus, CalendarPlus, Send, Paperclip, Mic, Square, Image as ImageIcon, Video, FileText, Play, Pause, Download, Users as UsersIcon, User as UserIcon, Reply, Smile, X, Wallet, AlertCircle, CalendarCheck, Trash2, PenSquare, Sparkles } from 'lucide-react';
import GerarMensagemGrupoDialog from '@/components/GerarMensagemGrupoDialog';
import EmojiPicker, { EmojiStyle, Theme } from 'emoji-picker-react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { format, parseISO, isPast, isToday } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import ClienteInfoDialog from '@/components/ClienteInfoDialog';
import { useAgendamentosRealtime } from '@/hooks/useAgendamentosRealtime';

interface Chat {
  id: string;
  remote_jid: string;
  telefone: string;
  nome: string;
  cliente_id: string | null;
  profile_pic_url: string | null;
  last_message: string | null;
  last_message_at: string | null;
  unread_count: number;
}

interface Message {
  id: string;
  chat_id: string;
  message_id: string | null;
  from_me: boolean;
  message_type: string;
  content: string | null;
  caption: string | null;
  media_url: string | null;
  media_mime_type: string | null;
  media_duration: number | null;
  media_filename: string | null;
  quoted_message_id: string | null;
  timestamp: string;
  status: string;
}

interface Reaction {
  id: string;
  message_id: string;
  reactor_jid: string;
  from_me: boolean;
  emoji: string | null;
}

const WhatsAppPage: React.FC = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [chats, setChats] = useState<Chat[]>([]);
  const [activeChat, setActiveChat] = useState<Chat | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  // Reações por message_id (do WhatsApp)
  const [reactions, setReactions] = useState<Record<string, Reaction[]>>({});
  const [search, setSearch] = useState('');
  const [tab, setTab] = useState<'private' | 'group'>('private');
  const [loading, setLoading] = useState(true);
  const [text, setText] = useState('');
  const [recording, setRecording] = useState(false);
  const [addClienteOpen, setAddClienteOpen] = useState(false);
  const [novoClienteNome, setNovoClienteNome] = useState('');
  const [grupoMsgOpen, setGrupoMsgOpen] = useState(false);
  const [clienteInfoOpen, setClienteInfoOpen] = useState(false);
  const [replyTo, setReplyTo] = useState<Message | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Message | null>(null);
  const [novaConversaOpen, setNovaConversaOpen] = useState(false);
  const [novaConversaTab, setNovaConversaTab] = useState<'cliente' | 'numero'>('cliente');
  const [novaConversaSearch, setNovaConversaSearch] = useState('');
  const [novaConversaTelefone, setNovaConversaTelefone] = useState('');
  const [novaConversaNome, setNovaConversaNome] = useState('');
  const [clientesList, setClientesList] = useState<Array<{ id: string; nome: string; telefone: string }>>([]);
  const [iniciandoConversa, setIniciandoConversa] = useState(false);
  const [chatStatus, setChatStatus] = useState<Record<string, { credito: number; devendo: number; ativos: number }>>({});
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const stickerInputRef = useRef<HTMLInputElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const cancelRecordingRef = useRef(false);
  const activeChatRef = useRef<Chat | null>(null);
  useEffect(() => { activeChatRef.current = activeChat; }, [activeChat]);
  // Cache de mensagens por chat para troca instantânea
  const messagesCacheRef = useRef<Record<string, Message[]>>({});
  // Token de carregamento para descartar respostas obsoletas ao trocar de chat rapidamente
  const loadTokenRef = useRef(0);
  const [loadingMessages, setLoadingMessages] = useState(false);

  // Normaliza telefone para chave de comparação (últimos 8 dígitos)
  const phoneKey = (tel: string | null | undefined) => {
    const d = (tel || '').replace(/\D/g, '');
    return d.length >= 8 ? d.slice(-8) : d;
  };

  // Carrega status (crédito / devendo / agendamentos ativos) para todos os contatos da lista
  const loadChatStatus = async () => {
    if (!user) return;
    const [{ data: clientes }, { data: ags }] = await Promise.all([
      supabase.from('clientes').select('telefone, saldo_credito').eq('user_id', user.id),
      supabase.from('agendamentos').select('telefone, data_agendamento, status').eq('user_id', user.id),
    ]);

    const map: Record<string, { credito: number; devendo: number; ativos: number }> = {};

    (clientes || []).forEach((c: any) => {
      const k = phoneKey(c.telefone);
      if (!k) return;
      const saldo = Number(c.saldo_credito || 0);
      if (!map[k]) map[k] = { credito: 0, devendo: 0, ativos: 0 };
      map[k].credito += saldo > 0 ? saldo : 0;
      map[k].devendo += saldo < 0 ? Math.abs(saldo) : 0;
    });

    (ags || []).forEach((a: any) => {
      const k = phoneKey(a.telefone);
      if (!k) return;
      if (!map[k]) map[k] = { credito: 0, devendo: 0, ativos: 0 };
      const d = a.data_agendamento ? parseISO(a.data_agendamento) : null;
      const ativo = a.status !== 'Concluído' && a.status !== 'Cancelado' && d && (isToday(d) || !isPast(d));
      if (ativo) map[k].ativos += 1;
      // Pendência financeira: passou e não foi concluído/cancelado
      const pendenteFin = a.status !== 'Concluído' && a.status !== 'Cancelado' && d && isPast(d) && !isToday(d);
      if (pendenteFin) {
        // soma simbólica para sinalizar pendência (não temos preço aqui, só um flag)
        map[k].devendo += 0.0001;
      }
    });

    setChatStatus(map);
  };

  useEffect(() => { loadChatStatus(); }, [user]);

  // Recarrega status quando agendamentos / clientes / transações mudarem
  useAgendamentosRealtime(() => { loadChatStatus(); });

  // Carregar chats
  const loadChats = async () => {
    if (!user) return;
    const { data, error } = await supabase
      .from('whatsapp_chats')
      .select('*')
      .eq('user_id', user.id)
      .order('last_message_at', { ascending: false, nullsFirst: false })
      .limit(200);
    if (error) { console.error(error); return; }
    setChats(data || []);
    setLoading(false);
  };

  useEffect(() => { loadChats(); }, [user]);

  // Sort chats: mais recentes no topo, sempre
  const sortChats = (list: Chat[]) =>
    [...list].sort((a, b) => {
      const ta = a.last_message_at ? new Date(a.last_message_at).getTime() : 0;
      const tb = b.last_message_at ? new Date(b.last_message_at).getTime() : 0;
      return tb - ta;
    });

  // Realtime chats (UPDATE/INSERT/DELETE)
  useEffect(() => {
    if (!user) return;
    const ch = supabase.channel('wa-chats')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'whatsapp_chats', filter: `user_id=eq.${user.id}` }, (payload) => {
        setChats((prev) => {
          if (payload.eventType === 'DELETE') {
            return prev.filter(c => c.id !== (payload.old as any).id);
          }
          const next = payload.new as Chat;
          const exists = prev.some(c => c.id === next.id);
          const merged = exists ? prev.map(c => c.id === next.id ? { ...c, ...next } : c) : [next, ...prev];
          return sortChats(merged);
        });
      })
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [user]);

  // Realtime global de mensagens — empurra o chat correspondente para o topo imediatamente
  useEffect(() => {
    if (!user) return;
    const ch = supabase.channel('wa-msgs-global')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'whatsapp_messages', filter: `user_id=eq.${user.id}` }, (payload) => {
        const msg = payload.new as Message;
        setChats((prev) => {
          const idx = prev.findIndex(c => c.id === msg.chat_id);
          if (idx === -1) return prev;
          const updated = {
            ...prev[idx],
            last_message: msg.content || msg.caption || `[${msg.message_type}]`,
            last_message_at: msg.timestamp,
            unread_count: msg.from_me || activeChatRef.current?.id === msg.chat_id
              ? prev[idx].unread_count
              : (prev[idx].unread_count || 0) + 1,
          };
          const without = prev.filter((_, i) => i !== idx);
          return [updated, ...without];
        });
      })
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [user]);

  // Colunas explícitas (evita trazer raw_data jsonb pesado)
  const MSG_COLS = 'id,chat_id,message_id,from_me,message_type,content,caption,media_url,media_mime_type,media_duration,media_filename,quoted_message_id,timestamp,status';

  // Carregar mensagens (com cache por chat e descarte de respostas obsoletas)
  // Estratégia: busca 50 msgs primeiro (rápido), exibe, depois completa até 80 em background
  const loadMessages = async (chatId: string, token: number) => {
    try {
      const { data, error } = await supabase
        .from('whatsapp_messages')
        .select(MSG_COLS)
        .eq('chat_id', chatId)
        .order('timestamp', { ascending: false })
        .limit(50);
      if (token !== loadTokenRef.current) return;
      if (error) {
        console.error('Erro ao carregar mensagens:', error);
        setLoadingMessages(false);
        return;
      }
      const ordered = (data || []).slice().reverse() as Message[];
      messagesCacheRef.current[chatId] = ordered;
      setMessages(ordered);
      setLoadingMessages(false);
      setTimeout(() => messagesEndRef.current?.scrollIntoView({ behavior: 'auto' }), 30);
    } catch (e) {
      console.error('Falha em loadMessages:', e);
      if (token === loadTokenRef.current) setLoadingMessages(false);
    }
  };

  // Realtime messages do chat ativo
  useEffect(() => {
    if (!activeChat) return;
    const chatId = activeChat.id;
    const token = ++loadTokenRef.current;

    // Mostra cache imediatamente (se houver) e busca em background
    const cached = messagesCacheRef.current[chatId];
    if (cached) {
      setMessages(cached);
      setLoadingMessages(false);
      setTimeout(() => messagesEndRef.current?.scrollIntoView({ behavior: 'auto' }), 30);
    } else {
      setMessages([]);
      setLoadingMessages(true);
    }
    loadMessages(chatId, token);

    // zerar unread
    supabase.from('whatsapp_chats').update({ unread_count: 0 }).eq('id', chatId).then();

    const ch = supabase.channel(`wa-msgs-${chatId}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'whatsapp_messages', filter: `chat_id=eq.${chatId}` }, (payload) => {
        // Ignora se o usuário já trocou de chat
        if (token !== loadTokenRef.current) return;
        const newMsg = payload.new as Message;
        setMessages((prev) => {
          if (prev.some(m => m.id === newMsg.id)) return prev;
          const next = [...prev, newMsg];
          messagesCacheRef.current[chatId] = next;
          return next;
        });
        setTimeout(() => messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 50);
      })
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [activeChat?.id]);

  // Carrega reações do chat ativo + realtime
  useEffect(() => {
    if (!activeChat || !user) return;
    const chatId = activeChat.id;
    let cancelled = false;
    (async () => {
      const { data } = await supabase
        .from('whatsapp_reactions')
        .select('id, message_id, reactor_jid, from_me, emoji')
        .eq('user_id', user.id)
        .eq('chat_id', chatId);
      if (cancelled) return;
      const map: Record<string, Reaction[]> = {};
      (data || []).forEach((r: any) => {
        if (!r.emoji) return;
        if (!map[r.message_id]) map[r.message_id] = [];
        map[r.message_id].push(r);
      });
      setReactions(map);
    })();

    const ch = supabase.channel(`wa-reactions-${chatId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'whatsapp_reactions', filter: `chat_id=eq.${chatId}` }, (payload) => {
        setReactions((prev) => {
          const next = { ...prev };
          if (payload.eventType === 'DELETE') {
            const old = payload.old as any;
            const arr = (next[old.message_id] || []).filter(r => r.id !== old.id);
            if (arr.length) next[old.message_id] = arr; else delete next[old.message_id];
            return next;
          }
          const r = payload.new as Reaction;
          const arr = (next[r.message_id] || []).filter(x => x.reactor_jid !== r.reactor_jid);
          if (r.emoji) arr.push(r);
          if (arr.length) next[r.message_id] = arr; else delete next[r.message_id];
          return next;
        });
      })
      .subscribe();
    return () => { cancelled = true; supabase.removeChannel(ch); };
  }, [activeChat?.id, user]);

  // Envia/remove reação a uma mensagem (otimista)
  const sendReaction = useCallback((msg: Message, emoji: string) => {
    if (!activeChatRef.current || !msg.message_id || !user) return;
    const chat = activeChatRef.current;
    const reactorJid = `me@${user.id}`;
    // Otimista
    setReactions((prev) => {
      const next = { ...prev };
      const arr = (next[msg.message_id!] || []).filter(r => r.reactor_jid !== reactorJid);
      if (emoji) {
        arr.push({ id: 'tmp-' + Date.now(), message_id: msg.message_id!, reactor_jid: reactorJid, from_me: true, emoji });
      }
      if (arr.length) next[msg.message_id!] = arr; else delete next[msg.message_id!];
      return next;
    });
    supabase.functions.invoke('whatsapp-react', {
      body: {
        chat_id: chat.id,
        remote_jid: chat.remote_jid,
        message_id: msg.message_id,
        from_me: msg.from_me,
        emoji,
      },
    }).then(({ error }) => {
      if (error) toast({ title: 'Erro ao reagir', description: error.message, variant: 'destructive' });
    });
  }, [user, toast]);

  // Estado centralizado do picker de emoji completo (fora dos bubbles para não recriar)
  const [fullEmojiPickerFor, setFullEmojiPickerFor] = useState<Message | null>(null);
  const handleOpenFullPicker = useCallback((m: Message) => setFullEmojiPickerFor(m), []);
  const handleReplyTo = useCallback((m: Message) => setReplyTo(m), []);
  const handleDeleteTarget = useCallback((m: Message) => setDeleteTarget(m), []);

  // Índice O(1) por message_id (evita messages.find a cada bubble — era O(n²))
  const messagesByMessageId = useMemo(() => {
    const map: Record<string, Message> = {};
    for (const m of messages) {
      if (m.message_id) map[m.message_id] = m;
    }
    return map;
  }, [messages]);


  const isGroup = (jid: string) => jid?.endsWith('@g.us');
  // Rejeita JIDs internos do WhatsApp (@lid, @broadcast) que não são telefones reais
  const isValidJid = (jid: string) => {
    if (!jid) return false;
    if (jid.includes('@lid')) return false;
    if (jid.includes('@broadcast')) return false;
    return true;
  };
  // Valida telefone: BR usa 12-13 dígitos (55+DDD+8/9). Aceita 10-13 para cobrir internacionais comuns.
  const isValidPhone = (tel: string) => {
    if (!tel) return false;
    const digits = tel.replace(/\D/g, '');
    if (digits.length < 10 || digits.length > 13) return false;
    if (/^(\d)\1+$/.test(digits)) return false;
    return true;
  };
  const validChats = chats.filter(c => isValidJid(c.remote_jid) && (isGroup(c.remote_jid) || isValidPhone(c.telefone)));
  const privateChats = validChats.filter(c => !isGroup(c.remote_jid));
  const groupChats = validChats.filter(c => isGroup(c.remote_jid));
  const baseList = tab === 'private' ? privateChats : groupChats;
  const filteredChats = baseList.filter(c =>
    c.nome?.toLowerCase().includes(search.toLowerCase()) ||
    c.telefone?.includes(search)
  );

  // Sincronizar com Evolution
  const handleSync = async () => {
    setLoading(true);
    const { data, error } = await supabase.functions.invoke('whatsapp-sync', { body: {} });
    setLoading(false);
    if (error) {
      toast({ title: 'Erro ao sincronizar', description: error.message, variant: 'destructive' });
      return;
    }
    toast({ title: 'Sincronizado', description: `${data?.inserted || 0} novas conversas` });
    loadChats();
  };

  // Enviar texto — não bloqueia o input. Permite enviar várias em sequência.
  const sendText = () => {
    if (!text.trim() || !activeChat) return;
    const content = text;
    const quoted = replyTo;
    setText('');
    setReplyTo(null);
    supabase.functions.invoke('whatsapp-send', {
      body: {
        chat_id: activeChat.id,
        remote_jid: activeChat.remote_jid,
        type: 'text',
        content,
        quoted: quoted ? { message_id: quoted.message_id, from_me: quoted.from_me, content: quoted.content, caption: quoted.caption } : undefined,
      },
    }).then(({ error }) => {
      if (error) toast({ title: 'Erro ao enviar', description: error.message, variant: 'destructive' });
    });
  };

  // Enviar arquivo — não bloqueia. Suporta sticker, gif, image, video, audio, document.
  const sendFile = (file: File, opts?: { asSticker?: boolean }) => {
    if (!activeChat) return;
    const quoted = replyTo;
    setReplyTo(null);
    const reader = new FileReader();
    reader.onload = () => {
      const base64 = (reader.result as string).split(',')[1];
      let type: 'image' | 'video' | 'document' | 'audio' | 'sticker' = 'document';
      if (opts?.asSticker) type = 'sticker';
      else if (file.type.startsWith('image/')) type = 'image';
      else if (file.type.startsWith('video/')) type = 'video';
      else if (file.type.startsWith('audio/')) type = 'audio';

      supabase.functions.invoke('whatsapp-send', {
        body: {
          chat_id: activeChat.id, remote_jid: activeChat.remote_jid, type,
          media_base64: base64, media_mime: file.type, filename: file.name,
          quoted: quoted ? { message_id: quoted.message_id, from_me: quoted.from_me, content: quoted.content, caption: quoted.caption } : undefined,
        },
      }).then(({ error }) => {
        if (error) toast({ title: 'Erro ao enviar', description: error.message, variant: 'destructive' });
      });
    };
    reader.readAsDataURL(file);
  };

  // Gravação áudio — chamada DIRETO do clique (preserva o gesto do usuário)
  const startRecording = () => {
    if (!navigator.mediaDevices?.getUserMedia) {
      toast({
        title: 'Recurso indisponível',
        description: 'Seu navegador não suporta gravação. Use o app instalado (PWA) ou o Chrome/Safari atualizado.',
        variant: 'destructive',
      });
      return;
    }

    // Inicia a chamada SINCRONAMENTE dentro do gesto, depois trata o promise
    navigator.mediaDevices
      .getUserMedia({ audio: true })
      .then((stream) => {
        // Escolhe o melhor mimeType suportado (Safari iOS prefere mp4)
        const candidates = ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4', 'audio/aac'];
        const mimeType = candidates.find((m) =>
          typeof MediaRecorder !== 'undefined' && MediaRecorder.isTypeSupported?.(m)
        );

        let mr: MediaRecorder;
        try {
          mr = mimeType ? new MediaRecorder(stream, { mimeType }) : new MediaRecorder(stream);
        } catch (err) {
          console.error('MediaRecorder error:', err);
          stream.getTracks().forEach((t) => t.stop());
          toast({
            title: 'Erro ao iniciar gravação',
            description: 'Formato de áudio não suportado neste dispositivo.',
            variant: 'destructive',
          });
          return;
        }

        cancelRecordingRef.current = false;
        audioChunksRef.current = [];
        mr.ondataavailable = (e) => {
          if (e.data.size) audioChunksRef.current.push(e.data);
        };
        mr.onstop = async () => {
          const type = mr.mimeType || 'audio/webm';
          const ext = type.includes('mp4') ? 'm4a' : 'webm';
          const chunks = audioChunksRef.current;
          stream.getTracks().forEach((t) => t.stop());
          audioChunksRef.current = [];
          if (cancelRecordingRef.current) {
            cancelRecordingRef.current = false;
            return; // descartado
          }
          const blob = new Blob(chunks, { type });
          const file = new File([blob], `audio-${Date.now()}.${ext}`, { type });
          await sendFile(file);
        };
        mr.onerror = (e) => {
          console.error('Recorder error:', e);
          stream.getTracks().forEach((t) => t.stop());
          setRecording(false);
          toast({ title: 'Erro na gravação', variant: 'destructive' });
        };
        mr.start();
        mediaRecorderRef.current = mr;
        setRecording(true);
      })
      .catch((err: any) => {
        console.error('getUserMedia error:', err);
        let description = 'Não foi possível acessar o microfone.';
        if (err?.name === 'NotAllowedError') {
          description = 'Permissão negada. Habilite o microfone nas configurações do navegador/app.';
        } else if (err?.name === 'NotFoundError') {
          description = 'Nenhum microfone encontrado neste dispositivo.';
        } else if (err?.name === 'NotReadableError') {
          description = 'Microfone em uso por outro aplicativo.';
        } else if (err?.name === 'SecurityError') {
          description = 'Acesso bloqueado. O app precisa estar em HTTPS.';
        }
        toast({ title: 'Microfone bloqueado', description, variant: 'destructive' });
      });
  };

  const stopRecording = () => {
    try {
      cancelRecordingRef.current = false;
      mediaRecorderRef.current?.stop();
    } catch (err) {
      console.error('stopRecording error:', err);
    }
    setRecording(false);
  };

  const cancelRecording = () => {
    try {
      cancelRecordingRef.current = true;
      mediaRecorderRef.current?.stop();
    } catch (err) {
      console.error('cancelRecording error:', err);
    }
    setRecording(false);
    toast({ title: 'Gravação cancelada' });
  };

  // Excluir mensagem (apenas mensagens enviadas pelo usuário)
  const deleteMessage = async (msg: Message) => {
    // Otimista: remove da UI imediatamente
    setMessages((prev) => prev.filter((m) => m.id !== msg.id));
    const { error } = await supabase.functions.invoke('whatsapp-delete', {
      body: { message_db_id: msg.id },
    });
    if (error) {
      toast({ title: 'Erro ao excluir', description: error.message, variant: 'destructive' });
      // Recarrega para restaurar caso falhe
      if (activeChat) {
        delete messagesCacheRef.current[activeChat.id];
        loadMessages(activeChat.id, ++loadTokenRef.current);
      }
      return;
    }
    toast({ title: 'Mensagem excluída' });
  };

  // Procura um cliente existente pelo telefone (compara últimos 8 dígitos)
  const findExistingCliente = async (telefone: string): Promise<string | null> => {
    if (!user) return null;
    const digits = telefone.replace(/\D/g, '');
    if (digits.length < 8) return null;
    const tail = digits.slice(-8);
    const { data } = await supabase
      .from('clientes')
      .select('id, telefone')
      .eq('user_id', user.id);
    const match = (data || []).find((c: any) => (c.telefone || '').replace(/\D/g, '').slice(-8) === tail);
    return match?.id || null;
  };

  // Auto-vincula cliente existente ao chat ativo (se ainda não estiver vinculado)
  useEffect(() => {
    if (!activeChat || activeChat.cliente_id || !user) return;
    (async () => {
      const existingId = await findExistingCliente(activeChat.telefone);
      if (existingId) {
        await supabase.from('whatsapp_chats').update({ cliente_id: existingId }).eq('id', activeChat.id);
        setActiveChat((prev) => prev ? { ...prev, cliente_id: existingId } : prev);
      }
    })();
  }, [activeChat?.id, user]);

  // Adicionar como cliente
  const handleAddCliente = async () => {
    if (!activeChat || !user) return;
    const nomeFinal = novoClienteNome.trim() || activeChat.nome;
    if (!nomeFinal) {
      toast({ title: 'Nome obrigatório', variant: 'destructive' });
      return;
    }

    // Se já existe cliente com este telefone, apenas vincula ao chat
    const existingId = await findExistingCliente(activeChat.telefone);
    if (existingId) {
      await supabase.from('whatsapp_chats').update({ cliente_id: existingId, nome: nomeFinal }).eq('id', activeChat.id);
      setActiveChat({ ...activeChat, cliente_id: existingId, nome: nomeFinal });
      setAddClienteOpen(false);
      toast({ title: 'Cliente vinculado!', description: 'Este contato já estava cadastrado.' });
      loadChats();
      return;
    }

    const { data, error } = await supabase.from('clientes').insert({
      nome: nomeFinal, telefone: activeChat.telefone, user_id: user.id,
    }).select('id').single();
    if (error) { toast({ title: 'Erro', description: error.message, variant: 'destructive' }); return; }
    await supabase.from('whatsapp_chats').update({ cliente_id: data.id, nome: nomeFinal }).eq('id', activeChat.id);
    setActiveChat({ ...activeChat, cliente_id: data.id, nome: nomeFinal });
    setAddClienteOpen(false);
    toast({ title: 'Cliente adicionado!' });
    loadChats();
  };

  // Carrega clientes para o seletor de nova conversa
  const loadClientesForNovaConversa = async () => {
    if (!user) return;
    const { data } = await supabase
      .from('clientes')
      .select('id, nome, telefone')
      .eq('user_id', user.id)
      .order('nome', { ascending: true });
    setClientesList((data || []) as any);
  };

  // Inicia (ou reabre) uma conversa para um telefone informado
  const iniciarNovaConversa = async (telefone: string, nome: string) => {
    if (!user) return;
    const digits = telefone.replace(/\D/g, '');
    if (!isValidPhone(digits)) {
      toast({ title: 'Telefone inválido', description: 'Informe DDI+DDD+número (ex: 5511999998888).', variant: 'destructive' });
      return;
    }
    setIniciandoConversa(true);
    try {
      const remoteJid = `${digits}@s.whatsapp.net`;
      const { data: existing } = await supabase
        .from('whatsapp_chats')
        .select('*')
        .eq('user_id', user.id)
        .eq('remote_jid', remoteJid)
        .maybeSingle();

      let chat: Chat | null = existing as any;
      if (!chat) {
        const clienteId = await findExistingCliente(digits);
        const { data: created, error } = await supabase
          .from('whatsapp_chats')
          .insert({
            user_id: user.id,
            remote_jid: remoteJid,
            telefone: digits,
            nome: nome?.trim() || digits,
            cliente_id: clienteId,
          })
          .select('*')
          .single();
        if (error) throw error;
        chat = created as any;
      }

      setChats((prev) => {
        const idx = prev.findIndex((c) => c.id === chat!.id);
        if (idx === -1) return [chat as Chat, ...prev];
        const next = [...prev];
        next[idx] = { ...next[idx], ...(chat as Chat) };
        return next;
      });
      setActiveChat(chat);
      setTab('private');
      setNovaConversaOpen(false);
      setNovaConversaSearch('');
      setNovaConversaTelefone('');
      setNovaConversaNome('');
    } catch (e: any) {
      console.error(e);
      toast({ title: 'Erro ao iniciar conversa', description: e?.message, variant: 'destructive' });
    } finally {
      setIniciandoConversa(false);
    }
  };

  // Mobile back
  const showList = !activeChat;

  return (
    <div className="h-full min-h-0 flex bg-background overflow-hidden">
      {/* Lista chats */}
      <div className={`${showList ? 'flex' : 'hidden'} md:flex flex-col w-full md:w-80 md:border-r border-border min-h-0`}>
        <div className="p-2.5 sm:p-3 border-b border-border space-y-2 bg-card shrink-0">
          <div className="flex items-center gap-2">
            <h2 className="text-base sm:text-lg font-bold text-foreground flex-1">Conversas</h2>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => { loadClientesForNovaConversa(); setNovaConversaOpen(true); }}
              className="h-8 w-8 p-0"
              title="Nova conversa"
            >
              <PenSquare className="h-4 w-4" />
            </Button>
            <Button size="sm" variant="ghost" onClick={handleSync} disabled={loading} className="h-8 w-8 p-0" title="Sincronizar">
              <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            </Button>
          </div>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Buscar..." className="pl-9 h-9 sm:h-10" />
          </div>
          <Tabs value={tab} onValueChange={(v) => setTab(v as 'private' | 'group')}>
            <TabsList className="grid grid-cols-2 w-full">
              <TabsTrigger value="private" className="gap-1.5">
                <UserIcon className="h-3.5 w-3.5" />
                Privadas
                <span className="ml-1 text-[10px] bg-muted-foreground/20 rounded-full px-1.5">{privateChats.length}</span>
              </TabsTrigger>
              <TabsTrigger value="group" className="gap-1.5">
                <UsersIcon className="h-3.5 w-3.5" />
                Grupos
                <span className="ml-1 text-[10px] bg-muted-foreground/20 rounded-full px-1.5">{groupChats.length}</span>
              </TabsTrigger>
            </TabsList>
          </Tabs>
        </div>
        <ScrollArea className="flex-1 min-h-0">
          {filteredChats.length === 0 && !loading && (
            <div className="p-6 text-center text-sm text-muted-foreground">
              {tab === 'group' ? 'Nenhum grupo.' : 'Nenhuma conversa.'} Clique em <RefreshCw className="inline h-3 w-3" /> para sincronizar.
            </div>
          )}
          {filteredChats.map((chat) => {
            const status = chatStatus[phoneKey(chat.telefone)] || { credito: 0, devendo: 0, ativos: 0 };
            const temCredito = status.credito > 0;
            const temDevendo = status.devendo > 0;
            const temAtivos = status.ativos > 0;
            return (
              <button
                key={chat.id}
                onClick={() => setActiveChat(chat)}
                className={`w-full flex items-center gap-2.5 sm:gap-3 p-2.5 sm:p-3 hover:bg-muted/50 transition border-b border-border/50 text-left ${activeChat?.id === chat.id ? 'bg-muted' : ''}`}
              >
                <Avatar className="h-11 w-11 sm:h-12 sm:w-12 shrink-0">
                  <AvatarImage src={chat.profile_pic_url || undefined} />
                  <AvatarFallback className="bg-primary/10 text-primary">
                    {isGroup(chat.remote_jid) ? <UsersIcon className="h-5 w-5" /> : (chat.nome?.[0]?.toUpperCase() || '?')}
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1 flex-wrap">
                    <p className="font-semibold text-sm truncate text-foreground max-w-full">{chat.nome}</p>
                    {chat.cliente_id && <BadgeCheck className="h-3.5 w-3.5 text-primary shrink-0" />}
                    <TooltipProvider delayDuration={150}>
                      {temAtivos && (
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <span className="inline-flex items-center gap-0.5 text-[9px] sm:text-[10px] font-medium bg-blue-500/10 text-blue-700 border border-blue-500/30 rounded-full px-1 sm:px-1.5 py-0.5 shrink-0">
                              <CalendarCheck className="h-2.5 w-2.5" />
                              {status.ativos}
                            </span>
                          </TooltipTrigger>
                          <TooltipContent>{status.ativos} agendamento(s) ativo(s)</TooltipContent>
                        </Tooltip>
                      )}
                      {temCredito && (
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <span className="inline-flex items-center gap-0.5 text-[9px] sm:text-[10px] font-medium bg-green-500/10 text-green-700 border border-green-500/30 rounded-full px-1 sm:px-1.5 py-0.5 shrink-0">
                              <Wallet className="h-2.5 w-2.5" />
                              R$ {status.credito.toFixed(0)}
                            </span>
                          </TooltipTrigger>
                          <TooltipContent>Crédito a haver: R$ {status.credito.toFixed(2)}</TooltipContent>
                        </Tooltip>
                      )}
                      {temDevendo && (
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <span className="inline-flex items-center gap-0.5 text-[9px] sm:text-[10px] font-medium bg-destructive/10 text-destructive border border-destructive/30 rounded-full px-1 sm:px-1.5 py-0.5 shrink-0">
                              <AlertCircle className="h-2.5 w-2.5" />
                              {status.devendo >= 1 ? `R$ ${status.devendo.toFixed(0)}` : '!'}
                            </span>
                          </TooltipTrigger>
                          <TooltipContent>
                            {status.devendo >= 1
                              ? `Devendo: R$ ${status.devendo.toFixed(2)}`
                              : 'Possui agendamento pendente de pagamento'}
                          </TooltipContent>
                        </Tooltip>
                      )}
                    </TooltipProvider>
                  </div>
                  <p className="text-xs text-muted-foreground truncate">{chat.last_message || chat.telefone}</p>
                </div>
                <div className="flex flex-col items-end gap-1 shrink-0">
                  {chat.last_message_at && (
                    <span className="text-[10px] text-muted-foreground">
                      {format(new Date(chat.last_message_at), 'HH:mm')}
                    </span>
                  )}
                  {chat.unread_count > 0 && (
                    <span className="bg-primary text-primary-foreground text-[10px] rounded-full min-w-5 h-5 px-1.5 flex items-center justify-center font-bold">
                      {chat.unread_count}
                    </span>
                  )}
                </div>
              </button>
            );
          })}
        </ScrollArea>
      </div>

      {/* Conversa */}
      <div className={`${showList ? 'hidden' : 'flex'} md:flex flex-1 flex-col min-h-0`}>
        {activeChat ? (
          <>
            {/* Header da conversa */}
            <div className="p-2 sm:p-3 border-b border-border bg-card flex items-center gap-2 sm:gap-3">
              <Button variant="ghost" size="icon" className="md:hidden h-9 w-9 shrink-0" onClick={() => setActiveChat(null)}>
                <ArrowLeft className="h-5 w-5" />
              </Button>
              <Avatar className="h-9 w-9 sm:h-10 sm:w-10 shrink-0">
                <AvatarImage src={activeChat.profile_pic_url || undefined} />
                <AvatarFallback className="bg-primary/10 text-primary">{activeChat.nome?.[0]?.toUpperCase()}</AvatarFallback>
              </Avatar>
              <button
                type="button"
                onClick={() => setClienteInfoOpen(true)}
                className="flex-1 min-w-0 text-left hover:opacity-80 transition"
                title="Ver informações do cliente"
              >
                <div className="flex items-center gap-1 flex-wrap">
                  <p className="font-semibold text-sm sm:text-base text-foreground truncate max-w-[140px] sm:max-w-none">{activeChat.nome}</p>
                  {activeChat.cliente_id && <BadgeCheck className="h-4 w-4 text-primary shrink-0" />}
                  {(() => {
                    const status = chatStatus[phoneKey(activeChat.telefone)];
                    if (!status) return null;
                    return (
                      <TooltipProvider>
                        {status.ativos > 0 && (
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <span className="inline-flex items-center gap-0.5 text-[10px] font-semibold rounded-full px-1.5 py-0.5 bg-primary/15 text-primary shrink-0">
                                <CalendarCheck className="h-3 w-3" />
                                {status.ativos}
                              </span>
                            </TooltipTrigger>
                            <TooltipContent>
                              {status.ativos === 1 ? '1 agendamento ativo' : `${status.ativos} agendamentos ativos`}
                            </TooltipContent>
                          </Tooltip>
                        )}
                        {status.credito > 0 && (
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <span className="inline-flex items-center gap-0.5 text-[10px] font-semibold rounded-full px-1.5 py-0.5 bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 shrink-0">
                                <Wallet className="h-3 w-3" />
                                R$ {status.credito.toFixed(0)}
                              </span>
                            </TooltipTrigger>
                            <TooltipContent>Crédito: R$ {status.credito.toFixed(2)}</TooltipContent>
                          </Tooltip>
                        )}
                        {status.devendo > 0 && (
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <span className="inline-flex items-center gap-0.5 text-[10px] font-semibold rounded-full px-1.5 py-0.5 bg-destructive/15 text-destructive shrink-0">
                                <AlertCircle className="h-3 w-3" />
                                {status.devendo >= 1 ? `R$ ${status.devendo.toFixed(0)}` : '!'}
                              </span>
                            </TooltipTrigger>
                            <TooltipContent>
                              {status.devendo >= 1
                                ? `Devendo: R$ ${status.devendo.toFixed(2)}`
                                : 'Possui agendamento pendente de pagamento'}
                            </TooltipContent>
                          </Tooltip>
                        )}
                      </TooltipProvider>
                    );
                  })()}
                </div>
                <p className="text-[11px] sm:text-xs text-muted-foreground truncate">{activeChat.telefone}</p>
              </button>
              {isGroup(activeChat.remote_jid) ? (
                <Button
                  size="sm"
                  variant="default"
                  className="h-9 px-2 sm:px-3 shrink-0 gap-1"
                  onClick={() => setGrupoMsgOpen(true)}
                  title="Gerar mensagem com IA para o grupo"
                >
                  <Sparkles className="h-4 w-4 sm:mr-1" /> <span className="hidden sm:inline">Gerar mensagem</span>
                </Button>
              ) : (
                <>
                  {!activeChat.cliente_id && (
                    <Button size="sm" variant="outline" className="h-9 px-2 sm:px-3 shrink-0" onClick={() => { setNovoClienteNome(activeChat.nome); setAddClienteOpen(true); }}>
                      <UserPlus className="h-4 w-4 sm:mr-1" /> <span className="hidden sm:inline">Adicionar</span>
                    </Button>
                  )}
                  <Button size="sm" variant="default" className="h-9 px-2 sm:px-3 shrink-0" onClick={() => {
                    if (!activeChat) return;
                    window.dispatchEvent(new CustomEvent('whatsapp:agendar', {
                      detail: { nome: activeChat.nome, telefone: activeChat.telefone },
                    }));
                  }}>
                    <CalendarPlus className="h-4 w-4 sm:mr-1" /> <span className="hidden sm:inline">Agendar</span>
                  </Button>
                </>
              )}
            </div>

            {/* Mensagens */}
            <ScrollArea className="flex-1 min-h-0 bg-muted/30">
              <div className="p-2 sm:p-4 space-y-2">
                {loadingMessages && messages.length === 0 ? (
                  <div className="flex items-center justify-center py-10 text-sm text-muted-foreground">
                    Carregando mensagens...
                  </div>
                ) : (
                  messages.map((m) => (
                    <MessageBubble
                      key={m.id}
                      message={m}
                      quoted={m.quoted_message_id ? messagesByMessageId[m.quoted_message_id] || null : null}
                      reactionsList={m.message_id ? reactions[m.message_id] || [] : undefined}
                      onReact={sendReaction}
                      onReply={handleReplyTo}
                      onDelete={m.from_me ? handleDeleteTarget : undefined}
                      onOpenFullPicker={handleOpenFullPicker}
                    />
                  ))
                )}
                <div ref={messagesEndRef} />
              </div>
            </ScrollArea>

            {/* Reply preview */}
            {replyTo && (
              <div className="px-2 sm:px-3 pt-2 border-t border-border bg-card">
                <div className="flex items-start gap-2 bg-muted/50 rounded-lg p-2 border-l-4 border-primary">
                  <div className="flex-1 min-w-0">
                    <p className="text-[11px] font-semibold text-primary">
                      {replyTo.from_me ? 'Você' : activeChat.nome}
                    </p>
                    <p className="text-xs text-muted-foreground truncate">
                      {replyTo.content || replyTo.caption || `[${replyTo.message_type}]`}
                    </p>
                  </div>
                  <Button size="icon" variant="ghost" className="h-6 w-6 shrink-0" onClick={() => setReplyTo(null)}>
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            )}

            {/* Input */}
            <div className="p-2 sm:p-3 border-t border-border bg-card flex items-end gap-1 sm:gap-2">
              <input ref={fileInputRef} type="file" className="hidden" onChange={(e) => {
                const f = e.target.files?.[0]; if (f) sendFile(f); e.target.value = '';
              }} accept="image/*,video/*,audio/*,application/pdf,application/zip,image/gif" />
              <input ref={stickerInputRef} type="file" className="hidden" onChange={(e) => {
                const f = e.target.files?.[0]; if (f) sendFile(f, { asSticker: true }); e.target.value = '';
              }} accept="image/webp,image/png,image/jpeg" />
              <Button size="icon" variant="ghost" className="h-9 w-9 shrink-0" onClick={() => fileInputRef.current?.click()} title="Enviar arquivo, imagem, vídeo ou GIF">
                <Paperclip className="h-5 w-5" />
              </Button>
              <Button size="icon" variant="ghost" className="h-9 w-9 shrink-0 hidden sm:inline-flex" onClick={() => stickerInputRef.current?.click()} title="Enviar sticker">
                <Smile className="h-5 w-5" />
              </Button>
              {recording ? (
                <div className="flex-1 h-9 sm:h-10 flex items-center gap-2 px-3 rounded-md bg-destructive/10 border border-destructive/30">
                  <span className="relative flex h-2.5 w-2.5">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-destructive opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-destructive"></span>
                  </span>
                  <span className="text-sm text-destructive font-medium">Gravando áudio...</span>
                </div>
              ) : (
                <Input
                  value={text}
                  onChange={(e) => setText(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendText(); } }}
                  placeholder={replyTo ? 'Responder...' : 'Mensagem...'}
                  className="flex-1 h-9 sm:h-10"
                />
              )}
              {text.trim() ? (
                <Button size="icon" className="h-9 w-9 shrink-0" onClick={sendText}><Send className="h-5 w-5" /></Button>
              ) : recording ? (
                <>
                  <Button size="icon" variant="ghost" className="h-9 w-9 shrink-0 text-destructive hover:bg-destructive/10" onClick={cancelRecording} title="Cancelar gravação">
                    <X className="h-5 w-5" />
                  </Button>
                  <Button size="icon" className="h-9 w-9 shrink-0" onClick={stopRecording} title="Enviar áudio">
                    <Send className="h-5 w-5" />
                  </Button>
                </>
              ) : (
                <Button size="icon" variant="ghost" className="h-9 w-9 shrink-0" onClick={startRecording} title="Gravar áudio"><Mic className="h-5 w-5" /></Button>
              )}
            </div>
          </>
        ) : (
          <div className="flex-1 hidden md:flex flex-col items-center justify-center text-muted-foreground">
            <MessageCircle className="h-16 w-16 mb-4 opacity-30" />
            <p>Selecione uma conversa</p>
          </div>
        )}
      </div>

      {/* Dialog adicionar cliente */}
      <Dialog open={addClienteOpen} onOpenChange={setAddClienteOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Adicionar como cliente</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="novo-cliente-nome">Nome</Label>
              <Input
                id="novo-cliente-nome"
                value={novoClienteNome}
                onChange={(e) => setNovoClienteNome(e.target.value)}
                placeholder="Nome do cliente"
                autoFocus
              />
              <p className="text-xs text-muted-foreground">Pré-preenchido com o nome do WhatsApp. Edite se necessário.</p>
            </div>
            <div className="space-y-1.5">
              <Label>Telefone</Label>
              <Input value={activeChat?.telefone || ''} disabled />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAddClienteOpen(false)}>Cancelar</Button>
            <Button onClick={handleAddCliente}>Adicionar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog Nova Conversa */}
      <Dialog open={novaConversaOpen} onOpenChange={setNovaConversaOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Nova conversa</DialogTitle></DialogHeader>
          <Tabs value={novaConversaTab} onValueChange={(v) => setNovaConversaTab(v as 'cliente' | 'numero')}>
            <TabsList className="grid grid-cols-2 w-full">
              <TabsTrigger value="cliente" className="gap-1.5">
                <UserIcon className="h-3.5 w-3.5" /> Cliente
              </TabsTrigger>
              <TabsTrigger value="numero" className="gap-1.5">
                <PenSquare className="h-3.5 w-3.5" /> Novo número
              </TabsTrigger>
            </TabsList>
          </Tabs>

          {novaConversaTab === 'cliente' ? (
            <div className="space-y-2">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Buscar cliente..."
                  value={novaConversaSearch}
                  onChange={(e) => setNovaConversaSearch(e.target.value)}
                  className="pl-9"
                />
              </div>
              <ScrollArea className="h-72 border border-border rounded-md">
                {clientesList.length === 0 && (
                  <div className="p-4 text-sm text-muted-foreground text-center">Nenhum cliente cadastrado.</div>
                )}
                {clientesList
                  .filter((c) => {
                    const q = novaConversaSearch.toLowerCase().trim();
                    if (!q) return true;
                    return c.nome.toLowerCase().includes(q) || (c.telefone || '').includes(q);
                  })
                  .map((c) => (
                    <button
                      key={c.id}
                      disabled={iniciandoConversa}
                      onClick={() => iniciarNovaConversa(c.telefone, c.nome)}
                      className="w-full flex items-center gap-3 p-2.5 hover:bg-muted/50 transition border-b border-border/50 text-left disabled:opacity-50"
                    >
                      <Avatar className="h-9 w-9 shrink-0">
                        <AvatarFallback className="bg-primary/10 text-primary">
                          {c.nome?.[0]?.toUpperCase() || '?'}
                        </AvatarFallback>
                      </Avatar>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-sm text-foreground truncate">{c.nome}</p>
                        <p className="text-xs text-muted-foreground truncate">{c.telefone}</p>
                      </div>
                    </button>
                  ))}
              </ScrollArea>
            </div>
          ) : (
            <div className="space-y-3">
              <div>
                <Label>Telefone (com DDI + DDD)</Label>
                <Input
                  placeholder="5511999998888"
                  value={novaConversaTelefone}
                  onChange={(e) => setNovaConversaTelefone(e.target.value.replace(/\D/g, ''))}
                  inputMode="numeric"
                />
                <p className="text-[11px] text-muted-foreground mt-1">Ex: 55 + DDD + número (sem espaços).</p>
              </div>
              <div>
                <Label>Nome (opcional)</Label>
                <Input
                  placeholder="Nome do contato"
                  value={novaConversaNome}
                  onChange={(e) => setNovaConversaNome(e.target.value)}
                />
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setNovaConversaOpen(false)}>Cancelar</Button>
                <Button
                  disabled={iniciandoConversa || !novaConversaTelefone}
                  onClick={() => iniciarNovaConversa(novaConversaTelefone, novaConversaNome)}
                >
                  {iniciandoConversa ? 'Abrindo...' : 'Iniciar conversa'}
                </Button>
              </DialogFooter>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Dialog info do cliente */}
      {activeChat && (
        <ClienteInfoDialog
          open={clienteInfoOpen}
          onOpenChange={setClienteInfoOpen}
          telefone={activeChat.telefone}
          nome={activeChat.nome}
        />
      )}

      {/* Confirmação de exclusão de mensagem */}
      <AlertDialog open={!!deleteTarget} onOpenChange={(o) => { if (!o) setDeleteTarget(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir mensagem?</AlertDialogTitle>
            <AlertDialogDescription>
              A mensagem será apagada para você e para o destinatário no WhatsApp. Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => {
                if (deleteTarget) deleteMessage(deleteTarget);
                setDeleteTarget(null);
              }}
            >
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Dialog Gerar Mensagem para Grupo (IA) */}
      {activeChat && isGroup(activeChat.remote_jid) && (
        <GerarMensagemGrupoDialog
          open={grupoMsgOpen}
          onClose={() => setGrupoMsgOpen(false)}
          grupoNome={activeChat.nome}
          grupoRemoteJid={activeChat.remote_jid}
        />
      )}

    </div>
  );
};

// Quick reaction emojis (estilo WhatsApp)
const QUICK_REACTIONS = ['👍', '❤️', '😂', '😮', '😢', '🙏'];

// Bubble com renderização de mídia + reply + excluir + reações
const MessageBubble: React.FC<{
  message: Message;
  quoted?: Message | null;
  reactionsList?: Reaction[];
  onReact?: (emoji: string) => void;
  onReply?: () => void;
  onDelete?: () => void;
}> = ({ message, quoted, reactionsList = [], onReact, onReply, onDelete }) => {
  const isMe = message.from_me;
  const [pickerOpen, setPickerOpen] = useState(false);
  const [fullPickerOpen, setFullPickerOpen] = useState(false);

  // Agrupa por emoji para exibição (estilo WhatsApp: emoji + contagem)
  const grouped = reactionsList.reduce<Record<string, { count: number; mine: boolean }>>((acc, r) => {
    if (!r.emoji) return acc;
    if (!acc[r.emoji]) acc[r.emoji] = { count: 0, mine: false };
    acc[r.emoji].count += 1;
    if (r.reactor_jid?.startsWith('me@')) acc[r.emoji].mine = true;
    return acc;
  }, {});
  const myReaction = reactionsList.find((r) => r.reactor_jid?.startsWith('me@'))?.emoji || null;

  const handleQuickReact = (emoji: string) => {
    setPickerOpen(false);
    setFullPickerOpen(false);
    if (!onReact) return;
    // Toggle: se já reagiu com o mesmo emoji, remove
    onReact(myReaction === emoji ? '' : emoji);
  };

  const ReactionTrigger = (
    <button
      className="p-1 rounded-full hover:bg-muted text-muted-foreground"
      title="Reagir"
    >
      <Smile className="h-3.5 w-3.5" />
    </button>
  );

  const ReactionPanel = (
    <PopoverContent
      side="top"
      align={isMe ? 'end' : 'start'}
      className="w-auto p-2 rounded-full shadow-lg"
    >
      <div className="flex items-center gap-1">
        {QUICK_REACTIONS.map((e) => (
          <button
            key={e}
            onClick={() => handleQuickReact(e)}
            className={`text-2xl leading-none w-9 h-9 rounded-full hover:bg-muted transition ${myReaction === e ? 'bg-primary/15 ring-2 ring-primary/40' : ''}`}
            aria-label={`Reagir com ${e}`}
          >
            {e}
          </button>
        ))}
        <button
          onClick={(ev) => { ev.stopPropagation(); setFullPickerOpen(true); setPickerOpen(false); }}
          className="w-9 h-9 rounded-full hover:bg-muted flex items-center justify-center text-muted-foreground"
          aria-label="Mais emojis"
        >
          <Smile className="h-5 w-5" />
        </button>
      </div>
    </PopoverContent>
  );

  return (
    <div className={`group flex items-end gap-1 ${isMe ? 'justify-end' : 'justify-start'}`}>
      {isMe && (
        <div className="flex flex-col gap-0.5 opacity-60 md:opacity-0 md:group-hover:opacity-100 transition">
          {onDelete && (
            <button
              onClick={onDelete}
              className="p-1 rounded-full hover:bg-destructive/10 text-destructive"
              title="Excluir mensagem"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          )}
          {onReact && message.message_id && (
            <Popover open={pickerOpen} onOpenChange={setPickerOpen}>
              <PopoverTrigger asChild>{ReactionTrigger}</PopoverTrigger>
              {ReactionPanel}
            </Popover>
          )}
          {onReply && (
            <button
              onClick={onReply}
              className="p-1 rounded-full hover:bg-muted text-muted-foreground"
              title="Responder"
            >
              <Reply className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
      )}
      <div className="relative">
        <div className={`max-w-[85%] sm:max-w-[75%] rounded-2xl px-3 py-2 shadow-sm ${isMe ? 'bg-primary text-primary-foreground' : 'bg-card'}`}>
          {quoted && (
            <div className={`mb-1.5 px-2 py-1 rounded border-l-2 text-xs ${isMe ? 'bg-primary-foreground/10 border-primary-foreground/40' : 'bg-muted border-primary'}`}>
              <p className={`font-semibold text-[10px] ${isMe ? 'text-primary-foreground/80' : 'text-primary'}`}>
                {quoted.from_me ? 'Você' : 'Mensagem'}
              </p>
              <p className="truncate opacity-80">
                {quoted.content || quoted.caption || `[${quoted.message_type}]`}
              </p>
            </div>
          )}
          {message.message_type === 'image' && message.media_url && (
            <img src={message.media_url} alt="" className="rounded-lg max-w-full sm:max-w-xs mb-1 cursor-pointer" onClick={() => window.open(message.media_url!, '_blank')} />
          )}
          {message.message_type === 'video' && message.media_url && (
            <video src={message.media_url} controls className="rounded-lg max-w-full sm:max-w-xs mb-1" />
          )}
          {message.message_type === 'audio' && message.media_url && (
            <audio src={message.media_url} controls className="max-w-full" />
          )}
          {message.message_type === 'document' && message.media_url && (
            <a href={message.media_url} target="_blank" rel="noreferrer" className={`flex items-center gap-2 p-2 rounded ${isMe ? 'bg-primary-foreground/10' : 'bg-muted'}`}>
              <FileText className="h-5 w-5 shrink-0" />
              <span className="text-sm truncate">{message.media_filename || 'Arquivo'}</span>
              <Download className="h-4 w-4 ml-auto shrink-0" />
            </a>
          )}
          {message.message_type === 'sticker' && message.media_url && (
            <img src={message.media_url} alt="sticker" className="w-28 h-28 sm:w-32 sm:h-32 object-contain" />
          )}
          {(message.content || message.caption) && (
            <p className="text-sm whitespace-pre-wrap break-words">{message.content || message.caption}</p>
          )}
          <p className={`text-[10px] mt-1 text-right ${isMe ? 'text-primary-foreground/70' : 'text-muted-foreground'}`}>
            {format(new Date(message.timestamp), 'HH:mm')}
          </p>
        </div>
        {/* Bolha de reações sobreposta — estilo WhatsApp */}
        {Object.keys(grouped).length > 0 && (
          <div className={`absolute -bottom-3 ${isMe ? 'right-2' : 'left-2'} flex items-center gap-0.5`}>
            <button
              onClick={() => onReact && setPickerOpen(true)}
              className="flex items-center gap-0.5 bg-card border border-border rounded-full px-1.5 py-0.5 shadow-sm hover:bg-muted transition"
            >
              {Object.entries(grouped).map(([emoji, info]) => (
                <span key={emoji} className="text-sm leading-none">{emoji}</span>
              ))}
              {reactionsList.length > 1 && (
                <span className="text-[10px] text-muted-foreground ml-0.5">{reactionsList.length}</span>
              )}
            </button>
          </div>
        )}
      </div>
      {!isMe && (
        <div className="flex flex-col gap-0.5 opacity-60 md:opacity-0 md:group-hover:opacity-100 transition">
          {onReact && message.message_id && (
            <Popover open={pickerOpen} onOpenChange={setPickerOpen}>
              <PopoverTrigger asChild>{ReactionTrigger}</PopoverTrigger>
              {ReactionPanel}
            </Popover>
          )}
          {onReply && (
            <button
              onClick={onReply}
              className="p-1 rounded-full hover:bg-muted text-muted-foreground"
              title="Responder"
            >
              <Reply className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
      )}

      {/* Picker completo de emojis */}
      <Dialog open={fullPickerOpen} onOpenChange={setFullPickerOpen}>
        <DialogContent className="p-0 max-w-sm w-[min(92vw,360px)] overflow-hidden">
          <EmojiPicker
            onEmojiClick={(e) => handleQuickReact(e.emoji)}
            emojiStyle={EmojiStyle.NATIVE}
            theme={Theme.AUTO}
            width="100%"
            height={420}
            previewConfig={{ showPreview: false }}
            searchPlaceHolder="Buscar emoji..."
            lazyLoadEmojis
          />
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default WhatsAppPage;
