import React, { useEffect, useRef, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import { Search, ArrowLeft, RefreshCw, MessageCircle, BadgeCheck, UserPlus, CalendarPlus, Send, Paperclip, Mic, Square, Image as ImageIcon, Video, FileText, Play, Pause, Download, Users as UsersIcon, User as UserIcon } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

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
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [text, setText] = useState('');
  const [recording, setRecording] = useState(false);
  const [addClienteOpen, setAddClienteOpen] = useState(false);
  const [agendarOpen, setAgendarOpen] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);

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

  // Realtime chats
  useEffect(() => {
    if (!user) return;
    const ch = supabase.channel('wa-chats')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'whatsapp_chats', filter: `user_id=eq.${user.id}` }, () => loadChats())
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

  const filteredChats = chats.filter(c =>
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

  // Enviar texto
  const sendText = async () => {
    if (!text.trim() || !activeChat) return;
    setSending(true);
    const content = text;
    setText('');
    const { error } = await supabase.functions.invoke('whatsapp-send', {
      body: { chat_id: activeChat.id, remote_jid: activeChat.remote_jid, type: 'text', content },
    });
    setSending(false);
    if (error) toast({ title: 'Erro ao enviar', description: error.message, variant: 'destructive' });
  };

  // Enviar arquivo
  const sendFile = async (file: File) => {
    if (!activeChat) return;
    setSending(true);
    const reader = new FileReader();
    reader.onload = async () => {
      const base64 = (reader.result as string).split(',')[1];
      let type: 'image' | 'video' | 'document' | 'audio' = 'document';
      if (file.type.startsWith('image/')) type = 'image';
      else if (file.type.startsWith('video/')) type = 'video';
      else if (file.type.startsWith('audio/')) type = 'audio';

      const { error } = await supabase.functions.invoke('whatsapp-send', {
        body: {
          chat_id: activeChat.id, remote_jid: activeChat.remote_jid, type,
          media_base64: base64, media_mime: file.type, filename: file.name,
        },
      });
      setSending(false);
      if (error) toast({ title: 'Erro ao enviar', description: error.message, variant: 'destructive' });
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
    const { data, error } = await supabase.from('clientes').insert({
      nome: activeChat.nome, telefone: activeChat.telefone, user_id: user.id,
    }).select('id').single();
    if (error) { toast({ title: 'Erro', description: error.message, variant: 'destructive' }); return; }
    await supabase.from('whatsapp_chats').update({ cliente_id: data.id }).eq('id', activeChat.id);
    setActiveChat({ ...activeChat, cliente_id: data.id });
    setAddClienteOpen(false);
    toast({ title: 'Cliente adicionado!' });
    loadChats();
  };

  // Mobile back
  const showList = !activeChat;

  return (
    <div className="h-full flex bg-background">
      {/* Lista chats */}
      <div className={`${showList ? 'flex' : 'hidden'} md:flex flex-col w-full md:w-80 md:border-r border-border`}>
        <div className="p-3 border-b border-border space-y-2 bg-card">
          <div className="flex items-center gap-2">
            <h2 className="text-lg font-bold text-foreground flex-1">Conversas</h2>
            <Button size="sm" variant="ghost" onClick={handleSync} disabled={loading}>
              <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            </Button>
          </div>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Buscar conversa..." className="pl-9 h-10" />
          </div>
        </div>
        <ScrollArea className="flex-1">
          {filteredChats.length === 0 && !loading && (
            <div className="p-6 text-center text-sm text-muted-foreground">
              Nenhuma conversa. Clique em <RefreshCw className="inline h-3 w-3" /> para sincronizar.
            </div>
          )}
          {filteredChats.map((chat) => (
            <button
              key={chat.id}
              onClick={() => setActiveChat(chat)}
              className={`w-full flex items-center gap-3 p-3 hover:bg-muted/50 transition border-b border-border/50 text-left ${activeChat?.id === chat.id ? 'bg-muted' : ''}`}
            >
              <Avatar className="h-12 w-12">
                <AvatarImage src={chat.profile_pic_url || undefined} />
                <AvatarFallback className="bg-primary/10 text-primary">{chat.nome?.[0]?.toUpperCase() || '?'}</AvatarFallback>
              </Avatar>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1">
                  <p className="font-semibold text-sm truncate text-foreground">{chat.nome}</p>
                  {chat.cliente_id && <BadgeCheck className="h-4 w-4 text-primary shrink-0" />}
                </div>
                <p className="text-xs text-muted-foreground truncate">{chat.last_message || chat.telefone}</p>
              </div>
              <div className="flex flex-col items-end gap-1">
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
          ))}
        </ScrollArea>
      </div>

      {/* Conversa */}
      <div className={`${showList ? 'hidden' : 'flex'} md:flex flex-1 flex-col`}>
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
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1">
                  <p className="font-semibold text-foreground truncate">{activeChat.nome}</p>
                  {activeChat.cliente_id && <BadgeCheck className="h-4 w-4 text-primary shrink-0" />}
                </div>
                <p className="text-xs text-muted-foreground">{activeChat.telefone}</p>
              </div>
              {!activeChat.cliente_id && (
                <Button size="sm" variant="outline" onClick={() => setAddClienteOpen(true)}>
                  <UserPlus className="h-4 w-4 mr-1" /> <span className="hidden sm:inline">Adicionar</span>
                </Button>
              )}
              <Button size="sm" variant="default" onClick={() => setAgendarOpen(true)}>
                <CalendarPlus className="h-4 w-4 mr-1" /> <span className="hidden sm:inline">Agendar</span>
              </Button>
            </div>

            {/* Mensagens */}
            <ScrollArea className="flex-1 bg-muted/30">
              <div className="p-4 space-y-2">
                {messages.map((m) => <MessageBubble key={m.id} message={m} />)}
                <div ref={messagesEndRef} />
              </div>
            </ScrollArea>

            {/* Input */}
            <div className="p-3 border-t border-border bg-card flex items-end gap-2">
              <input ref={fileInputRef} type="file" className="hidden" onChange={(e) => {
                const f = e.target.files?.[0]; if (f) sendFile(f); e.target.value = '';
              }} accept="image/*,video/*,audio/*,application/pdf,application/zip" />
              <Button size="icon" variant="ghost" onClick={() => fileInputRef.current?.click()} disabled={sending}>
                <Paperclip className="h-5 w-5" />
              </Button>
              <Input
                value={text}
                onChange={(e) => setText(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendText(); } }}
                placeholder="Digite uma mensagem..."
                disabled={sending || recording}
                className="flex-1"
              />
              {text.trim() ? (
                <Button size="icon" onClick={sendText} disabled={sending}><Send className="h-5 w-5" /></Button>
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
          <div className="space-y-2">
            <p className="text-sm">Salvar este contato como cliente?</p>
            <p><strong>Nome:</strong> {activeChat?.nome}</p>
            <p><strong>Telefone:</strong> {activeChat?.telefone}</p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAddClienteOpen(false)}>Cancelar</Button>
            <Button onClick={handleAddCliente}>Adicionar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog agendar inline */}
      <AgendarInlineDialog
        open={agendarOpen}
        onOpenChange={setAgendarOpen}
        chat={activeChat}
        onCreated={() => { toast({ title: 'Agendamento criado!' }); }}
      />
    </div>
  );
};

