import React, { useEffect, useRef, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import { Search, ArrowLeft, RefreshCw, MessageCircle, BadgeCheck, UserPlus, CalendarPlus, Send, Paperclip, Mic, Square, Image as ImageIcon, Video, FileText, Play, Pause, Download, Users as UsersIcon, User as UserIcon, Reply, Smile, X, Wallet, AlertCircle, CalendarCheck } from 'lucide-react';
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

const WhatsAppPage: React.FC = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [chats, setChats] = useState<Chat[]>([]);
  const [activeChat, setActiveChat] = useState<Chat | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [search, setSearch] = useState('');
  const [tab, setTab] = useState<'private' | 'group'>('private');
  const [loading, setLoading] = useState(true);
  const [text, setText] = useState('');
  const [recording, setRecording] = useState(false);
  const [addClienteOpen, setAddClienteOpen] = useState(false);
  const [novoClienteNome, setNovoClienteNome] = useState('');
  const [clienteInfoOpen, setClienteInfoOpen] = useState(false);
  const [replyTo, setReplyTo] = useState<Message | null>(null);
  const [chatStatus, setChatStatus] = useState<Record<string, { credito: number; devendo: number; ativos: number }>>({});
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const stickerInputRef = useRef<HTMLInputElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const activeChatRef = useRef<Chat | null>(null);
  useEffect(() => { activeChatRef.current = activeChat; }, [activeChat]);

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

  // Carregar mensagens
  const loadMessages = async (chatId: string) => {
    const { data } = await supabase
      .from('whatsapp_messages')
      .select('*')
      .eq('chat_id', chatId)
      .order('timestamp', { ascending: true })
      .limit(500);
    setMessages(data || []);
    setTimeout(() => messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 50);
  };

  // Realtime messages do chat ativo
  useEffect(() => {
    if (!activeChat) return;
    loadMessages(activeChat.id);
    // zerar unread
    supabase.from('whatsapp_chats').update({ unread_count: 0 }).eq('id', activeChat.id).then();

    const ch = supabase.channel(`wa-msgs-${activeChat.id}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'whatsapp_messages', filter: `chat_id=eq.${activeChat.id}` }, (payload) => {
        setMessages((prev) => [...prev, payload.new as Message]);
        setTimeout(() => messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 50);
      })
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [activeChat?.id]);

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

  // Gravação áudio
  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mr = new MediaRecorder(stream, { mimeType: 'audio/webm' });
      audioChunksRef.current = [];
      mr.ondataavailable = (e) => { if (e.data.size) audioChunksRef.current.push(e.data); };
      mr.onstop = async () => {
        const blob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        stream.getTracks().forEach(t => t.stop());
        const file = new File([blob], `audio-${Date.now()}.webm`, { type: 'audio/webm' });
        await sendFile(file);
      };
      mr.start();
      mediaRecorderRef.current = mr;
      setRecording(true);
    } catch (e) {
      toast({ title: 'Microfone bloqueado', description: 'Permita acesso ao microfone', variant: 'destructive' });
    }
  };

  const stopRecording = () => {
    mediaRecorderRef.current?.stop();
    setRecording(false);
  };

  // Adicionar como cliente
  const handleAddCliente = async () => {
    if (!activeChat || !user) return;
    const nomeFinal = novoClienteNome.trim() || activeChat.nome;
    if (!nomeFinal) {
      toast({ title: 'Nome obrigatório', variant: 'destructive' });
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

  // Mobile back
  const showList = !activeChat;

  return (
    <div className="h-full min-h-0 flex bg-background overflow-hidden">
      {/* Lista chats */}
      <div className={`${showList ? 'flex' : 'hidden'} md:flex flex-col w-full md:w-80 md:border-r border-border min-h-0`}>
        <div className="p-2.5 sm:p-3 border-b border-border space-y-2 bg-card shrink-0">
          <div className="flex items-center gap-2">
            <h2 className="text-base sm:text-lg font-bold text-foreground flex-1">Conversas</h2>
            <Button size="sm" variant="ghost" onClick={handleSync} disabled={loading} className="h-8 w-8 p-0">
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
            <div className="p-3 border-b border-border bg-card flex items-center gap-3">
              <Button variant="ghost" size="icon" className="md:hidden h-9 w-9" onClick={() => setActiveChat(null)}>
                <ArrowLeft className="h-5 w-5" />
              </Button>
              <Avatar className="h-10 w-10">
                <AvatarImage src={activeChat.profile_pic_url || undefined} />
                <AvatarFallback className="bg-primary/10 text-primary">{activeChat.nome?.[0]?.toUpperCase()}</AvatarFallback>
              </Avatar>
              <button
                type="button"
                onClick={() => setClienteInfoOpen(true)}
                className="flex-1 min-w-0 text-left hover:opacity-80 transition"
                title="Ver informações do cliente"
              >
                <div className="flex items-center gap-1">
                  <p className="font-semibold text-foreground truncate">{activeChat.nome}</p>
                  {activeChat.cliente_id && <BadgeCheck className="h-4 w-4 text-primary shrink-0" />}
                </div>
                <p className="text-xs text-muted-foreground">{activeChat.telefone}</p>
              </button>
              {!activeChat.cliente_id && (
                <Button size="sm" variant="outline" onClick={() => { setNovoClienteNome(activeChat.nome); setAddClienteOpen(true); }}>
                  <UserPlus className="h-4 w-4 mr-1" /> <span className="hidden sm:inline">Adicionar</span>
                </Button>
              )}
              <Button size="sm" variant="default" onClick={() => {
                if (!activeChat) return;
                window.dispatchEvent(new CustomEvent('whatsapp:agendar', {
                  detail: { nome: activeChat.nome, telefone: activeChat.telefone },
                }));
              }}>
                <CalendarPlus className="h-4 w-4 mr-1" /> <span className="hidden sm:inline">Agendar</span>
              </Button>
            </div>

            {/* Mensagens */}
            <ScrollArea className="flex-1 min-h-0 bg-muted/30">
              <div className="p-4 space-y-2">
                {messages.map((m) => (
                  <MessageBubble
                    key={m.id}
                    message={m}
                    quoted={m.quoted_message_id ? messages.find(x => x.message_id === m.quoted_message_id) || null : null}
                    onReply={() => setReplyTo(m)}
                  />
                ))}
                <div ref={messagesEndRef} />
              </div>
            </ScrollArea>

            {/* Reply preview */}
            {replyTo && (
              <div className="px-3 pt-2 border-t border-border bg-card">
                <div className="flex items-start gap-2 bg-muted/50 rounded-lg p-2 border-l-4 border-primary">
                  <div className="flex-1 min-w-0">
                    <p className="text-[11px] font-semibold text-primary">
                      {replyTo.from_me ? 'Você' : activeChat.nome}
                    </p>
                    <p className="text-xs text-muted-foreground truncate">
                      {replyTo.content || replyTo.caption || `[${replyTo.message_type}]`}
                    </p>
                  </div>
                  <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => setReplyTo(null)}>
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            )}

            {/* Input */}
            <div className="p-3 border-t border-border bg-card flex items-end gap-2">
              <input ref={fileInputRef} type="file" className="hidden" onChange={(e) => {
                const f = e.target.files?.[0]; if (f) sendFile(f); e.target.value = '';
              }} accept="image/*,video/*,audio/*,application/pdf,application/zip,image/gif" />
              <input ref={stickerInputRef} type="file" className="hidden" onChange={(e) => {
                const f = e.target.files?.[0]; if (f) sendFile(f, { asSticker: true }); e.target.value = '';
              }} accept="image/webp,image/png,image/jpeg" />
              <Button size="icon" variant="ghost" onClick={() => fileInputRef.current?.click()} title="Enviar arquivo, imagem, vídeo ou GIF">
                <Paperclip className="h-5 w-5" />
              </Button>
              <Button size="icon" variant="ghost" onClick={() => stickerInputRef.current?.click()} title="Enviar sticker">
                <Smile className="h-5 w-5" />
              </Button>
              <Input
                value={text}
                onChange={(e) => setText(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendText(); } }}
                placeholder={replyTo ? 'Responder...' : 'Digite uma mensagem...'}
                disabled={recording}
                className="flex-1"
              />
              {text.trim() ? (
                <Button size="icon" onClick={sendText}><Send className="h-5 w-5" /></Button>
              ) : recording ? (
                <Button size="icon" variant="destructive" onClick={stopRecording}><Square className="h-5 w-5" /></Button>
              ) : (
                <Button size="icon" variant="ghost" onClick={startRecording}><Mic className="h-5 w-5" /></Button>
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

      {/* Dialog info do cliente */}
      {activeChat && (
        <ClienteInfoDialog
          open={clienteInfoOpen}
          onOpenChange={setClienteInfoOpen}
          telefone={activeChat.telefone}
          nome={activeChat.nome}
        />
      )}

    </div>
  );
};

// Bubble com renderização de mídia + reply
const MessageBubble: React.FC<{
  message: Message;
  quoted?: Message | null;
  onReply?: () => void;
}> = ({ message, quoted, onReply }) => {
  const isMe = message.from_me;
  return (
    <div className={`group flex items-end gap-1 ${isMe ? 'justify-end' : 'justify-start'}`}>
      {isMe && onReply && (
        <button
          onClick={onReply}
          className="opacity-0 group-hover:opacity-100 transition p-1 rounded-full hover:bg-muted text-muted-foreground"
          title="Responder"
        >
          <Reply className="h-3.5 w-3.5" />
        </button>
      )}
      <div className={`max-w-[75%] rounded-2xl px-3 py-2 shadow-sm ${isMe ? 'bg-primary text-primary-foreground' : 'bg-card'}`}>
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
          <img src={message.media_url} alt="" className="rounded-lg max-w-xs mb-1 cursor-pointer" onClick={() => window.open(message.media_url!, '_blank')} />
        )}
        {message.message_type === 'video' && message.media_url && (
          <video src={message.media_url} controls className="rounded-lg max-w-xs mb-1" />
        )}
        {message.message_type === 'audio' && message.media_url && (
          <audio src={message.media_url} controls className="max-w-full" />
        )}
        {message.message_type === 'document' && message.media_url && (
          <a href={message.media_url} target="_blank" rel="noreferrer" className={`flex items-center gap-2 p-2 rounded ${isMe ? 'bg-primary-foreground/10' : 'bg-muted'}`}>
            <FileText className="h-5 w-5" />
            <span className="text-sm truncate">{message.media_filename || 'Arquivo'}</span>
            <Download className="h-4 w-4 ml-auto" />
          </a>
        )}
        {message.message_type === 'sticker' && message.media_url && (
          <img src={message.media_url} alt="sticker" className="w-32 h-32 object-contain" />
        )}
        {(message.content || message.caption) && (
          <p className="text-sm whitespace-pre-wrap break-words">{message.content || message.caption}</p>
        )}
        <p className={`text-[10px] mt-1 text-right ${isMe ? 'text-primary-foreground/70' : 'text-muted-foreground'}`}>
          {format(new Date(message.timestamp), 'HH:mm')}
        </p>
      </div>
      {!isMe && onReply && (
        <button
          onClick={onReply}
          className="opacity-0 group-hover:opacity-100 transition p-1 rounded-full hover:bg-muted text-muted-foreground"
          title="Responder"
        >
          <Reply className="h-3.5 w-3.5" />
        </button>
      )}
    </div>
  );
};

export default WhatsAppPage;
