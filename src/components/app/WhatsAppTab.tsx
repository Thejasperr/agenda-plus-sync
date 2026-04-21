import React, { useState, useEffect, useRef, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import {
  Search, Send, Mic, Paperclip, Image as ImageIcon, FileText, Video as VideoIcon,
  ArrowLeft, MoreVertical, Calendar, CheckCheck, Check, Download, Play, Pause, RefreshCw, BadgeCheck,
} from 'lucide-react';
import { format, isToday, isYesterday } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import AgendamentoQuickDialog from './AgendamentoQuickDialog';

interface Chat {
  id: string;
  remote_jid: string;
  telefone: string;
  nome: string;
  cliente_id: string | null;
  last_message: string | null;
  last_message_at: string | null;
  unread_count: number;
}

interface Message {
  id: string;
  message_id: string | null;
  from_me: boolean;
  message_type: string;
  content: string | null;
  caption: string | null;
  media_url: string | null;
  media_mime_type: string | null;
  media_filename: string | null;
  media_duration: number | null;
  status: string;
  timestamp: string;
}

const WhatsAppTab = () => {
  const [chats, setChats] = useState<Chat[]>([]);
  const [activeChat, setActiveChat] = useState<Chat | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [messageText, setMessageText] = useState('');
  const [sending, setSending] = useState(false);
  const [importing, setImporting] = useState(false);
  const [agendamentoOpen, setAgendamentoOpen] = useState(false);
  const [mediaUrls, setMediaUrls] = useState<Record<string, string>>({});
  const [recording, setRecording] = useState(false);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const recordedChunksRef = useRef<Blob[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const { toast } = useToast();

  const fetchChats = useCallback(async () => {
    const { data, error } = await supabase
      .from('whatsapp_chats')
      .select('*')
      .order('last_message_at', { ascending: false, nullsFirst: false });
    if (!error && data) setChats(data as Chat[]);
  }, []);

  const fetchMessages = useCallback(async (chatId: string) => {
    const { data, error } = await supabase
      .from('whatsapp_messages')
      .select('*')
      .eq('chat_id', chatId)
      .order('timestamp', { ascending: true })
      .limit(500);
    if (!error && data) setMessages(data as Message[]);
  }, []);

  useEffect(() => {
    fetchChats();

    const chatChannel = supabase
      .channel('wa-chats')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'whatsapp_chats' }, () => fetchChats())
      .subscribe();

    return () => { supabase.removeChannel(chatChannel); };
  }, [fetchChats]);

  useEffect(() => {
    if (!activeChat) return;
    fetchMessages(activeChat.id);

    // Reset unread
    supabase.from('whatsapp_chats').update({ unread_count: 0 }).eq('id', activeChat.id).then();

    const msgChannel = supabase
      .channel(`wa-msgs-${activeChat.id}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'whatsapp_messages', filter: `chat_id=eq.${activeChat.id}` },
        (payload) => {
          setMessages((prev) => {
            if (prev.find((m) => m.id === (payload.new as Message).id)) return prev;
            return [...prev, payload.new as Message];
          });
        },
      )
      .subscribe();

    return () => { supabase.removeChannel(msgChannel); };
  }, [activeChat, fetchMessages]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Generate signed URLs for media
  useEffect(() => {
    const toFetch = messages.filter((m) => m.media_url && !mediaUrls[m.media_url]);
    if (toFetch.length === 0) return;
    (async () => {
      const updates: Record<string, string> = {};
      for (const m of toFetch) {
        if (!m.media_url) continue;
        const { data } = await supabase.storage
          .from('whatsapp-media')
          .createSignedUrl(m.media_url, 60 * 60);
        if (data?.signedUrl) updates[m.media_url] = data.signedUrl;
      }
      if (Object.keys(updates).length) setMediaUrls((prev) => ({ ...prev, ...updates }));
    })();
  }, [messages, mediaUrls]);

  const sendText = async () => {
    if (!activeChat || !messageText.trim()) return;
    setSending(true);
    const text = messageText.trim();
    setMessageText('');
    const { error } = await supabase.functions.invoke('whatsapp-send', {
      body: { remote_jid: activeChat.remote_jid, type: 'text', text },
    });
    if (error) toast({ title: 'Erro ao enviar', description: error.message, variant: 'destructive' });
    setSending(false);
    fetchMessages(activeChat.id);
  };

  const fileToBase64 = (file: Blob): Promise<string> =>
    new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const result = reader.result as string;
        resolve(result.split(',')[1] || '');
      };
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });

  const sendFile = async (file: File) => {
    if (!activeChat) return;
    setSending(true);
    try {
      const base64 = await fileToBase64(file);
      let type: 'image' | 'video' | 'document' = 'document';
      if (file.type.startsWith('image/')) type = 'image';
      else if (file.type.startsWith('video/')) type = 'video';

      const { error } = await supabase.functions.invoke('whatsapp-send', {
        body: {
          remote_jid: activeChat.remote_jid,
          type,
          media_base64: base64,
          media_mime: file.type,
          filename: file.name,
        },
      });
      if (error) throw error;
      toast({ title: 'Enviado!' });
      fetchMessages(activeChat.id);
    } catch (e: any) {
      toast({ title: 'Erro ao enviar arquivo', description: e.message, variant: 'destructive' });
    } finally {
      setSending(false);
    }
  };

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mr = new MediaRecorder(stream);
      recordedChunksRef.current = [];
      mr.ondataavailable = (e) => { if (e.data.size > 0) recordedChunksRef.current.push(e.data); };
      mr.onstop = async () => {
        const blob = new Blob(recordedChunksRef.current, { type: 'audio/webm' });
        stream.getTracks().forEach((t) => t.stop());
        if (!activeChat) return;
        setSending(true);
        const base64 = await fileToBase64(blob);
        const { error } = await supabase.functions.invoke('whatsapp-send', {
          body: {
            remote_jid: activeChat.remote_jid,
            type: 'audio',
            media_base64: base64,
            media_mime: 'audio/webm',
          },
        });
        if (error) toast({ title: 'Erro ao enviar áudio', description: error.message, variant: 'destructive' });
        setSending(false);
        fetchMessages(activeChat.id);
      };
      mr.start();
      mediaRecorderRef.current = mr;
      setRecording(true);
    } catch (e: any) {
      toast({ title: 'Sem permissão de microfone', description: e.message, variant: 'destructive' });
    }
  };

  const stopRecording = () => {
    mediaRecorderRef.current?.stop();
    setRecording(false);
  };

  const importHistory = async () => {
    setImporting(true);
    const { data, error } = await supabase.functions.invoke('whatsapp-import-history', { body: {} });
    setImporting(false);
    if (error) {
      toast({ title: 'Erro ao importar', description: error.message, variant: 'destructive' });
    } else {
      toast({ title: 'Importação concluída', description: `${data?.imported ?? 0} conversas importadas` });
      fetchChats();
    }
  };

  const filteredChats = chats.filter((c) =>
    c.nome?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    c.telefone?.includes(searchTerm),
  );

  const formatTime = (ts: string | null) => {
    if (!ts) return '';
    const d = new Date(ts);
    if (isToday(d)) return format(d, 'HH:mm');
    if (isYesterday(d)) return 'Ontem';
    return format(d, 'dd/MM', { locale: ptBR });
  };

  return (
    <div className="flex h-[calc(100vh-180px)] gap-3 p-3">
      {/* Chat list */}
      <div className={`${activeChat ? 'hidden md:flex' : 'flex'} flex-col w-full md:w-80 bg-card rounded-2xl border border-border/40 shadow-sm overflow-hidden`}>
        <div className="p-3 border-b border-border/40 bg-gradient-to-r from-primary/5 to-transparent">
          <div className="flex items-center justify-between mb-2">
            <h2 className="font-bold text-foreground">Conversas</h2>
            <Button size="sm" variant="ghost" onClick={importHistory} disabled={importing} title="Importar histórico">
              <RefreshCw size={16} className={importing ? 'animate-spin' : ''} />
            </Button>
          </div>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" size={16} />
            <Input
              placeholder="Buscar conversa..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-9 h-9 rounded-xl"
            />
          </div>
        </div>

        <ScrollArea className="flex-1">
          {filteredChats.length === 0 ? (
            <div className="text-center text-muted-foreground p-8 text-sm">
              Nenhuma conversa.<br />Clique em <RefreshCw size={14} className="inline" /> para importar.
            </div>
          ) : (
            filteredChats.map((chat) => (
              <button
                key={chat.id}
                onClick={() => setActiveChat(chat)}
                className={`w-full flex items-center gap-3 p-3 hover:bg-accent/50 transition-colors border-b border-border/30 text-left ${
                  activeChat?.id === chat.id ? 'bg-accent/70' : ''
                }`}
              >
                <Avatar className="h-11 w-11 ring-2 ring-primary/10">
                  <AvatarFallback className="bg-gradient-to-br from-primary/20 to-primary/5 text-primary font-semibold">
                    {chat.nome.charAt(0).toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-semibold truncate flex items-center gap-1">
                      {chat.nome}
                      {chat.cliente_id && (
                        <BadgeCheck size={14} className="text-primary shrink-0" />
                      )}
                    </span>
                    <span className="text-[10px] text-muted-foreground shrink-0">
                      {formatTime(chat.last_message_at)}
                    </span>
                  </div>
                  <div className="flex items-center justify-between gap-2 mt-0.5">
                    <span className="text-xs text-muted-foreground truncate">{chat.last_message || '...'}</span>
                    {chat.unread_count > 0 && (
                      <Badge className="h-5 min-w-5 px-1.5 rounded-full bg-primary text-[10px]">
                        {chat.unread_count}
                      </Badge>
                    )}
                  </div>
                </div>
              </button>
            ))
          )}
        </ScrollArea>
      </div>

      {/* Conversation */}
      <div className={`${activeChat ? 'flex' : 'hidden md:flex'} flex-col flex-1 bg-card rounded-2xl border border-border/40 shadow-sm overflow-hidden`}>
        {!activeChat ? (
          <div className="flex-1 flex flex-col items-center justify-center text-muted-foreground p-8">
            <div className="w-20 h-20 rounded-full bg-primary/10 flex items-center justify-center mb-4">
              <Send size={32} className="text-primary" />
            </div>
            <p className="font-semibold text-foreground">Selecione uma conversa</p>
            <p className="text-sm mt-1">Escolha um contato ao lado para começar</p>
          </div>
        ) : (
          <>
            {/* Header */}
            <div className="flex items-center gap-3 p-3 border-b border-border/40 bg-gradient-to-r from-primary/5 to-transparent">
              <Button size="icon" variant="ghost" className="md:hidden h-9 w-9" onClick={() => setActiveChat(null)}>
                <ArrowLeft size={18} />
              </Button>
              <Avatar className="h-10 w-10 ring-2 ring-primary/20">
                <AvatarFallback className="bg-gradient-to-br from-primary/20 to-primary/5 text-primary font-semibold">
                  {activeChat.nome.charAt(0).toUpperCase()}
                </AvatarFallback>
              </Avatar>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1 font-semibold">
                  <span className="truncate">{activeChat.nome}</span>
                  {activeChat.cliente_id && <BadgeCheck size={16} className="text-primary shrink-0" />}
                </div>
                <p className="text-xs text-muted-foreground">{activeChat.telefone}</p>
              </div>
              <Button size="sm" onClick={() => setAgendamentoOpen(true)} className="gap-1.5">
                <Calendar size={16} /> Agendar
              </Button>
            </div>

            {/* Messages */}
            <ScrollArea className="flex-1 px-3 py-4 bg-[hsl(var(--muted))]/30">
              <div className="space-y-2 max-w-3xl mx-auto">
                {messages.map((m) => (
                  <MessageBubble key={m.id} message={m} mediaUrl={m.media_url ? mediaUrls[m.media_url] : undefined} />
                ))}
                <div ref={messagesEndRef} />
              </div>
            </ScrollArea>

            {/* Composer */}
            <div className="p-3 border-t border-border/40 bg-card">
              <div className="flex items-end gap-2">
                <input
                  ref={fileInputRef}
                  type="file"
                  className="hidden"
                  accept="image/*,video/*,application/pdf,.doc,.docx,.xls,.xlsx"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) sendFile(f);
                    e.target.value = '';
                  }}
                />
                <Button size="icon" variant="ghost" onClick={() => fileInputRef.current?.click()} disabled={sending}>
                  <Paperclip size={18} />
                </Button>
                <Input
                  value={messageText}
                  onChange={(e) => setMessageText(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendText(); } }}
                  placeholder="Digite uma mensagem..."
                  className="flex-1"
                  disabled={sending || recording}
                />
                {messageText.trim() ? (
                  <Button size="icon" onClick={sendText} disabled={sending}>
                    <Send size={18} />
                  </Button>
                ) : (
                  <Button
                    size="icon"
                    variant={recording ? 'destructive' : 'default'}
                    onClick={recording ? stopRecording : startRecording}
                    disabled={sending}
                  >
                    <Mic size={18} className={recording ? 'animate-pulse' : ''} />
                  </Button>
                )}
              </div>
            </div>
          </>
        )}
      </div>

      {activeChat && (
        <AgendamentoQuickDialog
          open={agendamentoOpen}
          onOpenChange={setAgendamentoOpen}
          nome={activeChat.nome}
          telefone={activeChat.telefone}
        />
      )}
    </div>
  );
};

const MessageBubble = ({ message, mediaUrl }: { message: Message; mediaUrl?: string }) => {
  const time = format(new Date(message.timestamp), 'HH:mm');
  const isMe = message.from_me;

  return (
    <div className={`flex ${isMe ? 'justify-end' : 'justify-start'}`}>
      <div
        className={`max-w-[75%] rounded-2xl px-3 py-2 shadow-sm ${
          isMe
            ? 'bg-primary text-primary-foreground rounded-br-sm'
            : 'bg-card text-foreground border border-border/40 rounded-bl-sm'
        }`}
      >
        <MediaContent message={message} mediaUrl={mediaUrl} />
        {(message.content || message.caption) && (
          <p className="text-sm whitespace-pre-wrap break-words">{message.content || message.caption}</p>
        )}
        <div className={`flex items-center justify-end gap-1 mt-1 text-[10px] ${isMe ? 'text-primary-foreground/70' : 'text-muted-foreground'}`}>
          <span>{time}</span>
          {isMe && (message.status === 'read' ? <CheckCheck size={12} /> : <Check size={12} />)}
        </div>
      </div>
    </div>
  );
};

const MediaContent = ({ message, mediaUrl }: { message: Message; mediaUrl?: string }) => {
  if (!message.media_url) return null;
  if (!mediaUrl) {
    return <div className="w-48 h-32 bg-muted rounded-lg animate-pulse mb-2" />;
  }

  switch (message.message_type) {
    case 'image':
      return <img src={mediaUrl} alt="" className="rounded-lg max-w-full max-h-80 mb-2 cursor-pointer" onClick={() => window.open(mediaUrl, '_blank')} />;
    case 'video':
      return <video src={mediaUrl} controls className="rounded-lg max-w-full max-h-80 mb-2" />;
    case 'audio':
      return <audio src={mediaUrl} controls className="mb-2 max-w-full" />;
    case 'document':
      return (
        <a href={mediaUrl} target="_blank" rel="noreferrer" className="flex items-center gap-2 p-2 bg-background/20 rounded-lg mb-2 hover:bg-background/30 transition-colors">
          <FileText size={20} />
          <span className="text-sm truncate flex-1">{message.media_filename || 'Documento'}</span>
          <Download size={16} />
        </a>
      );
    case 'sticker':
      return <img src={mediaUrl} alt="sticker" className="w-32 h-32 mb-2" />;
    default:
      return null;
  }
};

export default WhatsAppTab;
