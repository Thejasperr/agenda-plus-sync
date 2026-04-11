import React, { useState, useEffect, useRef, useCallback } from 'react';
import { ArrowLeft, Send, Paperclip, Mic, Image, Video, File, Search, Phone, MoreVertical, Check, CheckCheck, Smile, X, Wifi, WifiOff, Zap } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { useEvolutionApi, type Chat, type Message } from '@/hooks/useEvolutionApi';
import { useEvolutionWebSocket } from '@/hooks/useEvolutionWebSocket';
import { useToast } from '@/hooks/use-toast';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

const safeSortMessages = (msgs: any[]): any[] => {
  if (!Array.isArray(msgs)) return [];
  return [...msgs].sort((a, b) => {
    const ta = typeof a?.messageTimestamp === 'number' ? a.messageTimestamp : parseInt(a?.messageTimestamp) || 0;
    const tb = typeof b?.messageTimestamp === 'number' ? b.messageTimestamp : parseInt(b?.messageTimestamp) || 0;
    return ta - tb;
  });
};

const WhatsAppTab = () => {
  const [chats, setChats] = useState<Chat[]>([]);
  const [selectedChat, setSelectedChat] = useState<Chat | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [messageText, setMessageText] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [showAttachMenu, setShowAttachMenu] = useState(false);
  const [isConnected, setIsConnected] = useState<boolean | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();
  const { loading, error, fetchChats, fetchMessages, sendText, sendMedia, sendAudio, checkConnection } = useEvolutionApi();

  // Check connection on mount
  useEffect(() => {
    checkConnection().then(state => {
      setIsConnected(state?.instance?.state === 'open');
    });
  }, [checkConnection]);

  // Load chats
  useEffect(() => {
    fetchChats().then(data => {
      const sorted = data.sort((a, b) => (b.lastMessageTimestamp || 0) - (a.lastMessageTimestamp || 0));
      setChats(sorted);
    });
  }, [fetchChats]);

  // Load messages when chat selected
  useEffect(() => {
    if (selectedChat) {
      fetchMessages(selectedChat.remoteJid).then(msgs => {
        setMessages(msgs.sort((a, b) => (a.messageTimestamp || 0) - (b.messageTimestamp || 0)));
        setTimeout(() => messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 100);
      });
    }
  }, [selectedChat, fetchMessages]);

  // Auto-refresh messages
  useEffect(() => {
    if (!selectedChat) return;
    const interval = setInterval(() => {
      fetchMessages(selectedChat.remoteJid).then(msgs => {
        setMessages(msgs.sort((a, b) => (a.messageTimestamp || 0) - (b.messageTimestamp || 0)));
      });
    }, 5000);
    return () => clearInterval(interval);
  }, [selectedChat, fetchMessages]);

  const handleSendMessage = async () => {
    if (!messageText.trim() || !selectedChat) return;
    const number = selectedChat.remoteJid.replace('@s.whatsapp.net', '').replace('@g.us', '');
    try {
      await sendText(number, messageText);
      setMessageText('');
      // Refresh messages
      const msgs = await fetchMessages(selectedChat.remoteJid);
      setMessages(msgs.sort((a, b) => (a.messageTimestamp || 0) - (b.messageTimestamp || 0)));
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
      const base64 = reader.result as string;
      const number = selectedChat.remoteJid.replace('@s.whatsapp.net', '').replace('@g.us', '');
      try {
        await sendMedia(number, mediatype, base64, '', file.name);
        toast({ title: 'Sucesso', description: 'Mídia enviada!' });
        const msgs = await fetchMessages(selectedChat.remoteJid);
        setMessages(msgs.sort((a, b) => (a.messageTimestamp || 0) - (b.messageTimestamp || 0)));
      } catch {
        toast({ title: 'Erro', description: 'Falha ao enviar mídia', variant: 'destructive' });
      }
    };
    reader.readAsDataURL(file);
    setShowAttachMenu(false);
  };

  const handleAudioRecord = async () => {
    if (!selectedChat) return;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      const chunks: Blob[] = [];

      mediaRecorder.ondataavailable = (e) => chunks.push(e.data);
      mediaRecorder.onstop = async () => {
        const blob = new Blob(chunks, { type: 'audio/ogg; codecs=opus' });
        const reader = new FileReader();
        reader.onload = async () => {
          const base64 = reader.result as string;
          const number = selectedChat.remoteJid.replace('@s.whatsapp.net', '').replace('@g.us', '');
          try {
            await sendAudio(number, base64);
            toast({ title: 'Sucesso', description: 'Áudio enviado!' });
            const msgs = await fetchMessages(selectedChat.remoteJid);
            setMessages(msgs.sort((a, b) => (a.messageTimestamp || 0) - (b.messageTimestamp || 0)));
          } catch {
            toast({ title: 'Erro', description: 'Falha ao enviar áudio', variant: 'destructive' });
          }
        };
        reader.readAsDataURL(blob);
        stream.getTracks().forEach(t => t.stop());
      };

      mediaRecorder.start();
      toast({ title: 'Gravando...', description: 'Clique novamente para parar (3s max)' });
      setTimeout(() => {
        if (mediaRecorder.state === 'recording') mediaRecorder.stop();
      }, 3000);
    } catch {
      toast({ title: 'Erro', description: 'Permissão de microfone negada', variant: 'destructive' });
    }
  };

  const getMessageContent = (msg: any): string => {
    try {
      const m = msg.message;
      if (!m) return '';
      if (typeof m === 'string') return m;
      if (typeof m.conversation === 'string') return m.conversation;
      if (typeof m.extendedTextMessage?.text === 'string') return m.extendedTextMessage.text;
      if (m.imageMessage) return '📷 Imagem';
      if (m.videoMessage) return '🎥 Vídeo';
      if (m.audioMessage) return '🎵 Áudio';
      if (m.documentMessage) return `📄 ${typeof m.documentMessage?.fileName === 'string' ? m.documentMessage.fileName : 'Documento'}`;
      if (m.stickerMessage) return '🎃 Sticker';
      if (m.contactMessage) return '👤 Contato';
      if (m.locationMessage) return '📍 Localização';
      return '💬 Mensagem';
    } catch {
      return '💬 Mensagem';
    }
  };

  const getContactName = (chat: any): string => {
    if (chat.name && typeof chat.name === 'string') return chat.name;
    const jid = typeof chat.remoteJid === 'string' ? chat.remoteJid : '';
    return jid.replace('@s.whatsapp.net', '').replace('@g.us', '');
  };

  const getInitials = (name: string): string => {
    if (!name) return '??';
    return name.split(' ').filter(Boolean).map(w => w[0]).slice(0, 2).join('').toUpperCase() || '??';
  };

  const safeString = (val: any): string => {
    if (typeof val === 'string') return val;
    if (val === null || val === undefined) return '';
    return '';
  };

  const formatTime = (timestamp?: number): string => {
    if (!timestamp) return '';
    const date = new Date(timestamp * 1000);
    return format(date, 'HH:mm', { locale: ptBR });
  };

  const formatDate = (timestamp?: number): string => {
    if (!timestamp) return '';
    const date = new Date(timestamp * 1000);
    const today = new Date();
    if (date.toDateString() === today.toDateString()) return 'Hoje';
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    if (date.toDateString() === yesterday.toDateString()) return 'Ontem';
    return format(date, 'dd/MM/yyyy', { locale: ptBR });
  };

  const filteredChats = chats.filter(chat => {
    const name = getContactName(chat).toLowerCase();
    return name.includes(searchQuery.toLowerCase());
  });

  // Chat list view
  if (!selectedChat) {
    return (
      <div className="flex flex-col h-full">
        {/* Header */}
        <div className="p-4 border-b border-border/50">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-lg font-bold text-foreground">WhatsApp</h2>
            <div className="flex items-center gap-2">
              {isConnected !== null && (
                <span className={`flex items-center gap-1 text-xs px-2 py-1 rounded-full ${
                  isConnected ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
                }`}>
                  {isConnected ? <Wifi size={12} /> : <WifiOff size={12} />}
                  {isConnected ? 'Conectado' : 'Desconectado'}
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

        {/* Chat list */}
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
              {filteredChats.map((chat) => {
                const name = getContactName(chat);
                const isGroup = chat.remoteJid?.includes('@g.us');
                return (
                  <button
                    key={chat.id || chat.remoteJid}
                    onClick={() => setSelectedChat(chat)}
                    className="w-full flex items-center gap-3 px-4 py-3 hover:bg-secondary/50 transition-colors text-left"
                  >
                    <Avatar className="h-12 w-12 shrink-0">
                      <AvatarFallback className={`text-sm font-medium ${isGroup ? 'bg-accent text-accent-foreground' : 'bg-primary/10 text-primary'}`}>
                        {getInitials(name)}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between">
                        <span className="font-medium text-sm truncate">{name}</span>
                        <span className="text-[10px] text-muted-foreground shrink-0">
                          {formatTime(typeof chat.lastMessageTimestamp === 'number' ? chat.lastMessageTimestamp : undefined)}
                        </span>
                      </div>
                      <p className="text-xs text-muted-foreground truncate mt-0.5">
                        {safeString(chat.lastMessage) || 'Sem mensagens'}
                      </p>
                    </div>
                    {typeof chat.unreadCount === 'number' && chat.unreadCount > 0 && (
                      <span className="bg-primary text-primary-foreground text-[10px] font-bold rounded-full h-5 min-w-5 flex items-center justify-center px-1">
                        {chat.unreadCount}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          )}
        </ScrollArea>

        {error && (
          <div className="p-3 bg-destructive/10 text-destructive text-xs text-center">
            {error}
          </div>
        )}
      </div>
    );
  }

  // Message view
  return (
    <div className="flex flex-col h-full">
      {/* Chat header */}
      <div className="flex items-center gap-3 px-3 py-2 border-b border-border/50 bg-card">
        <button onClick={() => setSelectedChat(null)} className="p-1.5 hover:bg-secondary rounded-lg transition-colors">
          <ArrowLeft size={20} />
        </button>
        <Avatar className="h-10 w-10">
          <AvatarFallback className="text-xs font-medium bg-primary/10 text-primary">
            {getInitials(getContactName(selectedChat))}
          </AvatarFallback>
        </Avatar>
        <div className="flex-1 min-w-0">
          <h3 className="font-medium text-sm truncate">{getContactName(selectedChat)}</h3>
          <p className="text-[10px] text-muted-foreground">
            {selectedChat.remoteJid?.includes('@g.us') ? 'Grupo' : 'Online'}
          </p>
        </div>
      </div>

      {/* Messages */}
      <ScrollArea className="flex-1 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjAiIGhlaWdodD0iNjAiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+PGRlZnM+PHBhdHRlcm4gaWQ9InAiIHdpZHRoPSI2MCIgaGVpZ2h0PSI2MCIgcGF0dGVyblVuaXRzPSJ1c2VyU3BhY2VPblVzZSI+PHBhdGggZD0iTTMwIDBMMzAgNjBNMCA2MEw2MCAwIiBzdHJva2U9InJnYmEoMCwwLDAsMC4wMykiIHN0cm9rZS13aWR0aD0iMSIvPjwvcGF0dGVybj48L2RlZnM+PHJlY3Qgd2lkdGg9IjYwIiBoZWlnaHQ9IjYwIiBmaWxsPSJ1cmwoI3ApIi8+PC9zdmc+')] bg-secondary/20">
        <div className="p-3 space-y-1">
          {messages.length === 0 && !loading && (
            <div className="text-center py-12 text-muted-foreground text-sm">
              Nenhuma mensagem ainda
            </div>
          )}
          {(() => {
            let lastDate = '';
            return messages.map((msg: any, i) => {
              const content = getMessageContent(msg);
              const msgKey = msg.key || {};
              const fromMe = msgKey.fromMe === true;
              const timestamp = typeof msg.messageTimestamp === 'number' ? msg.messageTimestamp : 
                                typeof msg.messageTimestamp === 'string' ? parseInt(msg.messageTimestamp) : 0;
              const time = formatTime(timestamp || undefined);
              const dateStr = formatDate(timestamp || undefined);
              const showDate = dateStr !== lastDate;
              if (showDate) lastDate = dateStr;
              const keyId = typeof msgKey.id === 'string' ? msgKey.id : String(msg.id || i);
              const pushName = typeof msg.pushName === 'string' ? msg.pushName : '';

              return (
                <React.Fragment key={keyId}>
                  {showDate && dateStr && (
                    <div className="flex justify-center my-2">
                      <span className="text-[10px] bg-card/80 backdrop-blur-sm text-muted-foreground px-3 py-1 rounded-full shadow-sm">
                        {dateStr}
                      </span>
                    </div>
                  )}
                  <div className={`flex ${fromMe ? 'justify-end' : 'justify-start'}`}>
                    <div className={`max-w-[80%] px-3 py-1.5 rounded-xl shadow-sm ${
                      fromMe
                        ? 'bg-primary/15 text-foreground rounded-tr-sm'
                        : 'bg-card text-foreground rounded-tl-sm'
                    }`}>
                      {!fromMe && pushName && (
                        <p className="text-[10px] font-medium text-primary mb-0.5">{pushName}</p>
                      )}
                      
                      {/* Media rendering */}
                      {msg.message?.imageMessage && (
                        <div className="mb-1 rounded-lg overflow-hidden bg-secondary/30">
                          <div className="flex items-center gap-2 p-3 text-xs text-muted-foreground">
                            <Image size={16} /> Imagem
                          </div>
                        </div>
                      )}
                      {msg.message?.videoMessage && (
                        <div className="mb-1 rounded-lg overflow-hidden bg-secondary/30">
                          <div className="flex items-center gap-2 p-3 text-xs text-muted-foreground">
                            <Video size={16} /> Vídeo
                          </div>
                        </div>
                      )}
                      {msg.message?.audioMessage && (
                        <div className="mb-1 rounded-lg overflow-hidden bg-secondary/30">
                          <div className="flex items-center gap-2 p-3 text-xs text-muted-foreground">
                            <Mic size={16} /> Áudio
                          </div>
                        </div>
                      )}
                      {msg.message?.documentMessage && (
                        <div className="mb-1 rounded-lg overflow-hidden bg-secondary/30">
                          <div className="flex items-center gap-2 p-3 text-xs text-muted-foreground">
                            <File size={16} /> {msg.message.documentMessage.fileName || 'Documento'}
                          </div>
                        </div>
                      )}

                      {!msg.message?.imageMessage && !msg.message?.videoMessage && !msg.message?.audioMessage && !msg.message?.documentMessage && (
                        <p className="text-sm whitespace-pre-wrap break-words">{content}</p>
                      )}

                      <div className={`flex items-center gap-1 mt-0.5 ${fromMe ? 'justify-end' : 'justify-start'}`}>
                        <span className="text-[9px] text-muted-foreground">{time}</span>
                        {fromMe && <CheckCheck size={12} className="text-primary/60" />}
                      </div>
                    </div>
                  </div>
                </React.Fragment>
              );
            });
          })()}
          <div ref={messagesEndRef} />
        </div>
      </ScrollArea>

      {/* Attachment menu */}
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

      {/* Input area */}
      <div className="flex items-center gap-2 px-3 py-2 border-t border-border/50 bg-card">
        <button
          onClick={() => setShowAttachMenu(!showAttachMenu)}
          className="p-2 hover:bg-secondary rounded-full transition-colors text-muted-foreground"
        >
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
          <button
            onClick={handleSendMessage}
            disabled={loading}
            className="p-2 bg-primary text-primary-foreground rounded-full hover:opacity-90 transition-all"
          >
            <Send size={18} />
          </button>
        ) : (
          <button
            onClick={handleAudioRecord}
            className="p-2 hover:bg-secondary rounded-full transition-colors text-muted-foreground"
          >
            <Mic size={18} />
          </button>
        )}
      </div>
    </div>
  );
};

export default WhatsAppTab;
