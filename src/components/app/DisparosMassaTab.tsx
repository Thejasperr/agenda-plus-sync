import React, { useEffect, useState } from 'react';
import { Send, Loader2, Trash2, Copy, Check, Pencil, Save, X, Sparkles, Link2 } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';

interface Disparo {
  id: string;
  mensagem_sugestao: string;
  status: string;
  observacoes: string | null;
  created_at: string;
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
  const [salvandoWebhook, setSalvandoWebhook] = useState(false);

  const fetchConfig = async () => {
    const { data } = await supabase
      .from('disparos_massa_config')
      .select('webhook_url')
      .maybeSingle();
    if (data?.webhook_url) {
      setWebhookUrl(data.webhook_url);
      setWebhookSalvo(data.webhook_url);
    }
  };

  const salvarWebhook = async () => {
    const url = webhookUrl.trim();
    if (url && !/^https?:\/\//i.test(url)) {
      toast({ title: 'URL inválida', description: 'Deve começar com http:// ou https://', variant: 'destructive' });
      return;
    }
    setSalvandoWebhook(true);
    try {
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) throw new Error('Não autenticado');

      const { error } = await supabase
        .from('disparos_massa_config')
        .upsert({ user_id: userData.user.id, webhook_url: url }, { onConflict: 'user_id' });
      if (error) throw error;
      setWebhookSalvo(url);
      toast({ title: 'Webhook salvo' });
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

    // Realtime para receber variações geradas pelo webhook
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
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, []);

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
    fetchConfig();
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
    };
    const m = map[status] || { label: status, cls: 'bg-muted' };
    return <Badge className={m.cls}>{m.label}</Badge>;
  };

  return (
    <div className="space-y-4">
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
          <p className="text-xs text-muted-foreground">
            A mensagem será enviada ao webhook que retornará 10 estilos diferentes para você analisar e editar.
          </p>
        </CardContent>
      </Card>

      <div className="space-y-3">
        <h3 className="text-lg font-semibold">Histórico de Disparos</h3>
        {disparos.length === 0 && (
          <p className="text-sm text-muted-foreground text-center py-6">
            Nenhum disparo criado ainda.
          </p>
        )}
        {disparos.map((d) => (
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
              <Button
                variant="outline"
                size="sm"
                onClick={() => toggleExpandir(d.id)}
                className="w-full"
              >
                {expandido === d.id ? 'Ocultar variações' : 'Ver variações'}
              </Button>

              {expandido === d.id && (
                <div className="space-y-2 pt-2">
                  {(variacoes[d.id] || []).length === 0 && (
                    <p className="text-xs text-muted-foreground text-center py-3">
                      Nenhuma variação ainda. {d.status === 'aguardando_webhook' && 'Aguardando resposta do webhook.'}
                    </p>
                  )}
                  {(variacoes[d.id] || []).map((v) => (
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
        ))}
      </div>
    </div>
  );
};

export default DisparosMassaTab;
