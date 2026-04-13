import React, { useState, useCallback } from 'react';
import { Image, Video, Mic, Play, Loader2, Download } from 'lucide-react';

interface MediaMessageProps {
  type: 'image' | 'video' | 'audio';
  thumbnailBase64?: string;
  caption?: string;
  seconds?: number;
  ptt?: boolean;
  messageId: string;
  remoteJid: string;
  fromMe: boolean;
  mimetype?: string;
  onLoadMedia: (messageId: string, remoteJid: string, fromMe: boolean, convertToMp4: boolean) => Promise<{ base64: string; mimetype: string } | null>;
}

const MediaMessage: React.FC<MediaMessageProps> = ({
  type, thumbnailBase64, caption, seconds, ptt,
  messageId, remoteJid, fromMe, mimetype,
  onLoadMedia,
}) => {
  const [mediaDataUrl, setMediaDataUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);

  const thumbSrc = thumbnailBase64
    ? (thumbnailBase64.startsWith('data:') ? thumbnailBase64 : `data:image/jpeg;base64,${thumbnailBase64}`)
    : '';

  const loadMedia = useCallback(async () => {
    if (mediaDataUrl || loading) return;
    setLoading(true);
    setError(false);
    try {
      const convertToMp4 = type === 'video';
      const result = await onLoadMedia(messageId, remoteJid, fromMe, convertToMp4);
      if (result?.base64) {
        const mt = result.mimetype || (type === 'image' ? 'image/jpeg' : type === 'video' ? 'video/mp4' : 'audio/ogg');
        setMediaDataUrl(`data:${mt};base64,${result.base64}`);
      } else {
        setError(true);
      }
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  }, [mediaDataUrl, loading, messageId, remoteJid, fromMe, type, onLoadMedia]);

  if (type === 'image') {
    return (
      <div className="mb-1 rounded-lg overflow-hidden bg-secondary/30">
        {mediaDataUrl ? (
          <img
            src={mediaDataUrl}
            alt="Imagem"
            className="max-w-full max-h-60 rounded-lg object-cover cursor-pointer"
            onClick={() => window.open(mediaDataUrl, '_blank')}
          />
        ) : (
          <div className="relative cursor-pointer" onClick={loadMedia}>
            {thumbSrc ? (
              <img src={thumbSrc} alt="Imagem" className="max-w-full max-h-60 rounded-lg object-cover filter blur-[1px]" />
            ) : (
              <div className="w-48 h-32 flex items-center justify-center bg-secondary/50 rounded-lg">
                <Image size={24} className="text-muted-foreground" />
              </div>
            )}
            <div className="absolute inset-0 flex items-center justify-center">
              {loading ? (
                <Loader2 size={28} className="text-white animate-spin drop-shadow-lg" />
              ) : error ? (
                <span className="text-xs text-white bg-destructive/80 px-2 py-1 rounded">Erro ao carregar</span>
              ) : (
                <div className="bg-black/40 rounded-full p-2">
                  <Download size={20} className="text-white" />
                </div>
              )}
            </div>
          </div>
        )}
        {caption && <p className="text-sm px-2 py-1">{caption}</p>}
      </div>
    );
  }

  if (type === 'video') {
    return (
      <div className="mb-1 rounded-lg overflow-hidden bg-secondary/30">
        {mediaDataUrl ? (
          <video src={mediaDataUrl} controls className="max-w-full max-h-60 rounded-lg" />
        ) : (
          <div className="relative cursor-pointer" onClick={loadMedia}>
            {thumbSrc ? (
              <img src={thumbSrc} alt="Vídeo" className="max-w-full max-h-60 rounded-lg object-cover" />
            ) : (
              <div className="w-48 h-32 flex items-center justify-center bg-secondary/50 rounded-lg">
                <Video size={24} className="text-muted-foreground" />
              </div>
            )}
            <div className="absolute inset-0 flex items-center justify-center">
              {loading ? (
                <Loader2 size={28} className="text-white animate-spin drop-shadow-lg" />
              ) : error ? (
                <span className="text-xs text-white bg-destructive/80 px-2 py-1 rounded">Erro ao carregar</span>
              ) : (
                <div className="bg-black/50 rounded-full p-3">
                  <Play size={24} className="text-white" />
                </div>
              )}
            </div>
          </div>
        )}
        {caption && <p className="text-sm px-2 py-1">{caption}</p>}
      </div>
    );
  }

  // Audio
  return (
    <div className="mb-1 rounded-lg overflow-hidden bg-secondary/30">
      {mediaDataUrl ? (
        <audio src={mediaDataUrl} controls className="w-full max-w-[250px]" preload="auto" />
      ) : (
        <button
          onClick={loadMedia}
          disabled={loading}
          className="flex items-center gap-2 p-3 w-full hover:bg-secondary/50 transition-colors"
        >
          {loading ? (
            <Loader2 size={16} className="text-primary animate-spin shrink-0" />
          ) : (
            <Play size={16} className="text-primary shrink-0" />
          )}
          <div className="flex-1">
            <div className="h-1.5 bg-primary/30 rounded-full w-full max-w-[180px]">
              <div className="h-full bg-primary rounded-full" style={{ width: '100%' }} />
            </div>
          </div>
          <span className="text-[10px] text-muted-foreground shrink-0">
            {error ? 'Erro' : seconds && seconds > 0 ? `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}` : ptt ? 'PTT' : 'Áudio'}
          </span>
        </button>
      )}
    </div>
  );
};

export default MediaMessage;
