import React, { useEffect, useState } from 'react';
import { Send, Loader2, Trash2, Copy, Check, Pencil, Save, X, Sparkles, Link2, Rocket, Image as ImageIcon, Video } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { DispararMassaDialog } from '@/components/DispararMassaDialog';

interface Disparo {
  id: string;
  mensagem_sugestao: string;
  status: string;
  observacoes: string | null;
  created_at: string;
  media_url?: string | null;
  media_type?: string | null;
  total_destinatarios?: number;
  total_enviados?: number;
  total_falhas?: number;
}

interface Variacao {
  id: string;
  disparo_id: string;
  estilo: string | null;
  mensagem: string;
  ordem: number;
}

const DisparosMassaTab = () => {
  const { toast } = useToast();
  const [mensagem, setMensagem] = useState('');
  const [observacoes, setObservacoes] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [disparos, setDisparos] = useState<Disparo[]>([]);
  const [variacoes, setVariacoes] = useState<Record<string, Variacao[]>>({});
  const [expandido, setExpandido] = useState<string | null>(null);
  const [copiadoId, setCopiadoId] = useState<string | null>(null);
  const [editandoId, setEditandoId] = useState<string | null>(null);
  const [editTexto, setEditTexto] = useState('');
  const [editEstilo, setEditEstilo] = useState('');
  const [webhookUrl, setWebhookUrl] = useState('');
  const [webhookSalvo, setWebhookSalvo] = useState('');
  const [webhookEnvio, setWebhookEnvio] = useState('');
  const [webhookEnvioSalvo, setWebhookEnvioSalvo] = useState('');
  const [salvandoWebhook, setSalvandoWebhook] = useState(false);
  const [disparandoId, setDisparandoId] = useState<string | null>(null);
  const [dialogDisparoId, setDialogDisparoId] = useState<string | null>(null);
  const fetchConfig = async () => {
    const { data } = await supabase
      .from('disparos_massa_config')
      .select('webhook_url, webhook_envio_url')
      .maybeSingle();
    if (data) {
      setWebhookUrl(data.webhook_url || '');
      setWebhookSalvo(data.webhook_url || '');
      setWebhookEnvio(data.webhook_envio_url || '');
      setWebhookEnvioSalvo(data.webhook_envio_url || '');
    }
  };

  const salvarWebhook = async () => {
    const url = webhookUrl.trim();
    const urlEnvio = webhookEnvio.trim();
    if (url && !/^https?:\/\//i.test(url)) {
      toast({ title: 'URL de geração inválida', description: 'Deve começar com http:// ou https://', variant: 'destructive' });
      return;
    }
    if (urlEnvio && !/^https?:\/\//i.test(urlEnvio)) {
      toast({ title: 'URL de envio inválida', description: 'Deve começar com http:// ou https://', variant: 'destructive' });
      return;
    }
    setSalvandoWebhook(true);
    try {
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) throw new Error('Não autenticado');

      const { error } = await supabase
        .from('disparos_massa_config')
        .upsert(
          { user_id: userData.user.id, webhook_url: url, webhook_envio_url: urlEnvio || null },
          { onConflict: 'user_id' },
        );
      if (error) throw error;
      setWebhookSalvo(url);
      setWebhookEnvioSalvo(urlEnvio);
      toast({ title: 'Configurações salvas' });
    } catch (e: any) {
      toast({ title: 'Erro', description: e.message, variant: 'destructive' });
    } finally {
      setSalvandoWebhook(false);
    }
  };

  const fetchDisparos = async () => {
    const { data, error } = await supabase
      .from('disparos_massa')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(20);
    if (!error && data) setDisparos(data);
  };

  const fetchVariacoes = async (disparoId: string) => {
    const { data, error } = await supabase
      .from('disparos_massa_variacoes')
      .select('*')
      .eq('disparo_id', disparoId)
      .order('ordem');
    if (!error && data) {
      setVariacoes((prev) => ({ ...prev, [disparoId]: data }));
    }
  };

  useEffect(() => {
    fetchDisparos();
    fetchConfig();

    const channel = supabase
      .channel('disparos-massa-realtime')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'disparos_massa_variacoes' },
        (payload: any) => {
          const disparoId = payload.new?.disparo_id || payload.old?.disparo_id;
          if (disparoId) fetchVariacoes(disparoId);
        },
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'disparos_massa' },
        () => fetchDisparos(),
      )
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'disparos_massa_envios' },
        () => fetchDisparos(),
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, []);

  // Polling de segurança: enquanto houver disparo "enviando", refaz fetch a cada 2s
  useEffect(() => {
    const temEnviando = disparos.some((d) => d.status === 'enviando');
    if (!temEnviando) return;
    const interval = setInterval(() => {
      fetchDisparos();
    }, 2000);
    return () => clearInterval(interval);
  }, [disparos]);

  const handleEnviar = async () => {
    if (mensagem.trim().length < 3) {
      toast({ title: 'Atenção', description: 'Escreva uma sugestão de mensagem.', variant: 'destructive' });
      return;
    }
    setEnviando(true);
    try {
      const { data, error } = await supabase.functions.invoke('disparo-massa-gerar', {
        body: { mensagem_sugestao: mensagem, observacoes: observacoes || null },
      });
      if (error) throw error;

      toast({
        title: 'Solicitação enviada',
        description: data?.variacoes_geradas
          ? `${data.variacoes_geradas} variações geradas!`
          : 'Aguardando o webhook gerar as variações...',
      });
      setMensagem('');
      setObservacoes('');
      fetchDisparos();
    } catch (e: any) {
      toast({ title: 'Erro', description: e.message || 'Falha ao enviar', variant: 'destructive' });
    } finally {
      setEnviando(false);
    }
  };

  const abrirDispararDialog = (disparoId: string) => {
    setDialogDisparoId(disparoId);
  };

  const toggleExpandir = (id: string) => {
    if (expandido === id) {
      setExpandido(null);
    } else {
      setExpandido(id);
      if (!variacoes[id]) fetchVariacoes(id);
    }
  };

  const excluirDisparo = async (id: string) => {
    if (!confirm('Excluir este disparo e todas as variações?')) return;
    const { error } = await supabase.from('disparos_massa').delete().eq('id', id);
    if (error) {
      toast({ title: 'Erro', description: error.message, variant: 'destructive' });
    } else {
      toast({ title: 'Excluído' });
      fetchDisparos();
    }
  };

  const copiar = async (texto: string, id: string) => {
    await navigator.clipboard.writeText(texto);
    setCopiadoId(id);
    setTimeout(() => setCopiadoId(null), 1500);
  };

  const iniciarEdicao = (v: Variacao) => {
    setEditandoId(v.id);
    setEditTexto(v.mensagem);
    setEditEstilo(v.estilo || '');
  };

  const salvarEdicao = async (v: Variacao) => {
    const { error } = await supabase
      .from('disparos_massa_variacoes')
      .update({ mensagem: editTexto, estilo: editEstilo || null })
      .eq('id', v.id);
    if (error) {
      toast({ title: 'Erro', description: error.message, variant: 'destructive' });
    } else {
      toast({ title: 'Salvo' });
      setEditandoId(null);
      fetchVariacoes(v.disparo_id);
    }
  };

  const excluirVariacao = async (v: Variacao) => {
    if (!confirm('Excluir esta variação?')) return;
    const { error } = await supabase.from('disparos_massa_variacoes').delete().eq('id', v.id);
    if (!error) fetchVariacoes(v.disparo_id);
  };

  const statusBadge = (status: string) => {
    const map: Record<string, { label: string; cls: string }> = {
      pendente: { label: 'Pendente', cls: 'bg-muted text-muted-foreground' },
      gerando: { label: 'Gerando...', cls: 'bg-primary/15 text-primary' },
      aguardando_webhook: { label: 'Aguardando Webhook', cls: 'bg-accent text-accent-foreground' },
      concluido: { label: 'Concluído', cls: 'bg-primary/15 text-primary' },
      enviando: { label: 'Enviando...', cls: 'bg-primary/15 text-primary' },
      enviado: { label: 'Enviado', cls: 'bg-emerald-100 text-emerald-700' },
    };
    const m = map[status] || { label: status, cls: 'bg-muted' };
    return <Badge className={m.cls}>{m.label}</Badge>;
  };

  const dirty = webhookUrl !== webhookSalvo || webhookEnvio !== webhookEnvioSalvo;

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Link2 className="h-5 w-5" />
            Configuração dos Webhooks
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="space-y-1.5">
            <label className="text-sm font-medium">Webhook de Geração (n8n)</label>
            <Input
              placeholder="https://seu-n8n.com/webhook/gerar-variacoes"
              value={webhookUrl}
              onChange={(e) => setWebhookUrl(e.target.value)}
            />
            <p className="text-xs text-muted-foreground">
              Recebe a sugestão e retorna 10 variações de mensagem.
            </p>
          </div>
          <div className="space-y-1.5">
            <label className="text-sm font-medium">Webhook de Envio (n8n)</label>
            <Input
              placeholder="https://seu-n8n.com/webhook/enviar-disparo"
              value={webhookEnvio}
              onChange={(e) => setWebhookEnvio(e.target.value)}
            />
            <p className="text-xs text-muted-foreground">
              Recebe as 10 mensagens prontas + lista de clientes para realizar o disparo real.
            </p>
          </div>
          <Button
            onClick={salvarWebhook}
            disabled={salvandoWebhook || !dirty}
            variant="outline"
            size="sm"
          >
            {salvandoWebhook ? (
              <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Salvando...</>
            ) : (
              <><Save className="h-4 w-4 mr-2" /> Salvar Configurações</>
            )}
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5" />
            Nova Sugestão de Mensagem
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="space-y-1.5">
            <label className="text-sm font-medium">Mensagem Base</label>
            <Textarea
              placeholder="Ex: Promoção de aniversário, 20% off em todos os procedimentos esta semana..."
              value={mensagem}
              onChange={(e) => setMensagem(e.target.value)}
              rows={4}
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-sm font-medium">Observações (opcional)</label>
            <Input
              placeholder="Tom de voz, público-alvo, etc."
              value={observacoes}
              onChange={(e) => setObservacoes(e.target.value)}
            />
          </div>
          <Button onClick={handleEnviar} disabled={enviando} className="w-full">
            {enviando ? (
              <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Enviando...</>
            ) : (
              <><Send className="h-4 w-4 mr-2" /> Gerar 10 Variações</>
            )}
          </Button>
        </CardContent>
      </Card>

      <div className="space-y-3">
        <h3 className="text-lg font-semibold">Histórico de Disparos</h3>
        {disparos.length === 0 && (
          <p className="text-sm text-muted-foreground text-center py-6">
            Nenhum disparo criado ainda.
          </p>
        )}
        {disparos.map((d) => {
          const vars = variacoes[d.id] || [];
          const podeDisparar = vars.length > 0;
          return (
            <Card key={d.id}>
              <CardContent className="p-4 space-y-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap mb-1">
                      {statusBadge(d.status)}
                      <span className="text-xs text-muted-foreground">
                        {new Date(d.created_at).toLocaleString('pt-BR')}
                      </span>
                    </div>
                    <p className="text-sm line-clamp-2">{d.mensagem_sugestao}</p>
                  </div>
                  <Button size="icon" variant="ghost" onClick={() => excluirDisparo(d.id)}>
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </div>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => toggleExpandir(d.id)}
                    className="flex-1"
                  >
                    {expandido === d.id ? 'Ocultar variações' : 'Ver variações'}
                  </Button>
                  <Button
                    size="sm"
                    onClick={() => abrirDispararDialog(d.id)}
                    disabled={d.status === 'enviando'}
                    className="flex-1"
                  >
                    {d.status === 'enviando' ? (
                      <><Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" /> Enviando...</>
                    ) : (
                      <><Rocket className="h-3.5 w-3.5 mr-1" /> Disparar</>
                    )}
                  </Button>
                </div>

                {/* Progresso de envio */}
                {(d.status === 'enviando' || d.status === 'concluido') && (d.total_destinatarios || 0) > 0 && (
                  <div className="space-y-1.5 pt-1">
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-muted-foreground">
                        {d.total_enviados || 0} de {d.total_destinatarios} enviadas
                        {(d.total_falhas || 0) > 0 && ` · ${d.total_falhas} falhas`}
                      </span>
                      <span className="font-medium">
                        {Math.round(((d.total_enviados || 0) / (d.total_destinatarios || 1)) * 100)}%
                      </span>
                    </div>
                    <Progress value={((d.total_enviados || 0) / (d.total_destinatarios || 1)) * 100} className="h-2" />
                  </div>
                )}

                {/* Mídia anexada */}
                {d.media_url && (
                  <div className="flex items-center gap-2 text-xs text-muted-foreground bg-muted/40 rounded-lg p-2">
                    {d.media_type === 'video' ? <Video className="h-3.5 w-3.5" /> : <ImageIcon className="h-3.5 w-3.5" />}
                    <span>Mídia anexada</span>
                  </div>
                )}

                {expandido === d.id && (
                  <div className="space-y-2 pt-2">
                    {vars.length === 0 && (
                      <p className="text-xs text-muted-foreground text-center py-3">
                        Nenhuma variação ainda. {d.status === 'aguardando_webhook' && 'Aguardando resposta do webhook.'}
                      </p>
                    )}
                    {vars.map((v) => (
                      <div key={v.id} className="border rounded-lg p-3 space-y-2 bg-muted/30">
                        {editandoId === v.id ? (
                          <>
                            <Input
                              value={editEstilo}
                              onChange={(e) => setEditEstilo(e.target.value)}
                              placeholder="Estilo"
                              className="h-8 text-xs"
                            />
                            <Textarea
                              value={editTexto}
                              onChange={(e) => setEditTexto(e.target.value)}
                              rows={4}
                            />
                            <div className="flex gap-2">
                              <Button size="sm" onClick={() => salvarEdicao(v)}>
                                <Save className="h-3.5 w-3.5 mr-1" /> Salvar
                              </Button>
                              <Button size="sm" variant="outline" onClick={() => setEditandoId(null)}>
                                <X className="h-3.5 w-3.5 mr-1" /> Cancelar
                              </Button>
                            </div>
                          </>
                        ) : (
                          <>
                            <div className="flex items-center justify-between gap-2">
                              <Badge variant="secondary" className="text-xs">
                                {v.estilo || `Estilo ${v.ordem}`}
                              </Badge>
                              <div className="flex gap-1">
                                <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => copiar(v.mensagem, v.id)}>
                                  {copiadoId === v.id ? <Check className="h-3.5 w-3.5 text-emerald-600" /> : <Copy className="h-3.5 w-3.5" />}
                                </Button>
                                <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => iniciarEdicao(v)}>
                                  <Pencil className="h-3.5 w-3.5" />
                                </Button>
                                <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => excluirVariacao(v)}>
                                  <Trash2 className="h-3.5 w-3.5 text-destructive" />
                                </Button>
                              </div>
                            </div>
                            <p className="text-sm whitespace-pre-wrap">{v.mensagem}</p>
                          </>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>

      <DispararMassaDialog
        disparoId={dialogDisparoId}
        open={!!dialogDisparoId}
        onClose={() => setDialogDisparoId(null)}
        onDisparoIniciado={fetchDisparos}
      />
    </div>
  );
};

export default DisparosMassaTab;