// Bubble com renderização de mídia
const MessageBubble: React.FC<{ message: Message }> = ({ message }) => {
  const isMe = message.from_me;
  return (
    <div className={`flex ${isMe ? 'justify-end' : 'justify-start'}`}>
      <div className={`max-w-[75%] rounded-2xl px-3 py-2 shadow-sm ${isMe ? 'bg-primary text-primary-foreground' : 'bg-card'}`}>
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
    </div>
  );
};

// Dialog rápido de agendamento
const AgendarInlineDialog: React.FC<{
  open: boolean;
  onOpenChange: (b: boolean) => void;
  chat: Chat | null;
  onCreated: () => void;
}> = ({ open, onOpenChange, chat, onCreated }) => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [data, setData] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [hora, setHora] = useState('09:00');
  const [servicoId, setServicoId] = useState('');
  const [preco, setPreco] = useState('');
  const [servicos, setServicos] = useState<any[]>([]);

  useEffect(() => {
    if (!open || !user) return;
    supabase.from('servicos').select('*').eq('user_id', user.id).then(({ data }) => setServicos(data || []));
  }, [open, user]);

  useEffect(() => {
    const s = servicos.find((x) => x.id === servicoId);
    if (s) setPreco(String(s.valor));
  }, [servicoId, servicos]);

  const handleSave = async () => {
    if (!chat || !user) return;
    const { error } = await supabase.from('agendamentos').insert({
      user_id: user.id, nome: chat.nome, telefone: chat.telefone,
      data_agendamento: data, hora_agendamento: hora,
      procedimento_id: servicoId || null, preco: parseFloat(preco || '0'),
      status: 'A fazer',
    });
    if (error) { toast({ title: 'Erro', description: error.message, variant: 'destructive' }); return; }
    onCreated();
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader><DialogTitle>Agendar — {chat?.nome}</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-2">
            <div><Label>Data</Label><Input type="date" value={data} onChange={(e) => setData(e.target.value)} /></div>
            <div><Label>Hora</Label><Input type="time" value={hora} onChange={(e) => setHora(e.target.value)} /></div>
          </div>
          <div>
            <Label>Serviço</Label>
            <select value={servicoId} onChange={(e) => setServicoId(e.target.value)} className="w-full h-11 rounded-xl border border-border/60 bg-background px-4 text-sm">
              <option value="">Selecione…</option>
              {servicos.map((s) => <option key={s.id} value={s.id}>{s.nome_procedimento} — R$ {s.valor}</option>)}
            </select>
          </div>
          <div><Label>Preço (R$)</Label><Input type="number" step="0.01" value={preco} onChange={(e) => setPreco(e.target.value)} /></div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={handleSave}>Agendar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default WhatsAppPage;
