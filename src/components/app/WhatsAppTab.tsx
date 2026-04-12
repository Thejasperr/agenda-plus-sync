import React, { useState, useEffect, useRef, useCallback } from 'react';
import { ArrowLeft, Send, Paperclip, Mic, Image, Video, File, Search, Phone, MoreVertical, Check, CheckCheck, Smile, X, Wifi, WifiOff, Zap, MicOff, Square } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { useEvolutionApi, type Chat, type Message } from '@/hooks/useEvolutionApi';
import { useEvolutionWebSocket } from '@/hooks/useEvolutionWebSocket';
import { useToast } from '@/hooks/use-toast';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

// Ensure any value is a string before rendering
const safe = (val: any): string => {
  if (val === null || val === undefined) return '';
  if (typeof val === 'string') return val;
  if (typeof val === 'number' || typeof val === 'boolean') return String(val);
  return '';
};

const safeNum = (val: any): number => {
  if (typeof val === 'number' && !isNaN(val)) return val;
  if (typeof val === 'string') { const n = parseInt(val); return isNaN(n) ? 0 : n; }
  return 0;
};

const safeSortMessages = (msgs: any[]): any[] => {
  if (!Array.isArray(msgs)) return [];
  return [...msgs].sort((a, b) => safeNum(a?.messageTimestamp) - safeNum(b?.messageTimestamp));
};

const cleanBase64 = (base64String: string): string => {
  if (!base64String) return '';
  // Keep the data URI prefix - Evolution API accepts it
  return base64String.trim();
};

