import React, { useState, useRef, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Loader2, Sparkles, Image as ImageIcon, Video, X, Send, RefreshCw, AlertCircle } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';

interface MidiaUpload {
  id: string;
  file: File;
  preview: string;
  type: 'image' | 'video';
  uploaded_url?: string;
  mime: string;
}

interface Props {
  open: boolean;
  onClose: () => void;
  grupoNome: string;
  grupoRemoteJid: string;
}

const GerarMensagemGrupoDialog: React.FC<Props> = ({ open, onClose, grupoNome, grupoRemoteJid }) => {
  const { user } = useAuth();
  const { toast } = useToast();

  const [mensagemOriginal, setMensagemOriginal] = useState('');
  const [mensagemReestruturada, setMensagemReestruturada] = useState('');
  const [mensagemId, setMensagemId] = useState<string | null>(null);
  const [gerando, setGerando] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [midias, setMidias] = useState<MidiaUpload[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Reset ao abrir
  useEffect(() => {
    if (open) {
      setMensagemOriginal('');
      setMensagemReestruturada('');
      setMensagemId(null);
      setMidias([]);
    }
  }, [open]);

  const handleGerar = async () => {
    if (!mensagemOriginal.trim() || mensagemOriginal.trim().length < 3) {
      toast({ title: 'Mensagem muito curta', variant: 'destructive' });
      return;
    }

    setGerando(true);
    try {
      const { data, error } = await supabase.functions.invoke('grupo-mensagem-gerar', {
        body: {
          mensagem_original: mensagemOriginal.trim(),
          grupo_remote_jid: grupoRemoteJid,
          grupo_nome: grupoNome,
        },
      });

      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      setMensagemReestruturada(data.mensagem_reestruturada || '');
      setMensagemId(data.mensagem_id);
      toast({ title: 'Mensagem gerada!', description: 'Revise antes de enviar.' });
    } catch (err: any) {
      console.error(err);
      toast({
        title: 'Erro ao gerar',
        description: err?.message || 'Verifique a configuração do webhook n8n em Config.',
        variant: 'destructive',
      });
    } finally {
      setGerando(false);
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    e.target.value = '';
    if (!files.length) return;

    files.forEach((file) => {
      const isImage = file.type.startsWith('image/');
      const isVideo = file.type.startsWith('video/');
      if (!isImage && !isVideo) {
        toast({ title: 'Apenas imagens e vídeos', variant: 'destructive' });
        return;
      }
      if (file.size > 50 * 1024 * 1024) {
        toast({ title: 'Arquivo muito grande (máx 50MB)', variant: 'destructive' });
        return;
      }
      const preview = URL.createObjectURL(file);
      setMidias((prev) => [
        ...prev,
        {
          id: crypto.randomUUID(),
          file,
          preview,
          type: isImage ? 'image' : 'video',
          mime: file.type,
        },
      ]);
    });
  };

  const removerMidia = (id: string) => {
    setMidias((prev) => {
      const m = prev.find((x) => x.id === id);
      if (m) URL.revokeObjectURL(m.preview);
      return prev.filter((x) => x.id !== id);
    });
  };

  const uploadMidias = async (): Promise<Array<{ url: string; type: string; mime: string; filename: string; ordem: number }>> => {
    if (!user) return [];
    const results: Array<{ url: string; type: string; mime: string; filename: string; ordem: number }> = [];
    for (let i = 0; i < midias.length; i++) {
      const m = midias[i];
      const ext = m.file.name.split('.').pop() || (m.mime.split('/')[1] || 'bin');
      const path = `${user.id}/grupos/${crypto.randomUUID()}.${ext}`;
      const { error: upErr } = await supabase.storage
        .from('disparos-massa-media')
        .upload(path, m.file, { contentType: m.mime, upsert: true });
      if (upErr) throw upErr;
      const { data: pub } = supabase.storage.from('disparos-massa-media').getPublicUrl(path);
      results.push({
        url: pub.publicUrl,
        type: m.type,
        mime: m.mime,
        filename: m.file.name,
        ordem: i + 1,
      });
    }
    return results;
  };

  const handleEnviar = async () => {
    if (!mensagemId || !mensagemReestruturada.trim()) {
      toast({ title: 'Gere a mensagem primeiro', variant: 'destructive' });
      return;
    }
    if (!user) return;

    setEnviando(true);
    try {
      // Atualiza o texto reestruturado caso o usuário tenha editado
      await supabase
        .from('grupos_mensagens')
        .update({ mensagem_reestruturada: mensagemReestruturada.trim() })
        .eq('id', mensagemId);

      // Faz upload das mídias e registra
      if (midias.length > 0) {
        const uploaded = await uploadMidias();
        const rows = uploaded.map((u) => ({
          user_id: user.id,
          mensagem_id: mensagemId,
          media_type: u.type,
          media_mime: u.mime,
          media_url: u.url,
          media_filename: u.filename,
          ordem: u.ordem,
        }));
        const { error: insErr } = await supabase.from('grupos_mensagens_midias').insert(rows);
        if (insErr) throw insErr;
      }

      // Dispara o envio
      const { data, error } = await supabase.functions.invoke('grupo-mensagem-enviar', {
        body: {
          mensagem_id: mensagemId,
          remote_jid: grupoRemoteJid,
        },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      toast({ title: 'Enviado!', description: `Mensagem postada em ${grupoNome}` });
      onClose();
    } catch (err: any) {
      console.error(err);
      toast({
        title: 'Erro ao enviar',
        description: err?.message || 'Tente novamente',
        variant: 'destructive',
      });
    } finally {
      setEnviando(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary" />
            Gerar mensagem para o grupo
          </DialogTitle>
          <p className="text-xs text-muted-foreground mt-1 truncate">📍 {grupoNome}</p>
        </DialogHeader>

        <div className="space-y-4">
          {/* Mensagem original */}
          <div className="space-y-1.5">
            <Label htmlFor="msg-original">
              Sua ideia <span className="text-muted-foreground font-normal">(escreva como falaria)</span>
            </Label>
            <Textarea
              id="msg-original"
              value={mensagemOriginal}
              onChange={(e) => setMensagemOriginal(e.target.value)}
              placeholder="Ex: Oii bom dia meninas, alguns horários para o fim de semana"
              className="min-h-[80px]"
              disabled={gerando}
            />
            <Button
              onClick={handleGerar}
              disabled={gerando || !mensagemOriginal.trim()}
              className="w-full"
              variant={mensagemReestruturada ? 'outline' : 'default'}
            >
              {gerando ? (
                <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Gerando...</>
              ) : mensagemReestruturada ? (
                <><RefreshCw className="h-4 w-4 mr-2" /> Gerar novamente</>
              ) : (
                <><Sparkles className="h-4 w-4 mr-2" /> Gerar mensagem com IA</>
              )}
            </Button>
          </div>

          {/* Mensagem reestruturada (editável) */}
          {mensagemReestruturada && (
            <>
              <div className="space-y-1.5">
                <Label htmlFor="msg-reestruturada" className="flex items-center gap-1.5">
                  <Sparkles className="h-3.5 w-3.5 text-primary" />
                  Mensagem reestruturada <span className="text-muted-foreground font-normal text-xs">(edite se quiser)</span>
                </Label>
                <Textarea
                  id="msg-reestruturada"
                  value={mensagemReestruturada}
                  onChange={(e) => setMensagemReestruturada(e.target.value)}
                  className="min-h-[140px]"
                />
              </div>

              {/* Mídias */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label>Fotos e vídeos <span className="text-muted-foreground font-normal text-xs">(opcional)</span></Label>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() => fileInputRef.current?.click()}
                    className="h-8"
                  >
                    <ImageIcon className="h-3.5 w-3.5 mr-1.5" />
                    Adicionar
                  </Button>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*,video/*"
                    multiple
                    className="hidden"
                    onChange={handleFileSelect}
                  />
                </div>
                {midias.length > 0 && (
                  <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
                    {midias.map((m) => (
                      <div key={m.id} className="relative aspect-square rounded-lg overflow-hidden border border-border bg-muted/40 group">
                        {m.type === 'image' ? (
                          <img src={m.preview} alt="" className="w-full h-full object-cover" />
                        ) : (
                          <video src={m.preview} className="w-full h-full object-cover" />
                        )}
                        <div className="absolute top-1 left-1">
                          {m.type === 'video' && (
                            <span className="bg-background/90 backdrop-blur rounded-full p-1">
                              <Video className="h-3 w-3" />
                            </span>
                          )}
                        </div>
                        <button
                          type="button"
                          onClick={() => removerMidia(m.id)}
                          className="absolute top-1 right-1 bg-destructive text-destructive-foreground rounded-full p-1 opacity-0 group-hover:opacity-100 transition-opacity"
                        >
                          <X className="h-3 w-3" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
                {midias.length === 0 && (
                  <p className="text-xs text-muted-foreground flex items-center gap-1">
                    <AlertCircle className="h-3 w-3" />
                    A primeira mídia será enviada com o texto como legenda.
                  </p>
                )}
              </div>
            </>
          )}
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={onClose} disabled={enviando}>
            Cancelar
          </Button>
          <Button
            onClick={handleEnviar}
            disabled={!mensagemReestruturada || enviando || gerando}
            className="gap-2"
          >
            {enviando ? (
              <><Loader2 className="h-4 w-4 animate-spin" /> Enviando...</>
            ) : (
              <><Send className="h-4 w-4" /> Enviar para o grupo</>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default GerarMensagemGrupoDialog;
