import React, { useState, useEffect, useRef, useCallback } from 'react';
import { ArrowLeft, Send, Paperclip, Mic, Image, Video, File, Search, Phone, CheckCheck, X, Zap, Square, Calendar, AlertCircle } from 'lucide-react';
import MediaMessage from './MediaMessage';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Textarea } from '@/components/ui/textarea';
import { useEvolutionApi, type Chat, type Message } from '@/hooks/useEvolutionApi';
import { useEvolutionRealtime } from '@/hooks/useEvolutionRealtime';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

const safe = (val: any): string => {
  if (val === null || val === undefined) return '';
  if (typeof val === 'string') return val;
  if (typeof val === 'number' || typeof val === 'boolean') return String(val);
  return '';
};

const safeNum = (val: any): number => {
  if (typeof val === 'number' && !isNaN(val)) return val;
  if (typeof val === 'string') {
    const n = parseInt(val, 10);
    return isNaN(n) ? 0 : n;
  }
  return 0;
};

const safeSortMessages = (msgs: any[]): any[] => {
  if (!Array.isArray(msgs)) return [];
  return [...msgs].sort((a, b) => safeNum(a?.messageTimestamp) - safeNum(b?.messageTimestamp));
};

const cleanBase64 = (base64String: string): string => {
  if (!base64String) return '';
  const idx = base64String.indexOf(',');
  if (idx !== -1 && base64String.startsWith('data:')) {
    return base64String.substring(idx + 1).trim();
  }
  return base64String.trim();
};

const normalizePhone = (phone: string): string => {
  const digits = phone.replace(/\D/g, '');
  if (digits.startsWith('55') && digits.length >= 12) {
    return digits.substring(2);
  }
  return digits;
};

interface Agendamento {
  id: string;
  nome: string;
  telefone: string;
  data_agendamento: string;
  hora_agendamento: string;
  preco: number;
  status: string;
  forma_pagamento: string | null;
  procedimento_id: string | null;
}

interface Servico {
  id: string;
  nome_procedimento: string;
  valor: number;
}

interface WhatsAppTabProps {
  initialJid?: string | null;
  onClearInitialJid?: () => void;
}