const WhatsAppTab = () => {
  const [chats, setChats] = useState<Chat[]>([]);
  const [selectedChat, setSelectedChat] = useState<Chat | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [messageText, setMessageText] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [showAttachMenu, setShowAttachMenu] = useState(false);
  const [isConnected, setIsConnected] = useState<boolean | null>(null);
  const [profilePics, setProfilePics] = useState<Record<string, string>>({});
  const [isRecording, setIsRecording] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const selectedChatRef = useRef<Chat | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const { toast } = useToast();
  const { loading, error, fetchChats, fetchMessages, sendText, sendMedia, sendAudio, checkConnection, fetchProfilePicture } = useEvolutionApi();

  // Keep ref in sync
  useEffect(() => {
    selectedChatRef.current = selectedChat;
  }, [selectedChat]);

  // WebSocket for real-time messages
  const { wsConnected } = useEvolutionWebSocket({
    onMessage: useCallback((data: any) => {
      const currentChat = selectedChatRef.current;
      if (!data) return;
      const msgArray = Array.isArray(data) ? data : [data];
      msgArray.forEach((msg: any) => {
        if (!msg || typeof msg !== 'object') return;
        const remoteJid = safe(msg?.key?.remoteJid);
        if (!remoteJid) return;
        
        setChats(prev => {
          const updated = [...prev];
          const chatIndex = updated.findIndex(c => safe(c.remoteJid) === remoteJid);
          if (chatIndex >= 0) {
            updated[chatIndex] = {
              ...updated[chatIndex],
              lastMessageTimestamp: safeNum(msg.messageTimestamp) || Math.floor(Date.now() / 1000),
            };
          }
          return updated;
        });

        if (currentChat && remoteJid === safe(currentChat.remoteJid)) {
          setMessages(prev => {
            const msgId = safe(msg?.key?.id) || safe(msg?.id);
            const exists = prev.some((m: any) => {
              const mId = safe(m?.key?.id) || safe(m?.id);
              return mId && mId === msgId;
            });
            if (exists) return prev;
            return safeSortMessages([...prev, msg]);
          });
          setTimeout(() => messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 100);
        }
      });
    }, []),
    onConnectionUpdate: useCallback((connected: boolean) => {
      setIsConnected(connected);
    }, []),
  });

  // Check connection on mount
  useEffect(() => {
    checkConnection().then(state => {
      if (state?.instance?.state === 'open') setIsConnected(true);
    });
  }, [checkConnection]);

  // Load chats
  useEffect(() => {
    fetchChats().then(data => {
      if (!Array.isArray(data)) return;
      const sorted = [...data].sort((a: any, b: any) => (safeNum(b?.lastMessageTimestamp) - safeNum(a?.lastMessageTimestamp)));
      setChats(sorted);
    });
  }, [fetchChats]);

  // Fetch profile pictures for loaded chats
  useEffect(() => {
    if (chats.length === 0) return;
    chats.forEach((chat) => {
      const jid = safe(chat.remoteJid);
      if (!jid || profilePics[jid] !== undefined) return;
      // Mark as loading
      setProfilePics(prev => ({ ...prev, [jid]: '' }));
      const number = jid.replace('@s.whatsapp.net', '').replace('@g.us', '');
      fetchProfilePicture(number).then(url => {
        if (url) {
          setProfilePics(prev => ({ ...prev, [jid]: url }));
        }
      });
    });
  }, [chats, fetchProfilePicture]);

  // Load messages when chat selected
  useEffect(() => {
    if (selectedChat) {
      fetchMessages(safe(selectedChat.remoteJid)).then(msgs => {
        setMessages(safeSortMessages(msgs));
        setTimeout(() => messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 100);
      });
    }
  }, [selectedChat, fetchMessages]);

  const handleSendMessage = async () => {
    if (!messageText.trim() || !selectedChat) return;
    const number = safe(selectedChat.remoteJid).replace('@s.whatsapp.net', '').replace('@g.us', '');
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
      const number = safe(selectedChat.remoteJid).replace('@s.whatsapp.net', '').replace('@g.us', '');
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
          const number = safe(selectedChat.remoteJid).replace('@s.whatsapp.net', '').replace('@g.us', '');
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

      // Auto-stop after 60s
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

  const getMessageContent = (msg: any): string => {
    try {
      const m = msg?.message;
      if (!m || typeof m !== 'object') return safe(m);
      if (typeof m.conversation === 'string') return m.conversation;
      if (typeof m.extendedTextMessage?.text === 'string') return m.extendedTextMessage.text;
      if (m.imageMessage) return safe(m.imageMessage?.caption) || '📷 Imagem';
      if (m.videoMessage) return safe(m.videoMessage?.caption) || '🎥 Vídeo';
      if (m.audioMessage) return '🎵 Áudio';
      if (m.documentMessage) return safe(m.documentMessage?.fileName) || '📄 Documento';
      if (m.stickerMessage) return '🎃 Sticker';
      if (m.contactMessage) return '👤 Contato';
      if (m.locationMessage) return '📍 Localização';
      // Try to find any text in the message
      const keys = Object.keys(m);
      for (const k of keys) {
        if (m[k]?.text && typeof m[k].text === 'string') return m[k].text;
        if (m[k]?.caption && typeof m[k].caption === 'string') return m[k].caption;
      }
      return '💬 Mensagem';
    } catch {
      return '💬 Mensagem';
    }
  };

  const getLastMessagePreview = (chat: any): string => {
    const lm = chat?.lastMessage;
    if (!lm) return 'Sem mensagens';
    if (typeof lm === 'string') return lm;
    if (typeof lm === 'object') {
      // lastMessage might be a message object
      return getMessageContent({ message: lm });
    }
    return 'Sem mensagens';
  };

  const getContactName = (chat: any): string => {
    if (chat?.name && typeof chat.name === 'string') return chat.name;
    if (chat?.pushName && typeof chat.pushName === 'string') return chat.pushName;
    const jid = safe(chat?.remoteJid);
    return jid.replace('@s.whatsapp.net', '').replace('@g.us', '') || 'Desconhecido';
  };

  const getInitials = (name: string): string => {
    if (!name) return '??';
    return name.split(' ').filter(Boolean).map(w => w[0]).slice(0, 2).join('').toUpperCase() || '??';
  };

  const formatTime = (timestamp?: number): string => {
    if (!timestamp || timestamp <= 0) return '';
    try {
      const date = new Date(timestamp * 1000);
      return format(date, 'HH:mm', { locale: ptBR });
    } catch { return ''; }
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
    } catch { return ''; }
  };

  const getProfilePic = (jid: string): string => {
    return profilePics[jid] || '';
  };

  const filteredChats = Array.isArray(chats) ? chats.filter(chat => {
    if (!chat || typeof chat !== 'object') return false;
    const name = getContactName(chat).toLowerCase();
    return name.includes(searchQuery.toLowerCase());
  }) : [];

  // Chat list view
  if (!selectedChat) {
    return (
      <div className="flex flex-col h-full">
        {/* Header */}
        <div className="p-4 border-b border-border/50">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-lg font-bold text-foreground">WhatsApp</h2>
            <div className="flex items-center gap-2">
              {wsConnected && (
                <span className="flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full bg-blue-100 text-blue-700">
                  <Zap size={10} /> Tempo real
                </span>
              )}
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
              {filteredChats.map((chat, idx) => {
                if (!chat || typeof chat !== 'object') return null;
                const jid = safe(chat.remoteJid);
                const name = getContactName(chat);
                const isGroup = jid.includes('@g.us');
                const pic = getProfilePic(jid);
                const ts = safeNum(chat.lastMessageTimestamp);

                return (
                  <button
                    key={jid || String(idx)}
                    onClick={() => setSelectedChat(chat)}
                    className="w-full flex items-center gap-3 px-4 py-3 hover:bg-secondary/50 transition-colors text-left"
                  >
                    <Avatar className="h-12 w-12 shrink-0">
                      {pic ? <AvatarImage src={pic} alt={name} /> : null}
                      <AvatarFallback className={`text-sm font-medium ${isGroup ? 'bg-accent text-accent-foreground' : 'bg-primary/10 text-primary'}`}>
                        {getInitials(name)}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between">
                        <span className="font-medium text-sm truncate">{name}</span>
                        <span className="text-[10px] text-muted-foreground shrink-0">
                          {ts > 0 ? formatTime(ts) : ''}
                        </span>
                      </div>
                      <p className="text-xs text-muted-foreground truncate mt-0.5">
                        {getLastMessagePreview(chat)}
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
            {safe(error)}
          </div>
        )}
      </div>
    );
  }

  const selectedJid = safe(selectedChat.remoteJid);
  const selectedPic = getProfilePic(selectedJid);
  const selectedName = getContactName(selectedChat);

  // Message view
  return (
    <div className="flex flex-col h-full">
      {/* Chat header */}
      <div className="flex items-center gap-3 px-3 py-2 border-b border-border/50 bg-card">
        <button onClick={() => { setSelectedChat(null); setMessages([]); }} className="p-1.5 hover:bg-secondary rounded-lg transition-colors">
          <ArrowLeft size={20} />
        </button>
        <Avatar className="h-10 w-10">
          {selectedPic ? <AvatarImage src={selectedPic} alt={selectedName} /> : null}
          <AvatarFallback className="text-xs font-medium bg-primary/10 text-primary">
            {getInitials(selectedName)}
          </AvatarFallback>
        </Avatar>
        <div className="flex-1 min-w-0">
          <h3 className="font-medium text-sm truncate">{selectedName}</h3>
          <p className="text-[10px] text-muted-foreground">
            {selectedJid.includes('@g.us') ? 'Grupo' : 'Online'}
          </p>
        </div>
      </div>

      {/* Messages */}
      <ScrollArea className="flex-1 bg-secondary/20">
        <div className="p-3 space-y-1">
          {messages.length === 0 && !loading && (
            <div className="text-center py-12 text-muted-foreground text-sm">
              Nenhuma mensagem ainda
            </div>
          )}
          {(() => {
            let lastDate = '';
            return (Array.isArray(messages) ? messages : []).map((msg: any, i: number) => {
              if (!msg || typeof msg !== 'object') return null;
              
              const content = getMessageContent(msg);
              const msgKey = (msg.key && typeof msg.key === 'object') ? msg.key : {};
              const fromMe = msgKey.fromMe === true;
              const timestamp = safeNum(msg.messageTimestamp);
              const time = formatTime(timestamp || undefined);
              const dateStr = formatDate(timestamp || undefined);
              const showDate = dateStr !== '' && dateStr !== lastDate;
              if (showDate) lastDate = dateStr;
              const keyId = safe(msgKey.id) || safe(msg.id) || String(i);
              const pushName = safe(msg.pushName);

              const m = (msg.message && typeof msg.message === 'object') ? msg.message : null;
              const hasImage = !!m?.imageMessage;
              const hasVideo = !!m?.videoMessage;
              const hasAudio = !!m?.audioMessage;
              const hasDoc = !!m?.documentMessage;
              const docName = safe(m?.documentMessage?.fileName) || 'Documento';
              const imgCaption = safe(m?.imageMessage?.caption);
              const vidCaption = safe(m?.videoMessage?.caption);

              return (
                <React.Fragment key={keyId}>
                  {showDate && (
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
                      
                      {hasImage && (
                        <div className="mb-1 rounded-lg overflow-hidden bg-secondary/30">
                          <div className="flex items-center gap-2 p-3 text-xs text-muted-foreground">
                            <Image size={16} /> {'📷 Imagem'}
                          </div>
                          {imgCaption && <p className="text-sm px-3 pb-2">{imgCaption}</p>}
                        </div>
                      )}
                      {hasVideo && (
                        <div className="mb-1 rounded-lg overflow-hidden bg-secondary/30">
                          <div className="flex items-center gap-2 p-3 text-xs text-muted-foreground">
                            <Video size={16} /> {'🎥 Vídeo'}
                          </div>
                          {vidCaption && <p className="text-sm px-3 pb-2">{vidCaption}</p>}
                        </div>
                      )}
                      {hasAudio && (
                        <div className="mb-1 rounded-lg overflow-hidden bg-secondary/30">
                          <div className="flex items-center gap-2 p-3 text-xs text-muted-foreground">
                            <Mic size={16} /> {'🎵 Áudio'}
                          </div>
                        </div>
                      )}
                      {hasDoc && (
                        <div className="mb-1 rounded-lg overflow-hidden bg-secondary/30">
                          <div className="flex items-center gap-2 p-3 text-xs text-muted-foreground">
                            <File size={16} /> {docName}
                          </div>
                        </div>
                      )}

                      {!hasImage && !hasVideo && !hasAudio && !hasDoc && content && (
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
            <Image size={14} /> {'Foto'}
          </Button>
          <Button size="sm" variant="outline" className="gap-1.5 text-xs" onClick={() => { fileInputRef.current?.setAttribute('accept', 'video/*'); fileInputRef.current?.click(); }}>
            <Video size={14} /> {'Vídeo'}
          </Button>
          <Button size="sm" variant="outline" className="gap-1.5 text-xs" onClick={() => { fileInputRef.current?.setAttribute('accept', '*/*'); fileInputRef.current?.click(); }}>
            <File size={14} /> {'Arquivo'}
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
            onClick={handleAudioToggle}
            className={`p-2 rounded-full transition-colors ${
              isRecording 
                ? 'bg-destructive text-destructive-foreground animate-pulse' 
                : 'hover:bg-secondary text-muted-foreground'
            }`}
          >
            {isRecording ? <Square size={18} /> : <Mic size={18} />}
          </button>
        )}
      </div>
    </div>
  );
};

export default WhatsAppTab;
