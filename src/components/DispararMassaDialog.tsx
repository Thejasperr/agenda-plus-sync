import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Search, Image as ImageIcon, Video, X, Rocket, Loader2, CheckSquare, Square, Upload } from 'lucide-react';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';

interface Cliente {
  id: string;
  nome: string;
  telefone: string;
}

interface Props {
  disparoId: string | null;
  open: boolean;
  onClose: () => void;
  onDisparoIniciado: () => void;
}

export const DispararMassaDialog: React.FC<Props> = ({ disparoId, open, onClose, onDisparoIniciado }) => {
  const { toast } = useToast();
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [selecionados, setSelecionados] = useState<Set<string>>(new Set());
  const [busca, setBusca] = useState('');
  const [carregando, setCarregando] = useState(false);
  const [enviando, setEnviando] = useState(false);

  // Mídia
  const [mediaFile, setMediaFile] = useState<File | null>(null);
  const [mediaPreview, setMediaPreview] = useState<string | null>(null);
  const [uploadando, setUploadando] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open) return;
    setBusca('');
    setSelecionados(new Set());
    setMediaFile(null);
    setMediaPreview(null);
    carregarClientes();
  }, [open]);

  const carregarClientes = async () => {
    setCarregando(true);
    const { data, error } = await supabase
      .from('clientes')
      .select('id, nome, telefone')
      .order('nome');
    if (!error && data) setClientes(data);
    setCarregando(false);
  };

  const filtrados = useMemo(() => {
    const q = busca.trim().toLowerCase();
    if (!q) return clientes;
    return clientes.filter(
      (c) =>
        c.nome.toLowerCase().includes(q) ||
        (c.telefone || '').toLowerCase().includes(q),
    );
  }, [clientes, busca]);

  const todosSelecionados = filtrados.length > 0 && filtrados.every((c) => selecionados.has(c.id));

  const toggleTodos = () => {
    const next = new Set(selecionados);
    if (todosSelecionados) {
      filtrados.forEach((c) => next.delete(c.id));
    } else {
      filtrados.forEach((c) => next.add(c.id));
    }
    setSelecionados(next);
  };

  const toggle = (id: string) => {
    const next = new Set(selecionados);
    if (next.has(id)) next.delete(id); else next.add(id);
    setSelecionados(next);
  };

  const escolherArquivo = () => fileInputRef.current?.click();

  const onArquivoSelecionado = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    const ehImg = f.type.startsWith('image/');
    const ehVideo = f.type.startsWith('video/');
    if (!ehImg && !ehVideo) {
      toast({ title: 'Formato não suportado', description: 'Selecione uma imagem ou vídeo.', variant: 'destructive' });
      return;
    }
    if (f.size > 16 * 1024 * 1024) {
      toast({ title: 'Arquivo muito grande', description: 'Máximo 16 MB.', variant: 'destructive' });
      return;
    }
    setMediaFile(f);
    const reader = new FileReader();
    reader.onload = () => setMediaPreview(reader.result as string);
    reader.readAsDataURL(f);
  };

  const removerMidia = () => {
    setMediaFile(null);
    setMediaPreview(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const fazerUploadMidia = async (userId: string): Promise<{
    url: string; type: 'image' | 'video'; mime: string; filename: string;
  } | null> => {
    if (!mediaFile) return null;
    setUploadando(true);
    try {
      const ext = mediaFile.name.split('.').pop() || 'bin';
      const path = `${userId}/${disparoId}-${Date.now()}.${ext}`;
      const { error } = await supabase.storage
        .from('disparos-massa-media')
        .upload(path, mediaFile, { upsert: true, contentType: mediaFile.type });
      if (error) throw error;
      const { data } = supabase.storage.from('disparos-massa-media').getPublicUrl(path);
      return {
        url: data.publicUrl,
        type: mediaFile.type.startsWith('video/') ? 'video' : 'image',
        mime: mediaFile.type,
        filename: mediaFile.name,
      };
    } finally {
      setUploadando(false);
    }
  };

  const disparar = async () => {
    if (!disparoId) return;
    if (selecionados.size === 0) {
      toast({ title: 'Selecione clientes', description: 'Marque ao menos um cliente.', variant: 'destructive' });
      return;
    }
    setEnviando(true);
    try {
      const { data: userData } = await supabase.auth.getUser();
      const userId = userData.user?.id;
      if (!userId) throw new Error('Não autenticado');

      // Upload de mídia (se houver)
      const midia = await fazerUploadMidia(userId);

      // Atualiza disparo com a mídia
      await supabase
        .from('disparos_massa')
        .update({
          media_url: midia?.url || null,
          media_type: midia?.type || null,
          media_mime: midia?.mime || null,
          media_filename: midia?.filename || null,
        })
        .eq('id', disparoId);

      // Chama edge function (delay vem das configurações globais do usuário)
      const { data, error } = await supabase.functions.invoke('disparo-massa-enviar-direto', {
        body: {
          disparo_id: disparoId,
          cliente_ids: Array.from(selecionados),
          modo: 'novo',
        },
      });
      if (error) throw error;

      toast({
        title: 'Disparo iniciado!',
        description: `Enviando para ${data?.total || selecionados.size} clientes em background.`,
      });
      onDisparoIniciado();
      onClose();
    } catch (e: any) {
      toast({ title: 'Erro', description: e.message || 'Falha ao iniciar disparo', variant: 'destructive' });
    } finally {
      setEnviando(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && !enviando && onClose()}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Rocket className="h-5 w-5" /> Disparar mensagens
          </DialogTitle>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto space-y-4 pr-1">
          {/* Mídia */}
          <div className="space-y-2">
            <label className="text-sm font-medium">Foto ou vídeo (opcional)</label>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*,video/*"
              className="hidden"
              onChange={onArquivoSelecionado}
            />
            {!mediaFile ? (
              <Button variant="outline" onClick={escolherArquivo} className="w-full" type="button">
                <Upload className="h-4 w-4 mr-2" /> Anexar mídia
              </Button>
            ) : (
              <div className="border rounded-xl p-3 flex items-center gap-3 bg-muted/30">
                {mediaFile.type.startsWith('image/') ? (
                  <img src={mediaPreview!} alt="preview" className="h-16 w-16 object-cover rounded-lg" />
                ) : (
                  <div className="h-16 w-16 rounded-lg bg-muted flex items-center justify-center">
                    <Video className="h-6 w-6 text-muted-foreground" />
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{mediaFile.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {(mediaFile.size / 1024 / 1024).toFixed(2)} MB
                  </p>
                </div>
                <Button size="icon" variant="ghost" onClick={removerMidia}>
                  <X className="h-4 w-4" />
                </Button>
              </div>
            )}
            <p className="text-xs text-muted-foreground">
              A mídia vai junto com a mensagem como legenda.
            </p>
          </div>

          {/* Busca + selecionar todos */}
          <div className="space-y-2 sticky top-0 bg-background pb-2 z-10">
            <div className="flex items-center gap-2">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Buscar por nome ou telefone..."
                  value={busca}
                  onChange={(e) => setBusca(e.target.value)}
                  className="pl-9"
                />
              </div>
              <Button variant="outline" size="sm" onClick={toggleTodos} type="button">
                {todosSelecionados ? <CheckSquare className="h-4 w-4 mr-1" /> : <Square className="h-4 w-4 mr-1" />}
                {todosSelecionados ? 'Limpar' : 'Todos'}
              </Button>
            </div>
            <div className="flex items-center justify-between">
              <p className="text-xs text-muted-foreground">
                {filtrados.length} cliente{filtrados.length !== 1 ? 's' : ''}
              </p>
              <Badge variant="secondary">{selecionados.size} selecionado{selecionados.size !== 1 ? 's' : ''}</Badge>
            </div>
          </div>

          {/* Lista */}
          <div className="space-y-1">
            {carregando && (
              <p className="text-sm text-muted-foreground text-center py-6">Carregando...</p>
            )}
            {!carregando && filtrados.length === 0 && (
              <p className="text-sm text-muted-foreground text-center py-6">
                Nenhum cliente encontrado.
              </p>
            )}
            {filtrados.map((c) => {
              const checked = selecionados.has(c.id);
              return (
                <div
                  key={c.id}
                  onClick={() => toggle(c.id)}
                  className={`flex items-center gap-3 p-3 rounded-xl border cursor-pointer transition-colors ${
                    checked ? 'bg-primary/10 border-primary/40' : 'bg-card hover:bg-muted/40'
                  }`}
                >
                  <Checkbox checked={checked} onCheckedChange={() => toggle(c.id)} />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{c.nome}</p>
                    <p className="text-xs text-muted-foreground">{c.telefone}</p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <DialogFooter className="border-t pt-3">
          <Button variant="outline" onClick={onClose} disabled={enviando}>
            Cancelar
          </Button>
          <Button onClick={disparar} disabled={enviando || uploadando || selecionados.size === 0}>
            {enviando || uploadando ? (
              <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> {uploadando ? 'Enviando mídia...' : 'Iniciando...'}</>
            ) : (
              <><Rocket className="h-4 w-4 mr-2" /> Disparar para {selecionados.size}</>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