const WhatsAppTab = ({ initialJid, onClearInitialJid }: WhatsAppTabProps) => {
  const [chats, setChats] = useState<Chat[]>([]);
  const [selectedChat, setSelectedChat] = useState<Chat | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [messageText, setMessageText] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [showAttachMenu, setShowAttachMenu] = useState(false);
  const [isConnected, setIsConnected] = useState<boolean | null>(null);
  const [profilePics, setProfilePics] = useState<Record<string, string>>({});
  const [isRecording, setIsRecording] = useState(false);
  const [agendamentos, setAgendamentos] = useState<Agendamento[]>([]);
  const [servicos, setServicos] = useState<Servico[]>([]);
  const [showAgendamentoDialog, setShowAgendamentoDialog] = useState(false);
  const [agendamentoForm, setAgendamentoForm] = useState({
    data_agendamento: format(new Date(), 'yyyy-MM-dd'),
    hora_agendamento: '',
    procedimento_ids: [] as string[],
    preco: 0,
    observacoes: '',
  });
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const selectedChatRef = useRef<Chat | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const { toast } = useToast();
  const { loading, error, fetchChats, fetchMessages, sendText, sendMedia, sendAudio, checkConnection, fetchProfilePicture, getBase64FromMedia } = useEvolutionApi();

  useEffect(() => {
    selectedChatRef.current = selectedChat;
  }, [selectedChat]);

  // Fetch agendamentos and servicos
  useEffect(() => {
    const fetchData = async () => {
      const { data: ag } = await supabase
        .from('agendamentos')
        .select('id, nome, telefone, data_agendamento, hora_agendamento, preco, status, forma_pagamento, procedimento_id')
        .in('status', ['A fazer', 'Em andamento', 'Agendado']);
      if (ag) setAgendamentos(ag);

      const { data: sv } = await supabase.from('servicos').select('id, nome_procedimento, valor');
      if (sv) setServicos(sv);
    };
    fetchData();
  }, []);

  // Auto-calculate price when procedures change
  useEffect(() => {
    if (agendamentoForm.procedimento_ids.length > 0) {
      const total = agendamentoForm.procedimento_ids.reduce((sum, procId) => {
        const servico = servicos.find(s => s.id === procId);
        return sum + (servico?.valor || 0);
      }, 0);
      setAgendamentoForm(prev => ({ ...prev, preco: total }));
    }
  }, [agendamentoForm.procedimento_ids, servicos]);

  const getContactName = useCallback((chat: any): string => {
    if (chat?.name && typeof chat.name === 'string') return chat.name;
    if (chat?.pushName && typeof chat.pushName === 'string') return chat.pushName;
    const jid = safe(chat?.remoteJid);
    return jid.replace('@s.whatsapp.net', '').replace('@g.us', '') || 'Desconhecido';
  }, []);

  const getPhoneFromJid = useCallback((jid: string): string => {
    return jid.replace('@s.whatsapp.net', '').replace('@g.us', '').replace('@lid', '');
  }, []);

  const getAgendamentosPendentes = useCallback((jid: string): Agendamento[] => {
    const phone = normalizePhone(getPhoneFromJid(jid));
    return agendamentos.filter(ag => {
      const agPhone = normalizePhone(ag.telefone);
      return agPhone === phone || phone.endsWith(agPhone) || agPhone.endsWith(phone);
    });
  }, [agendamentos, getPhoneFromJid]);

  const getServicoNome = useCallback((procedimentoId: string | null): string => {
    if (!procedimentoId) return '';
    const s = servicos.find(sv => sv.id === procedimentoId);
    return s?.nome_procedimento || '';
  }, [servicos]);

  const getMessageContent = useCallback((msg: any): string => {
    try {
      const m = msg?.message;
      if (!m || typeof m !== 'object') return safe(m);
      if (typeof m.conversation === 'string') return m.conversation;
      if (typeof m.extendedTextMessage?.text === 'string') return m.extendedTextMessage.text;
      if (m.imageMessage) return safe(m.imageMessage?.caption) || '📷 Imagem';
      if (m.videoMessage) return safe(m.videoMessage?.caption) || '🎥 Vídeo';
      if (m.audioMessage) return '🎵 Áudio';
      if (m.documentMessage) return safe(m.documentMessage?.fileName) || '📄 Documento';
      if (m.albumMessage) return '🖼️ Álbum';
      if (m.stickerMessage) return '🎃 Sticker';
      if (m.contactMessage) return '👤 Contato';
      if (m.locationMessage) return '📍 Localização';
      const keys = Object.keys(m);
      for (const k of keys) {
        if (m[k]?.text && typeof m[k].text === 'string') return m[k].text;
        if (m[k]?.caption && typeof m[k].caption === 'string') return m[k].caption;
      }
      return '💬 Mensagem';
    } catch {
      return '💬 Mensagem';
    }
  }, []);

  const getLastMessagePreview = useCallback((chat: any): string => {
    const lm = chat?.lastMessage;
    if (!lm) return 'Sem mensagens';
    if (typeof lm === 'string') return lm;
    if (typeof lm === 'object') return getMessageContent({ message: lm });
    return 'Sem mensagens';
  }, [getMessageContent]);

  const markChatAsRead = useCallback((remoteJid: string) => {
    setChats(prev => prev.map(chat => (
      safe(chat.remoteJid) === remoteJid
        ? { ...chat, unreadCount: 0 }
        : chat
    )));
  }, []);

  const handleOpenChat = useCallback((chat: Chat) => {
    const remoteJid = safe(chat.remoteJid);
    markChatAsRead(remoteJid);
    setSelectedChat({ ...chat, unreadCount: 0 });
  }, [markChatAsRead]);

  // Request notification permission on mount
  useEffect(() => {
    if ('Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission();
    }
  }, []);

  const showBrowserNotification = useCallback((title: string, body: string) => {
    if (!('Notification' in window) || Notification.permission !== 'granted') return;
    if (document.visibilityState === 'visible') return;
    try {
      const notification = new Notification(title, {
        body,
        icon: '/placeholder.svg',
        tag: 'whatsapp-msg',
      } as NotificationOptions);
      notification.onclick = () => {
        window.focus();
        notification.close();
      };
    } catch { /* silent */ }
  }, []);

  // Use Supabase Realtime instead of WebSocket
  const { realtimeConnected } = useEvolutionRealtime({
    onMessage: useCallback((data: any) => {
      const currentChat = selectedChatRef.current;
      if (!data) return;
      const msgArray = Array.isArray(data) ? data : [data];

      msgArray.forEach((msg: any) => {
        if (!msg || typeof msg !== 'object') return;
        const remoteJid = safe(msg?.key?.remoteJid);
        if (!remoteJid) return;
        const isCurrentChat = currentChat && remoteJid === safe(currentChat.remoteJid);
        const isFromMe = msg?.key?.fromMe === true;

        if (!isFromMe) {
          const senderName = safe(msg?.pushName) || remoteJid.replace('@s.whatsapp.net', '').replace('@g.us', '');
          const content = getMessageContent(msg);
          showBrowserNotification(`💬 ${senderName}`, content || 'Nova mensagem');
        }

        setChats(prev => {
          const updated = [...prev];
          const chatIndex = updated.findIndex(c => safe(c.remoteJid) === remoteJid);
          if (chatIndex >= 0) {
            updated[chatIndex] = {
              ...updated[chatIndex],
              lastMessage: getMessageContent(msg),
              lastMessageTimestamp: safeNum(msg.messageTimestamp) || Math.floor(Date.now() / 1000),
              unreadCount: isCurrentChat ? 0 : Math.max(1, safeNum(updated[chatIndex].unreadCount) + (isFromMe ? 0 : 1)),
            };
            const [chatItem] = updated.splice(chatIndex, 1);
            updated.unshift(chatItem);
          }
          return updated;
        });

        if (isCurrentChat) {
          setMessages(prev => {
            const msgId = safe(msg?.key?.id) || safe(msg?.id);
            const exists = prev.some((m: any) => {
              const mId = safe(m?.key?.id) || safe(m?.id);
              return mId && mId === msgId;
            });
            if (exists) return prev;
            return safeSortMessages([...prev, msg]);
          });
          markChatAsRead(remoteJid);
          setTimeout(() => messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 100);
        }
      });
    }, [getMessageContent, markChatAsRead, showBrowserNotification]),
    onConnectionUpdate: useCallback((connected: boolean) => {
      setIsConnected(connected);
    }, []),
  });

  useEffect(() => {
    checkConnection().then(state => {
      if (state?.instance?.state === 'open') setIsConnected(true);
    });
  }, [checkConnection]);

  useEffect(() => {
    fetchChats().then(data => {
      if (!Array.isArray(data)) return;
      const sorted = [...data].sort((a: any, b: any) => safeNum(b?.lastMessageTimestamp) - safeNum(a?.lastMessageTimestamp));
      setChats(sorted);
    });
  }, [fetchChats]);

  // Handle initialJid - open the matching chat automatically
  useEffect(() => {
    if (!initialJid || chats.length === 0) return;
    const normalizedInitial = normalizePhone(getPhoneFromJid(initialJid));
    const matchingChat = chats.find(c => {
      const chatPhone = normalizePhone(getPhoneFromJid(safe(c.remoteJid)));
      return chatPhone === normalizedInitial || chatPhone.endsWith(normalizedInitial) || normalizedInitial.endsWith(chatPhone);
    });
    if (matchingChat) {
      handleOpenChat(matchingChat);
      onClearInitialJid?.();
    } else {
      // Create a temporary chat entry for this JID
      const tempChat: Chat = {
        id: initialJid,
        remoteJid: initialJid,
        name: initialJid.replace('@s.whatsapp.net', ''),
        lastMessage: '',
        lastMessageTimestamp: Math.floor(Date.now() / 1000),
        unreadCount: 0,
      };
      handleOpenChat(tempChat);
      onClearInitialJid?.();
    }
  }, [initialJid, chats, handleOpenChat, onClearInitialJid, getPhoneFromJid]);

  useEffect(() => {
    if (chats.length === 0) return;
    chats.forEach((chat) => {
      const jid = safe(chat.remoteJid);
      if (!jid || profilePics[jid] !== undefined) return;
      setProfilePics(prev => ({ ...prev, [jid]: '' }));
      fetchProfilePicture(jid).then(url => {
        if (url) {
          setProfilePics(prev => ({ ...prev, [jid]: url }));
        }
      });
    });
  }, [chats, fetchProfilePicture, profilePics]);

  useEffect(() => {
    if (!selectedChat) return;
    const remoteJid = safe(selectedChat.remoteJid);
    markChatAsRead(remoteJid);
    fetchMessages(remoteJid).then(msgs => {
      setMessages(safeSortMessages(msgs));
      setTimeout(() => messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 100);
    });
  }, [selectedChat, fetchMessages, markChatAsRead]);

  const handleSendMessage = async () => {
    if (!messageText.trim() || !selectedChat) return;
    const jid = safe(selectedChat.remoteJid);
    const number = jid.includes('@lid') ? jid : jid.replace('@s.whatsapp.net', '').replace('@g.us', '');
    try {
      await sendText(number, messageText);
      setMessageText('');
      const msgs = await fetchMessages(safe(selectedChat.remoteJid));
      setMessages(safeSortMessages(msgs));
      setTimeout(() => messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 100);
    } catch {
      toast({ title: 'Erro', description: 'Falha ao enviar mensagem', variant: 'destructive' });
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>, mediatype: 'image' | 'video' | 'document') => {
    const file = e.target.files?.[0];
    if (!file || !selectedChat) return;

    const reader = new FileReader();
    reader.onload = async () => {
      const base64 = cleanBase64(reader.result as string);
      const jid = safe(selectedChat.remoteJid);
      const number = jid.includes('@lid') ? jid : jid.replace('@s.whatsapp.net', '').replace('@g.us', '');
      try {
        await sendMedia(number, mediatype, base64, '', file.name);
        toast({ title: 'Sucesso', description: 'Mídia enviada!' });
        const msgs = await fetchMessages(safe(selectedChat.remoteJid));
        setMessages(safeSortMessages(msgs));
      } catch {
        toast({ title: 'Erro', description: 'Falha ao enviar mídia', variant: 'destructive' });
      }
    };
    reader.readAsDataURL(file);
    setShowAttachMenu(false);
    e.target.value = '';
  };

  const handleAudioToggle = async () => {
    if (!selectedChat) return;

    if (isRecording && mediaRecorderRef.current) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      const chunks: Blob[] = [];

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunks.push(e.data);
      };

      mediaRecorder.onstop = async () => {
        const blob = new Blob(chunks, { type: 'audio/ogg; codecs=opus' });
        const reader = new FileReader();
        reader.onload = async () => {
          const base64 = cleanBase64(reader.result as string);
          const jid = safe(selectedChat.remoteJid);
          const number = jid.includes('@lid') ? jid : jid.replace('@s.whatsapp.net', '').replace('@g.us', '');
          try {
            await sendAudio(number, base64);
            toast({ title: 'Sucesso', description: 'Áudio enviado!' });
            const msgs = await fetchMessages(safe(selectedChat.remoteJid));
            setMessages(safeSortMessages(msgs));
          } catch {
            toast({ title: 'Erro', description: 'Falha ao enviar áudio', variant: 'destructive' });
          }
        };
        reader.readAsDataURL(blob);
        stream.getTracks().forEach(t => t.stop());
        mediaRecorderRef.current = null;
      };

      mediaRecorder.start();
      setIsRecording(true);
      toast({ title: 'Gravando áudio...', description: 'Clique no botão para parar' });

      setTimeout(() => {
        if (mediaRecorder.state === 'recording') {
          mediaRecorder.stop();
          setIsRecording(false);
        }
      }, 60000);
    } catch {
      toast({ title: 'Erro', description: 'Permissão de microfone negada', variant: 'destructive' });
    }
  };

  const handleCriarAgendamento = async () => {
    if (!selectedChat) return;
    setAgendamentoForm({
      data_agendamento: format(new Date(), 'yyyy-MM-dd'),
      hora_agendamento: '',
      procedimento_ids: [],
      preco: 0,
      observacoes: '',
    });
    setShowAgendamentoDialog(true);
  };

  const handleSubmitAgendamento = async () => {
    if (!selectedChat) return;
    const jid = safe(selectedChat.remoteJid);
    const phone = normalizePhone(getPhoneFromJid(jid));
    const name = getContactName(selectedChat);

    if (!agendamentoForm.data_agendamento || !agendamentoForm.hora_agendamento || agendamentoForm.preco <= 0) {
      toast({ title: 'Erro', description: 'Preencha data, hora e preço', variant: 'destructive' });
      return;
    }

    try {
      // Check if client exists
      const { data: existingClients } = await supabase
        .from('clientes')
        .select('id, telefone, nome')
        .or(`telefone.eq.${phone},telefone.eq.${phone.length === 11 ? phone : ''}`);

      let clienteExiste = existingClients && existingClients.length > 0;

      if (!clienteExiste) {
        // Create client automatically
        await supabase.from('clientes').insert([{
          nome: name,
          telefone: phone,
        }]);
      }

      // Create agendamento
      const agendamentoData = {
        nome: name,
        telefone: phone,
        preco: agendamentoForm.preco,
        data_agendamento: agendamentoForm.data_agendamento,
        hora_agendamento: agendamentoForm.hora_agendamento,
        procedimento_id: agendamentoForm.procedimento_ids.length > 0 ? agendamentoForm.procedimento_ids[0] : null,
        status: 'Agendado',
        observacoes: agendamentoForm.observacoes || null,
      };

      const { data: newAg, error: agError } = await supabase
        .from('agendamentos')
        .insert([agendamentoData])
        .select()
        .single();

      if (agError) throw agError;

      // Insert procedimentos
      if (agendamentoForm.procedimento_ids.length > 0 && newAg) {
        const procedimentosData = agendamentoForm.procedimento_ids.map((procId, index) => ({
          agendamento_id: newAg.id,
          procedimento_id: procId,
          ordem: index + 1,
        }));
        await supabase.from('agendamento_procedimentos').insert(procedimentosData);
      }

      // Refresh agendamentos
      const { data: ag } = await supabase
        .from('agendamentos')
        .select('id, nome, telefone, data_agendamento, hora_agendamento, preco, status, forma_pagamento, procedimento_id')
        .in('status', ['A fazer', 'Em andamento', 'Agendado']);
      if (ag) setAgendamentos(ag);

      setShowAgendamentoDialog(false);
      toast({ title: 'Sucesso', description: `Agendamento criado para ${name}!` });
    } catch (err: any) {
      toast({ title: 'Erro', description: err?.message || 'Falha ao criar agendamento', variant: 'destructive' });
    }
  };

  const getInitials = (name: string): string => {
    if (!name) return '??';
    return name.split(' ').filter(Boolean).map(w => w[0]).slice(0, 2).join('').toUpperCase() || '??';
  };

  const formatTime = (timestamp?: number): string => {
    if (!timestamp || timestamp <= 0) return '';
    try {
      return format(new Date(timestamp * 1000), 'HH:mm', { locale: ptBR });
    } catch {
      return '';
    }
  };

  const formatDate = (timestamp?: number): string => {
    if (!timestamp || timestamp <= 0) return '';
    try {
      const date = new Date(timestamp * 1000);
      const today = new Date();
      if (date.toDateString() === today.toDateString()) return 'Hoje';
      const yesterday = new Date(today);
      yesterday.setDate(yesterday.getDate() - 1);
      if (date.toDateString() === yesterday.toDateString()) return 'Ontem';
      return format(date, 'dd/MM/yyyy', { locale: ptBR });
    } catch {
      return '';
    }
  };

  const filteredChats = Array.isArray(chats)
    ? chats.filter(chat => getContactName(chat).toLowerCase().includes(searchQuery.toLowerCase()))
    : [];

  // Chat list view
  if (!selectedChat) {
    return (
      <div className="flex flex-col h-full">
        <div className="p-4 border-b border-border/50">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-lg font-bold text-foreground">WhatsApp</h2>
            <div className="flex items-center gap-2">
              {realtimeConnected && (
                <span className="flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full bg-blue-100 text-blue-700">
                  <Zap size={10} /> Tempo real
                </span>
              )}
            </div>
          </div>
          <div className="relative">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Buscar conversa..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9 bg-secondary/50"
            />
          </div>
        </div>

        <ScrollArea className="flex-1">
          {loading && chats.length === 0 ? (
            <div className="flex items-center justify-center py-12">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
            </div>
          ) : filteredChats.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <Phone size={40} className="mx-auto mb-3 opacity-30" />
              <p className="text-sm">Nenhuma conversa encontrada</p>
            </div>
          ) : (
            <div className="divide-y divide-border/30">
              {filteredChats.map((chat, idx) => {
                const jid = safe(chat.remoteJid);
                const name = getContactName(chat);
                const isGroup = jid.includes('@g.us');
                const pic = profilePics[jid] || '';
                const ts = safeNum(chat.lastMessageTimestamp);
                const unreadCount = safeNum(chat.unreadCount);
                const pendentes = getAgendamentosPendentes(jid);
                const lastMsg = getLastMessagePreview(chat);

                return (
                  <button
                    key={jid || String(idx)}
                    onClick={() => handleOpenChat(chat)}
                    className="w-full flex items-center gap-3 px-4 py-3 hover:bg-secondary/50 transition-colors text-left"
                  >
                    <Avatar className="h-12 w-12 shrink-0">
                      {pic ? <AvatarImage src={pic} alt={name} /> : null}
                      <AvatarFallback className={isGroup ? 'text-sm font-medium bg-accent text-accent-foreground' : 'text-sm font-medium bg-primary/10 text-primary'}>
                        {getInitials(name)}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-1.5 min-w-0">
                          <span className="font-medium text-sm truncate">{name}</span>
                          {pendentes.length > 0 && (
                            <AlertCircle size={14} className="text-amber-500 shrink-0" />
                          )}
                        </div>
                        <span className="text-[10px] text-muted-foreground shrink-0">{ts > 0 ? formatTime(ts) : ''}</span>
                      </div>
                      {/* Show appointment info if exists */}
                      {pendentes.length > 0 && (
                        <div className="flex items-center gap-1 mt-0.5">
                          <span className="text-[10px] text-amber-600 truncate">
                            📅 {pendentes[0].data_agendamento.split('-').reverse().join('/')} {pendentes[0].hora_agendamento.substring(0, 5)}
                            {pendentes[0].procedimento_id ? ` • ${getServicoNome(pendentes[0].procedimento_id)}` : ''}
                            {!pendentes[0].forma_pagamento ? ' • Não pago' : ''}
                          </span>
                        </div>
                      )}
                      {/* Always show last message preview */}
                      <p className="text-xs text-muted-foreground truncate mt-0.5">{lastMsg}</p>
                    </div>
                    {unreadCount > 0 && (
                      <span className="bg-primary text-primary-foreground text-[10px] font-bold rounded-full h-5 min-w-5 flex items-center justify-center px-1">
                        {unreadCount}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          )}
        </ScrollArea>

        {error && <div className="p-3 bg-destructive/10 text-destructive text-xs text-center">{safe(error)}</div>}
      </div>
    );
  }

  const selectedJid = safe(selectedChat.remoteJid);
  const selectedPic = profilePics[selectedJid] || '';
  const selectedName = getContactName(selectedChat);
  const chatAgendamentos = getAgendamentosPendentes(selectedJid);

  return (
    <div className="flex flex-col h-full">
      {/* Header - removed "Online" text */}
      <div className="flex items-center gap-3 px-3 py-2 border-b border-border/50 bg-card sticky top-0 z-10">
        <button onClick={() => { setSelectedChat(null); setMessages([]); }} className="p-1.5 hover:bg-secondary rounded-lg transition-colors">
          <ArrowLeft size={20} />
        </button>
        <Avatar className="h-10 w-10">
          {selectedPic ? <AvatarImage src={selectedPic} alt={selectedName} /> : null}
          <AvatarFallback className="text-xs font-medium bg-primary/10 text-primary">{getInitials(selectedName)}</AvatarFallback>
        </Avatar>
        <div className="flex-1 min-w-0">
          <h3 className="font-medium text-sm truncate">{selectedName}</h3>
          {selectedJid.includes('@g.us') && <p className="text-[10px] text-muted-foreground">Grupo</p>}
        </div>
        <Button size="sm" variant="outline" className="gap-1 text-xs" onClick={handleCriarAgendamento}>
          <Calendar size={14} /> Agendar
        </Button>
      </div>

      {/* Pending appointment banner */}
      {chatAgendamentos.length > 0 && (
        <div className="px-3 py-2 bg-amber-50 border-b border-amber-200">
          {chatAgendamentos.map(ag => (
            <div key={ag.id} className="flex items-center justify-between text-xs">
              <div className="flex items-center gap-2">
                <Calendar size={12} className="text-amber-600" />
                <span className="text-amber-800">
                  {ag.data_agendamento.split('-').reverse().join('/')} às {ag.hora_agendamento.substring(0, 5)}
                  {ag.procedimento_id ? ` • ${getServicoNome(ag.procedimento_id)}` : ''}
                </span>
              </div>
              {!ag.forma_pagamento ? (
                <Badge variant="outline" className="text-[10px] border-amber-400 text-amber-700 bg-amber-100">
                  Não pago
                </Badge>
              ) : (
                <Badge variant="outline" className="text-[10px] border-green-400 text-green-700 bg-green-100">
                  Pago
                </Badge>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Messages */}
      <ScrollArea className="flex-1 bg-secondary/20">
        <div className="p-3 space-y-1">
          {messages.length === 0 && !loading && <div className="text-center py-12 text-muted-foreground text-sm">Nenhuma mensagem ainda</div>}
          {messages.map((msg: any, i: number) => {
            const content = getMessageContent(msg);
            const msgKey = (msg?.key && typeof msg.key === 'object') ? msg.key : {};
            const fromMe = msgKey.fromMe === true;
            const timestamp = safeNum(msg?.messageTimestamp);
            const keyId = safe(msgKey.id) || safe(msg?.id) || String(i);
            const pushName = safe(msg?.pushName);
            const m = (msg?.message && typeof msg.message === 'object') ? msg.message : null;
            const hasImage = !!m?.imageMessage;
            const hasVideo = !!m?.videoMessage;
            const hasAudio = !!m?.audioMessage;
            const hasDoc = !!m?.documentMessage;
            const hasAlbum = !!m?.albumMessage;
            const imgCaption = safe(m?.imageMessage?.caption);
            const vidCaption = safe(m?.videoMessage?.caption);
            const docName = safe(m?.documentMessage?.fileName) || 'Documento';

            const currentDate = formatDate(timestamp || undefined);
            const prevDate = i > 0 ? formatDate(safeNum(messages[i - 1]?.messageTimestamp) || undefined) : '';
            const showDate = currentDate && currentDate !== prevDate;

            return (
              <React.Fragment key={keyId}>
                {showDate && (
                  <div className="flex justify-center my-2">
                    <span className="text-[10px] bg-card/80 backdrop-blur-sm text-muted-foreground px-3 py-1 rounded-full shadow-sm">{currentDate}</span>
                  </div>
                )}
                <div className={fromMe ? 'flex justify-end' : 'flex justify-start'}>
                  <div className={fromMe ? 'max-w-[80%] px-3 py-1.5 rounded-xl shadow-sm bg-primary/15 text-foreground rounded-tr-sm' : 'max-w-[80%] px-3 py-1.5 rounded-xl shadow-sm bg-card text-foreground rounded-tl-sm'}>
                    {!fromMe && pushName && <p className="text-[10px] font-medium text-primary mb-0.5">{pushName}</p>}

                    {hasImage && (
                      <MediaMessage
                        type="image"
                        thumbnailBase64={safe(m?.imageMessage?.jpegThumbnail)}
                        caption={imgCaption}
                        messageId={safe(msgKey.id)}
                        remoteJid={safe(msgKey.remoteJid)}
                        fromMe={fromMe}
                        mimetype={safe(m?.imageMessage?.mimetype)}
                        onLoadMedia={getBase64FromMedia}
                      />
                    )}
                    {hasVideo && (
                      <MediaMessage
                        type="video"
                        thumbnailBase64={safe(m?.videoMessage?.jpegThumbnail)}
                        caption={vidCaption}
                        messageId={safe(msgKey.id)}
                        remoteJid={safe(msgKey.remoteJid)}
                        fromMe={fromMe}
                        mimetype={safe(m?.videoMessage?.mimetype)}
                        onLoadMedia={getBase64FromMedia}
                      />
                    )}
                    {hasAudio && (
                      <MediaMessage
                        type="audio"
                        seconds={safeNum(m?.audioMessage?.seconds)}
                        ptt={!!m?.audioMessage?.ptt}
                        messageId={safe(msgKey.id)}
                        remoteJid={safe(msgKey.remoteJid)}
                        fromMe={fromMe}
                        mimetype={safe(m?.audioMessage?.mimetype)}
                        onLoadMedia={getBase64FromMedia}
                      />
                    )}
                    {hasDoc && (
                      <div className="mb-1 rounded-lg overflow-hidden bg-secondary/30">
                        <div className="flex items-center gap-2 p-3 text-xs text-muted-foreground cursor-pointer hover:bg-secondary/50" onClick={() => {
                          const docUrl = safe(m?.documentMessage?.url) || safe(m?.documentMessage?.directPath) || safe(m?.documentMessage?.mediaUrl);
                          if (docUrl) window.open(docUrl, '_blank');
                        }}>
                          <File size={16} /> {docName}
                        </div>
                      </div>
                    )}
                    {hasAlbum && (
                      <div className="mb-1 rounded-lg overflow-hidden bg-secondary/30">
                        <div className="flex items-center gap-2 p-3 text-xs text-muted-foreground"><Image size={16} /> Álbum</div>
                      </div>
                    )}

                    {!hasImage && !hasVideo && !hasAudio && !hasDoc && !hasAlbum && content && (
                      <p className="text-sm whitespace-pre-wrap break-words">{content}</p>
                    )}

                    <div className={fromMe ? 'flex items-center gap-1 mt-0.5 justify-end' : 'flex items-center gap-1 mt-0.5 justify-start'}>
                      <span className="text-[9px] text-muted-foreground">{formatTime(timestamp || undefined)}</span>
                      {fromMe && <CheckCheck size={12} className="text-primary/60" />}
                    </div>
                  </div>
                </div>
              </React.Fragment>
            );
          })}
          <div ref={messagesEndRef} />
        </div>
      </ScrollArea>

      {/* Attach menu */}
      {showAttachMenu && (
        <div className="flex items-center gap-2 px-3 py-2 bg-card border-t border-border/30">
          <input
            ref={fileInputRef}
            type="file"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (!file) return;
              const isImage = file.type.startsWith('image/');
              const isVideo = file.type.startsWith('video/');
              handleFileUpload(e, isImage ? 'image' : isVideo ? 'video' : 'document');
            }}
          />
          <Button size="sm" variant="outline" className="gap-1.5 text-xs" onClick={() => { fileInputRef.current?.setAttribute('accept', 'image/*'); fileInputRef.current?.click(); }}>
            <Image size={14} /> Foto
          </Button>
          <Button size="sm" variant="outline" className="gap-1.5 text-xs" onClick={() => { fileInputRef.current?.setAttribute('accept', 'video/*'); fileInputRef.current?.click(); }}>
            <Video size={14} /> Vídeo
          </Button>
          <Button size="sm" variant="outline" className="gap-1.5 text-xs" onClick={() => { fileInputRef.current?.setAttribute('accept', '*/*'); fileInputRef.current?.click(); }}>
            <File size={14} /> Arquivo
          </Button>
          <Button size="sm" variant="ghost" onClick={() => setShowAttachMenu(false)}>
            <X size={14} />
          </Button>
        </div>
      )}

      {/* Input */}
      <div className="flex items-center gap-2 px-3 py-2 border-t border-border/50 bg-card">
        <button onClick={() => setShowAttachMenu(!showAttachMenu)} className="p-2 hover:bg-secondary rounded-full transition-colors text-muted-foreground">
          <Paperclip size={18} />
        </button>
        <Input
          value={messageText}
          onChange={(e) => setMessageText(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && handleSendMessage()}
          placeholder="Mensagem..."
          className="flex-1 bg-secondary/50 border-0 focus-visible:ring-1"
        />
        {messageText.trim() ? (
          <button onClick={handleSendMessage} disabled={loading} className="p-2 bg-primary text-primary-foreground rounded-full hover:opacity-90 transition-all">
            <Send size={18} />
          </button>
        ) : (
          <button onClick={handleAudioToggle} className={isRecording ? 'p-2 rounded-full transition-colors bg-destructive text-destructive-foreground animate-pulse' : 'p-2 rounded-full transition-colors hover:bg-secondary text-muted-foreground'}>
            {isRecording ? <Square size={18} /> : <Mic size={18} />}
          </button>
        )}
      </div>

      {/* Agendamento Dialog */}
      <Dialog open={showAgendamentoDialog} onOpenChange={setShowAgendamentoDialog}>
        <DialogContent className="w-[95%] max-w-md mx-auto max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Novo Agendamento - {selectedName}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Data *</Label>
              <Input
                type="date"
                value={agendamentoForm.data_agendamento}
                onChange={e => setAgendamentoForm(prev => ({ ...prev, data_agendamento: e.target.value }))}
              />
            </div>
            <div>
              <Label>Hora *</Label>
              <Input
                type="time"
                value={agendamentoForm.hora_agendamento}
                onChange={e => setAgendamentoForm(prev => ({ ...prev, hora_agendamento: e.target.value }))}
              />
            </div>
            <div>
              <Label>Procedimentos</Label>
              <div className="space-y-2">
                {agendamentoForm.procedimento_ids.map((procId, index) => (
                  <div key={index} className="flex items-center gap-2">
                    <Select value={procId} onValueChange={value => {
                      const newIds = [...agendamentoForm.procedimento_ids];
                      newIds[index] = value;
                      setAgendamentoForm(prev => ({ ...prev, procedimento_ids: newIds }));
                    }}>
                      <SelectTrigger>
                        <SelectValue placeholder="Selecione" />
                      </SelectTrigger>
                      <SelectContent>
                        {servicos.map(s => (
                          <SelectItem key={s.id} value={s.id}>{s.nome_procedimento} - R$ {s.valor.toFixed(2)}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Button type="button" variant="ghost" size="sm" onClick={() => {
                      const newIds = agendamentoForm.procedimento_ids.filter((_, i) => i !== index);
                      setAgendamentoForm(prev => ({ ...prev, procedimento_ids: newIds }));
                    }}>
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
                <Button type="button" variant="outline" size="sm" onClick={() => {
                  setAgendamentoForm(prev => ({ ...prev, procedimento_ids: [...prev.procedimento_ids, ''] }));
                }}>
                  + Adicionar procedimento
                </Button>
              </div>
            </div>
            <div>
              <Label>Preço (R$) *</Label>
              <Input
                type="number"
                step="0.01"
                value={agendamentoForm.preco}
                onChange={e => setAgendamentoForm(prev => ({ ...prev, preco: parseFloat(e.target.value) || 0 }))}
              />
            </div>
            <div>
              <Label>Observações</Label>
              <Textarea
                value={agendamentoForm.observacoes}
                onChange={e => setAgendamentoForm(prev => ({ ...prev, observacoes: e.target.value }))}
                placeholder="Observações..."
              />
            </div>
            <Button onClick={handleSubmitAgendamento} className="w-full">
              Criar Agendamento
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default WhatsAppTab;
