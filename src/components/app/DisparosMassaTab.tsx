import React, { useEffect, useRef, useState, useCallback } from 'react';
import { Send, Loader2, Trash2, Copy, Check, Pencil, Save, X, Sparkles, Link2, Rocket, Image as ImageIcon, Video, ChevronDown, History, Search, CheckCircle2, XCircle, Clock, AlertTriangle, Ban, Timer, FlaskConical, RefreshCw, Pause } from 'lucide-react';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { DispararMassaDialog } from '@/components/DispararMassaDialog';
import { DisparoTimer } from '@/components/app/DisparoTimer';

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
  const [delayMin, setDelayMin] = useState<number>(5);
  const [delayMax, setDelayMax] = useState<number>(15);
  const [delayMinSalvo, setDelayMinSalvo] = useState<number>(5);
  const [delayMaxSalvo, setDelayMaxSalvo] = useState<number>(15);
  const [salvandoWebhook, setSalvandoWebhook] = useState(false);
  const [disparandoId, setDisparandoId] = useState<string | null>(null);
  const [cancelandoId, setCancelandoId] = useState<string | null>(null);
  const [dialogDisparoId, setDialogDisparoId] = useState<string | null>(null);
  const [tabAtiva, setTabAtiva] = useState<'criar' | 'historico' | 'logs' | 'testes'>('criar');
  const [envios, setEnvios] = useState<any[]>([]);
  const [loadingEnvios, setLoadingEnvios] = useState(false);
  const [loadingMais, setLoadingMais] = useState(false);
  const [temMais, setTemMais] = useState(true);
  const [buscaEnvios, setBuscaEnvios] = useState('');
  const [filtroStatus, setFiltroStatus] = useState<'todos' | 'enviado' | 'falha' | 'pendente' | 'cancelado'>('todos');
  const [logsErros, setLogsErros] = useState<any[]>([]);
  const [loadingLogs, setLoadingLogs] = useState(false);
  const [testes, setTestes] = useState<any[]>([]);
  const [loadingTestes, setLoadingTestes] = useState(false);
  const [testeExpandido, setTesteExpandido] = useState<string | null>(null);
  const [historicoExpandido, setHistoricoExpandido] = useState<string | null>(null);
  const [enviosPorDisparo, setEnviosPorDisparo] = useState<Record<string, any[]>>({});
  const [loadingEnviosDisparo, setLoadingEnviosDisparo] = useState<string | null>(null);
  const PAGE_SIZE = 50;
  const sentinelRef = useRef<HTMLDivElement | null>(null);

  const fetchEnviosPorDisparo = async (disparoId: string) => {
    setLoadingEnviosDisparo(disparoId);
    const { data } = await supabase
      .from('disparos_massa_envios')
      .select('*')
      .eq('disparo_id', disparoId)
      .order('updated_at', { ascending: false })
      .limit(2000);
    setEnviosPorDisparo((prev) => ({ ...prev, [disparoId]: data || [] }));
    setLoadingEnviosDisparo(null);
  };

  const toggleHistorico = (disparoId: string) => {
    if (historicoExpandido === disparoId) {
      setHistoricoExpandido(null);
    } else {
      setHistoricoExpandido(disparoId);
      fetchEnviosPorDisparo(disparoId);
    }
  };

  const fetchEnvios = async (reset = true) => {
    if (reset) {
      setLoadingEnvios(true);
    } else {
      setLoadingMais(true);
    }
    const offset = reset ? 0 : envios.length;
    const { data, error } = await supabase
      .from('disparos_massa_envios')
      .select('*')
      .order('created_at', { ascending: false })
      .range(offset, offset + PAGE_SIZE - 1);
    if (!error && data) {
      setEnvios((prev) => (reset ? data : [...prev, ...data]));
      setTemMais(data.length === PAGE_SIZE);
    }
    if (reset) setLoadingEnvios(false);
    else setLoadingMais(false);
  };

  const carregarMais = useCallback(() => {
    if (loadingEnvios || loadingMais || !temMais) return;
    fetchEnvios(false);
  }, [loadingEnvios, loadingMais, temMais, envios.length]);

  const fetchConfig = async () => {
    const { data } = await supabase
      .from('disparos_massa_config')
      .select('webhook_url, webhook_envio_url, delay_min, delay_max')
      .maybeSingle();
    if (data) {
      setWebhookUrl(data.webhook_url || '');
      setWebhookSalvo(data.webhook_url || '');
      setWebhookEnvio(data.webhook_envio_url || '');
      setWebhookEnvioSalvo(data.webhook_envio_url || '');
      const dMin = Number((data as any).delay_min ?? 5);
      const dMax = Number((data as any).delay_max ?? 15);
      setDelayMin(dMin);
      setDelayMax(dMax);
      setDelayMinSalvo(dMin);
      setDelayMaxSalvo(dMax);
    }
  };

  const fetchLogs = async () => {
    setLoadingLogs(true);
    const { data } = await supabase
      .from('disparos_massa_envios')
      .select('*')
      .eq('status', 'falha')
      .order('updated_at', { ascending: false })
      .limit(200);
    setLogsErros(data || []);
    setLoadingLogs(false);
  };

  const fetchTestes = async () => {
    setLoadingTestes(true);
    const { data } = await (supabase as any)
      .from('disparos_massa_testes')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(50);
    setTestes(data || []);
    setLoadingTestes(false);
  };

  const cancelarTeste = async (id: string) => {
    if (!confirm('Cancelar este teste? Os envios já feitos permanecem; os pendentes serão interrompidos.')) return;
    const { error } = await (supabase as any)
      .from('disparos_massa_testes')
      .update({ status: 'cancelado', finalizado_at: new Date().toISOString() })
      .eq('id', id);
    if (error) {
      toast({ title: 'Erro', description: error.message, variant: 'destructive' });
    } else {
      toast({ title: 'Teste cancelado' });
      fetchTestes();
    }
  };

  const retomarTeste = async (id: string) => {
    try {
      await (supabase as any)
        .from('disparos_massa_testes')
        .update({ status: 'em_andamento' })
        .eq('id', id);
      const { error } = await supabase.functions.invoke('disparo-massa-testar', {
        body: { teste_id: id, modo: 'retomar' },
      });
      if (error) throw error;
      toast({ title: 'Teste retomado' });
      fetchTestes();
    } catch (e: any) {
      toast({ title: 'Erro', description: e.message || 'Falha ao retomar', variant: 'destructive' });
    }
  };

  const excluirTeste = async (id: string) => {
    if (!confirm('Excluir este teste e todo o histórico de envios?')) return;
    const { error } = await (supabase as any)
      .from('disparos_massa_testes')
      .delete()
      .eq('id', id);
    if (!error) {
      toast({ title: 'Excluído' });
      fetchTestes();
    }
  };

  const cancelarDisparo = async (id: string) => {
    if (!confirm('CANCELAR este disparo? Os envios pendentes serão marcados como cancelados e NÃO poderão ser retomados.')) return;
    setCancelandoId(id);
    const { error } = await supabase
      .from('disparos_massa')
      .update({ status: 'cancelado' })
      .eq('id', id);
    setCancelandoId(null);
    if (error) {
      toast({ title: 'Erro', description: error.message, variant: 'destructive' });
    } else {
      toast({ title: 'Disparo cancelado', description: 'Os pendentes serão marcados como cancelados em alguns segundos.' });
      fetchDisparos();
    }
  };

  const pausarDisparo = async (id: string) => {
    setCancelandoId(id);
    const { error } = await supabase
      .from('disparos_massa')
      .update({ status: 'pausado' })
      .eq('id', id);
    setCancelandoId(null);
    if (error) {
      toast({ title: 'Erro', description: error.message, variant: 'destructive' });
    } else {
      toast({ title: 'Disparo pausado', description: 'Os envios pendentes permanecem e podem ser retomados.' });
      fetchDisparos();
    }
  };

  const retomarDisparo = async (id: string) => {
    try {
      // Reverte envios cancelados (de pausas/cancelamentos antigos) para pendente
      // para que possam ser processados novamente.
      await supabase
        .from('disparos_massa_envios')
        .update({ status: 'pendente', erro: null })
        .eq('disparo_id', id)
        .eq('status', 'cancelado');
      await supabase
        .from('disparos_massa')
        .update({ status: 'enviando', finalizado_at: null })
        .eq('id', id);
      const { error } = await supabase.functions.invoke('disparo-massa-enviar-direto', {
        body: { disparo_id: id, modo: 'continuar' },
      });
      if (error) throw error;
      toast({ title: 'Disparo retomado', description: 'Continuando os envios pendentes.' });
      fetchDisparos();
    } catch (e: any) {
      toast({ title: 'Erro', description: e.message || 'Falha ao retomar', variant: 'destructive' });
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
    if (delayMin < 2) {
      toast({ title: 'Delay mínimo inválido', description: 'O mínimo é 2 segundos.', variant: 'destructive' });
      return;
    }
    if (delayMax < delayMin) {
      toast({ title: 'Delay máximo inválido', description: 'Deve ser maior ou igual ao mínimo.', variant: 'destructive' });
      return;
    }
    setSalvandoWebhook(true);
    try {
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) throw new Error('Não autenticado');

      const { error } = await supabase
        .from('disparos_massa_config')
        .upsert(
          {
            user_id: userData.user.id,
            webhook_url: url,
            webhook_envio_url: urlEnvio || null,
            delay_min: delayMin,
            delay_max: delayMax,
          },
          { onConflict: 'user_id' },
        );
      if (error) throw error;
      setWebhookSalvo(url);
      setWebhookEnvioSalvo(urlEnvio);
      setDelayMinSalvo(delayMin);
      setDelayMaxSalvo(delayMax);
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
        { event: '*', schema: 'public', table: 'disparos_massa_envios' },
        () => {
          fetchDisparos();
          fetchEnvios();
          if (historicoExpandido) fetchEnviosPorDisparo(historicoExpandido);
        },
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'disparos_massa_testes' },
        () => fetchTestes(),
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [historicoExpandido]);

  // Polling de segurança: enquanto houver disparo OU teste em andamento, refaz fetch a cada 1.5s
  useEffect(() => {
    const temEnviando = disparos.some((d) => d.status === 'enviando');
    const temTesteAtivo = testes.some((t) => t.status === 'em_andamento' || t.status === 'pendente');
    if (!temEnviando && !temTesteAtivo) return;
    const interval = setInterval(() => {
      if (temEnviando) {
        fetchDisparos();
        if (historicoExpandido) fetchEnviosPorDisparo(historicoExpandido);
      }
      if (temEnviando && tabAtiva === 'historico') fetchEnvios();
      if (temTesteAtivo) fetchTestes();
    }, 1500);
    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    disparos.some((d) => d.status === 'enviando'),
    testes.some((t) => t.status === 'em_andamento' || t.status === 'pendente'),
    tabAtiva,
    historicoExpandido,
  ]);

  useEffect(() => {
    if (tabAtiva === 'historico') fetchEnvios(true);
    if (tabAtiva === 'logs') fetchLogs();
    if (tabAtiva === 'testes') fetchTestes();
  }, [tabAtiva]);

  // Lazy loading: observa o sentinel e carrega mais ao chegar perto do fim
  useEffect(() => {
    if (tabAtiva !== 'historico') return;
    const el = sentinelRef.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) carregarMais();
      },
      { rootMargin: '200px' },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [tabAtiva, carregarMais]);

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
      pausado: { label: 'Pausado', cls: 'bg-amber-100 text-amber-700' },
      enviado: { label: 'Enviado', cls: 'bg-emerald-100 text-emerald-700' },
      cancelado: { label: 'Cancelado', cls: 'bg-destructive/15 text-destructive' },
      falha: { label: 'Falha', cls: 'bg-destructive/15 text-destructive' },
    };
    const m = map[status] || { label: status, cls: 'bg-muted' };
    return <Badge className={m.cls}>{m.label}</Badge>;
  };

  const dirty =
    webhookUrl !== webhookSalvo ||
    webhookEnvio !== webhookEnvioSalvo ||
    delayMin !== delayMinSalvo ||
    delayMax !== delayMaxSalvo;

  return (
    <div className="space-y-4">
      <Collapsible>
        <Card>
          <CollapsibleTrigger asChild>
            <button className="w-full text-left">
              <CardHeader className="cursor-pointer hover:bg-muted/30 transition-colors rounded-t-lg">
                <CardTitle className="flex items-center justify-between gap-2 text-base">
                  <span className="flex items-center gap-2">
                    <Link2 className="h-4 w-4" />
                    Configurações de Disparo
                  </span>
                  <ChevronDown className="h-4 w-4 transition-transform data-[state=open]:rotate-180" />
                </CardTitle>
              </CardHeader>
            </button>
          </CollapsibleTrigger>
          <CollapsibleContent>
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
              <div className="space-y-1.5 pt-2 border-t">
                <label className="text-sm font-medium flex items-center gap-1.5">
                  <Timer className="h-4 w-4" />
                  Intervalo entre mensagens (segundos)
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <p className="text-xs text-muted-foreground mb-1">Mínimo</p>
                    <Input
                      type="number"
                      min={2}
                      value={delayMin}
                      onChange={(e) => setDelayMin(Math.max(2, Number(e.target.value) || 2))}
                    />
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground mb-1">Máximo</p>
                    <Input
                      type="number"
                      min={delayMin}
                      value={delayMax}
                      onChange={(e) => setDelayMax(Math.max(delayMin, Number(e.target.value) || delayMin))}
                    />
                  </div>
                </div>
                <p className="text-xs text-muted-foreground">
                  Cada mensagem aguarda um tempo aleatório dentro deste intervalo. Recomendado mín. 5s para evitar bloqueios do WhatsApp.
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
          </CollapsibleContent>
        </Card>
      </Collapsible>

      <Tabs value={tabAtiva} onValueChange={(v) => setTabAtiva(v as 'criar' | 'historico' | 'logs' | 'testes')}>
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="criar" className="flex items-center gap-1 text-xs sm:text-sm">
            <Sparkles className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Criar</span>
          </TabsTrigger>
          <TabsTrigger value="historico" className="flex items-center gap-1 text-xs sm:text-sm">
            <History className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Histórico</span>
          </TabsTrigger>
          <TabsTrigger value="logs" className="flex items-center gap-1 text-xs sm:text-sm">
            <AlertTriangle className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Erros</span>
          </TabsTrigger>
          <TabsTrigger value="testes" className="flex items-center gap-1 text-xs sm:text-sm">
            <FlaskConical className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Testes</span>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="criar" className="space-y-4 mt-4">
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
                <div className="flex gap-2 flex-wrap">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => toggleExpandir(d.id)}
                    className="flex-1 min-w-[120px]"
                  >
                    {expandido === d.id ? 'Ocultar variações' : 'Ver variações'}
                  </Button>
                  {(d.total_destinatarios || 0) > 0 && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => toggleHistorico(d.id)}
                      className="flex-1 min-w-[120px]"
                    >
                      <History className="h-3.5 w-3.5 mr-1" />
                      {historicoExpandido === d.id ? 'Ocultar histórico' : 'Ver histórico'}
                    </Button>
                  )}
                  {d.status === 'enviando' ? (
                    <>
                      <Button
                        size="sm"
                        variant="secondary"
                        onClick={() => pausarDisparo(d.id)}
                        disabled={cancelandoId === d.id}
                        className="flex-1 min-w-[120px]"
                      >
                        {cancelandoId === d.id ? (
                          <><Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" /> Aguarde...</>
                        ) : (
                          <><Pause className="h-3.5 w-3.5 mr-1" /> Pausar</>
                        )}
                      </Button>
                      <Button
                        size="sm"
                        variant="destructive"
                        onClick={() => cancelarDisparo(d.id)}
                        disabled={cancelandoId === d.id}
                        className="flex-1 min-w-[120px]"
                      >
                        <Ban className="h-3.5 w-3.5 mr-1" /> Cancelar
                      </Button>
                    </>
                  ) : (
                    <>
                      {/* Retomar quando há pendentes e NÃO está cancelado */}
                      {d.status !== 'cancelado' &&
                        (d.total_destinatarios || 0) > 0 &&
                        ((d.total_enviados || 0) + (d.total_falhas || 0)) < (d.total_destinatarios || 0) && (
                          <Button
                            size="sm"
                            variant="secondary"
                            onClick={() => retomarDisparo(d.id)}
                            className="flex-1 min-w-[120px]"
                          >
                            <Rocket className="h-3.5 w-3.5 mr-1" />
                            {d.status === 'pausado' ? 'Retomar' : 'Retomar pendentes'}
                          </Button>
                        )}
                      <Button
                        size="sm"
                        onClick={() => abrirDispararDialog(d.id)}
                        className="flex-1 min-w-[120px]"
                      >
                        <Rocket className="h-3.5 w-3.5 mr-1" /> Disparar
                      </Button>
                    </>
                  )}
                </div>

                {/* Progresso de envio */}
                {(d.status === 'enviando' || d.status === 'pausado' || d.status === 'concluido' || d.status === 'cancelado') && (d.total_destinatarios || 0) > 0 && (
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
                    <DisparoTimer
                      iniciadoAt={(d as any).iniciado_at}
                      finalizadoAt={(d as any).finalizado_at}
                      total={d.total_destinatarios || 0}
                      processados={(d.total_enviados || 0) + (d.total_falhas || 0)}
                      delayMedioSegundos={(delayMinSalvo + delayMaxSalvo) / 2}
                      ativo={d.status === 'enviando'}
                    />
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

                {/* Histórico de envios deste disparo (estilo log dos testes) */}
                {historicoExpandido === d.id && (
                  <div className="border-t -mx-4 -mb-4 mt-2 bg-muted/20 p-3 space-y-1.5 max-h-96 overflow-y-auto rounded-b-lg">
                    <p className="text-xs font-semibold text-muted-foreground sticky top-0 bg-muted/40 backdrop-blur py-1 -mx-3 px-3">
                      Log de envios ({(enviosPorDisparo[d.id] || []).length})
                    </p>
                    {loadingEnviosDisparo === d.id && !enviosPorDisparo[d.id] ? (
                      <div className="flex items-center justify-center py-6">
                        <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                      </div>
                    ) : (enviosPorDisparo[d.id] || []).length === 0 ? (
                      <p className="text-xs text-muted-foreground italic text-center py-3">
                        Nenhum envio registrado ainda.
                      </p>
                    ) : (
                      (enviosPorDisparo[d.id] || []).map((e, idx) => {
                        const ok = e.status === 'enviado';
                        const cancelado = e.status === 'cancelado';
                        const pendente = e.status === 'pendente';
                        return (
                          <div
                            key={e.id}
                            className={`text-xs p-2 rounded border ${
                              ok
                                ? 'bg-emerald-50 dark:bg-emerald-950/20 border-emerald-200 dark:border-emerald-900'
                                : pendente
                                  ? 'bg-muted/40 border-border'
                                  : 'bg-destructive/5 border-destructive/30'
                            }`}
                          >
                            <div className="flex items-center justify-between gap-2 flex-wrap">
                              <span className="flex items-center gap-1.5 font-medium min-w-0">
                                {ok ? (
                                  <CheckCircle2 className="h-3 w-3 text-emerald-600 shrink-0" />
                                ) : cancelado ? (
                                  <Ban className="h-3 w-3 text-destructive shrink-0" />
                                ) : pendente ? (
                                  <Clock className="h-3 w-3 text-muted-foreground shrink-0" />
                                ) : (
                                  <XCircle className="h-3 w-3 text-destructive shrink-0" />
                                )}
                                <span className="truncate">
                                  #{(enviosPorDisparo[d.id] || []).length - idx} · {e.cliente_nome}
                                </span>
                                <span className="text-muted-foreground">·</span>
                                <span className="text-muted-foreground truncate">{e.telefone}</span>
                              </span>
                              <span className="text-[10px] text-muted-foreground">
                                {e.enviado_at
                                  ? new Date(e.enviado_at).toLocaleTimeString('pt-BR')
                                  : new Date(e.updated_at || e.created_at).toLocaleTimeString('pt-BR')}
                              </span>
                            </div>
                            {e.mensagem_enviada && (
                              <details className="mt-1.5 group">
                                <summary className="cursor-pointer text-[11px] text-muted-foreground hover:text-foreground select-none flex items-center gap-1">
                                  <ChevronDown className="h-3 w-3 transition-transform group-open:rotate-180" />
                                  <span className="group-open:hidden">Ver mensagem</span>
                                  <span className="hidden group-open:inline">Ocultar mensagem</span>
                                </summary>
                                <p className="mt-1 whitespace-pre-wrap text-foreground/90 bg-background/60 rounded p-1.5 leading-snug">
                                  {e.mensagem_enviada}
                                </p>
                              </details>
                            )}
                            {e.erro && (
                              <p className="text-destructive mt-1 break-all">Erro: {e.erro}</p>
                            )}
                          </div>
                        );
                      })
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>
        </TabsContent>

        <TabsContent value="historico" className="space-y-3 mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <History className="h-4 w-4" />
                Histórico de Mensagens Enviadas
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex flex-col sm:flex-row gap-2">
                <div className="relative flex-1">
                  <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Buscar por nome, telefone ou mensagem..."
                    value={buscaEnvios}
                    onChange={(e) => setBuscaEnvios(e.target.value)}
                    className="pl-9"
                  />
                </div>
                <div className="flex gap-1.5 flex-wrap">
                  {(['todos', 'enviado', 'falha', 'pendente', 'cancelado'] as const).map((s) => (
                    <Button
                      key={s}
                      size="sm"
                      variant={filtroStatus === s ? 'default' : 'outline'}
                      onClick={() => setFiltroStatus(s)}
                      className="capitalize"
                    >
                      {s}
                    </Button>
                  ))}
                </div>
              </div>

              {loadingEnvios && (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                </div>
              )}

              {!loadingEnvios && (() => {
                const termo = buscaEnvios.trim().toLowerCase();
                const filtrados = envios.filter((e) => {
                  if (filtroStatus !== 'todos' && e.status !== filtroStatus) return false;
                  if (!termo) return true;
                  return (
                    (e.cliente_nome || '').toLowerCase().includes(termo) ||
                    (e.telefone || '').toLowerCase().includes(termo) ||
                    (e.mensagem_enviada || '').toLowerCase().includes(termo)
                  );
                });

                if (filtrados.length === 0) {
                  return (
                    <p className="text-sm text-muted-foreground text-center py-8">
                      Nenhuma mensagem encontrada.
                    </p>
                  );
                }

                return (
                  <div className="space-y-2">
                    <p className="text-xs text-muted-foreground">
                      {filtrados.length} de {envios.length} carregadas
                      {temMais && ' (role para ver mais)'}
                    </p>
                    {filtrados.map((e) => {
                      const statusIcon =
                        e.status === 'enviado' ? (
                          <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
                        ) : e.status === 'falha' ? (
                          <XCircle className="h-3.5 w-3.5 text-destructive" />
                        ) : e.status === 'cancelado' ? (
                          <Ban className="h-3.5 w-3.5 text-destructive" />
                        ) : (
                          <Clock className="h-3.5 w-3.5 text-muted-foreground" />
                        );
                      return (
                        <div key={e.id} className="border rounded-lg p-3 space-y-1.5 bg-card">
                          <div className="flex items-start justify-between gap-2 flex-wrap">
                            <div className="flex items-center gap-2 min-w-0">
                              {statusIcon}
                              <span className="font-medium text-sm truncate">{e.cliente_nome}</span>
                              <span className="text-xs text-muted-foreground">·</span>
                              <span className="text-xs text-muted-foreground">{e.telefone}</span>
                            </div>
                            <span className="text-[11px] text-muted-foreground">
                              {e.enviado_at
                                ? new Date(e.enviado_at).toLocaleString('pt-BR')
                                : new Date(e.created_at).toLocaleString('pt-BR')}
                            </span>
                          </div>
                          {e.mensagem_enviada ? (
                            <p className="text-sm whitespace-pre-wrap text-foreground/90 bg-muted/40 rounded p-2">
                              {e.mensagem_enviada}
                            </p>
                          ) : (
                            <p className="text-xs text-muted-foreground italic">Mensagem não registrada</p>
                          )}
                          {e.erro && (
                            <p className="text-xs text-destructive">Erro: {e.erro}</p>
                          )}
                        </div>
                      );
                    })}

                    {/* Sentinel para auto-load + botão fallback */}
                    {temMais && (
                      <div ref={sentinelRef} className="flex items-center justify-center py-4">
                        {loadingMais ? (
                          <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                        ) : (
                          <Button variant="outline" size="sm" onClick={carregarMais}>
                            Carregar mais
                          </Button>
                        )}
                      </div>
                    )}
                    {!temMais && envios.length > PAGE_SIZE && (
                      <p className="text-center text-xs text-muted-foreground py-3">
                        Fim do histórico
                      </p>
                    )}
                  </div>
                );
              })()}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="logs" className="space-y-3 mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <AlertTriangle className="h-4 w-4 text-destructive" />
                Log de Erros de Envio
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-center justify-between">
                <p className="text-xs text-muted-foreground">
                  {logsErros.length} {logsErros.length === 1 ? 'erro registrado' : 'erros registrados'}
                </p>
                <Button size="sm" variant="outline" onClick={fetchLogs} disabled={loadingLogs}>
                  {loadingLogs ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : 'Atualizar'}
                </Button>
              </div>
              {loadingLogs ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                </div>
              ) : logsErros.length === 0 ? (
                <div className="text-center py-10 space-y-2">
                  <CheckCircle2 className="h-10 w-10 text-emerald-500 mx-auto" />
                  <p className="text-sm text-muted-foreground">Nenhum erro registrado. Tudo certo!</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {logsErros.map((e) => (
                    <div key={e.id} className="border border-destructive/30 rounded-lg p-3 space-y-1.5 bg-destructive/5">
                      <div className="flex items-start justify-between gap-2 flex-wrap">
                        <div className="flex items-center gap-2 min-w-0">
                          <XCircle className="h-3.5 w-3.5 text-destructive shrink-0" />
                          <span className="font-medium text-sm truncate">{e.cliente_nome}</span>
                          <span className="text-xs text-muted-foreground">·</span>
                          <span className="text-xs text-muted-foreground">{e.telefone}</span>
                        </div>
                        <span className="text-[11px] text-muted-foreground">
                          {new Date(e.updated_at || e.created_at).toLocaleString('pt-BR')}
                        </span>
                      </div>
                      <p className="text-xs text-destructive font-medium bg-destructive/10 rounded p-2">
                        {e.erro || 'Erro não especificado'}
                      </p>
                      {e.mensagem_enviada && (
                        <details className="text-xs">
                          <summary className="cursor-pointer text-muted-foreground hover:text-foreground">
                            Ver mensagem
                          </summary>
                          <p className="mt-1.5 whitespace-pre-wrap text-foreground/80 bg-muted/40 rounded p-2">
                            {e.mensagem_enviada}
                          </p>
                        </details>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="testes" className="space-y-3 mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <FlaskConical className="h-4 w-4 text-amber-600" />
                Histórico de Testes
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-center justify-between">
                <p className="text-xs text-muted-foreground">
                  {testes.length} {testes.length === 1 ? 'teste registrado' : 'testes registrados'}
                </p>
                <Button size="sm" variant="outline" onClick={fetchTestes} disabled={loadingTestes}>
                  {loadingTestes ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <><RefreshCw className="h-3.5 w-3.5 mr-1" /> Atualizar</>}
                </Button>
              </div>

              {loadingTestes ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                </div>
              ) : testes.length === 0 ? (
                <div className="text-center py-10 space-y-2">
                  <FlaskConical className="h-10 w-10 text-muted-foreground/40 mx-auto" />
                  <p className="text-sm text-muted-foreground">Nenhum teste realizado ainda.</p>
                  <p className="text-xs text-muted-foreground">Use o "Modo Teste" no diálogo de disparo para começar.</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {testes.map((t) => {
                    const expandido = testeExpandido === t.id;
                    const progresso = t.quantidade_total > 0
                      ? Math.round(((t.enviadas + t.falhas) / t.quantidade_total) * 100)
                      : 0;
                    const ativo = t.status === 'em_andamento' || t.status === 'pendente';
                    const statusCls: Record<string, string> = {
                      pendente: 'bg-muted text-muted-foreground',
                      em_andamento: 'bg-primary/15 text-primary',
                      concluido: 'bg-emerald-100 text-emerald-700',
                      cancelado: 'bg-destructive/15 text-destructive',
                      erro: 'bg-destructive/15 text-destructive',
                    };
                    const statusLabel: Record<string, string> = {
                      pendente: 'Pendente',
                      em_andamento: 'Em andamento',
                      concluido: 'Concluído',
                      cancelado: 'Cancelado',
                      erro: 'Erro',
                    };
                    const log: any[] = Array.isArray(t.log_envios) ? t.log_envios : [];
                    return (
                      <div key={t.id} className="border rounded-xl bg-card overflow-hidden">
                        <button
                          type="button"
                          className="w-full text-left p-3 hover:bg-muted/30 transition-colors"
                          onClick={() => setTesteExpandido(expandido ? null : t.id)}
                        >
                          <div className="flex items-start justify-between gap-2 flex-wrap mb-2">
                            <div className="flex items-center gap-2 min-w-0">
                              <FlaskConical className="h-4 w-4 text-amber-600 shrink-0" />
                              <span className="font-medium text-sm">{t.telefone_teste}</span>
                              <Badge className={statusCls[t.status] || 'bg-muted'}>
                                {ativo && <Loader2 className="h-3 w-3 mr-1 animate-spin inline" />}
                                {statusLabel[t.status] || t.status}
                              </Badge>
                            </div>
                            <span className="text-[11px] text-muted-foreground">
                              {new Date(t.created_at).toLocaleString('pt-BR')}
                            </span>
                          </div>
                          <Progress value={progresso} className="h-2 mb-1.5" />
                          <div className="flex items-center justify-between text-xs flex-wrap gap-2">
                            <span className="text-muted-foreground">
                              {t.enviadas + t.falhas} / {t.quantidade_total} processadas ({progresso}%)
                            </span>
                            <div className="flex items-center gap-2">
                              <span className="flex items-center gap-1 text-emerald-600">
                                <CheckCircle2 className="h-3 w-3" /> {t.enviadas}
                              </span>
                              <span className="flex items-center gap-1 text-destructive">
                                <XCircle className="h-3 w-3" /> {t.falhas}
                              </span>
                            </div>
                          </div>
                          <DisparoTimer
                            iniciadoAt={t.iniciado_at}
                            finalizadoAt={t.finalizado_at}
                            total={t.quantidade_total || 0}
                            processados={(t.enviadas || 0) + (t.falhas || 0)}
                            delayMedioSegundos={(delayMinSalvo + delayMaxSalvo) / 2}
                            ativo={ativo}
                          />
                          {t.ultimo_erro && (
                            <p className="text-xs text-destructive mt-1.5 truncate">
                              Último erro: {t.ultimo_erro}
                            </p>
                          )}
                        </button>

                        {/* Ações */}
                        <div className="flex items-center gap-1.5 px-3 pb-2 flex-wrap border-t pt-2">
                          {ativo && (
                            <Button size="sm" variant="outline" onClick={() => cancelarTeste(t.id)}>
                              <Ban className="h-3.5 w-3.5 mr-1" /> Cancelar
                            </Button>
                          )}
                          {(t.status === 'cancelado' || t.status === 'erro') && t.proximo_indice < t.quantidade_total && (
                            <Button size="sm" variant="outline" onClick={() => retomarTeste(t.id)}>
                              <RefreshCw className="h-3.5 w-3.5 mr-1" /> Retomar
                            </Button>
                          )}
                          <Button size="sm" variant="ghost" className="text-destructive ml-auto" onClick={() => excluirTeste(t.id)}>
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </div>

                        {/* Log expandido */}
                        {expandido && (
                          <div className="border-t bg-muted/20 p-3 space-y-1.5 max-h-80 overflow-y-auto">
                            <p className="text-xs font-semibold text-muted-foreground sticky top-0 bg-muted/40 backdrop-blur py-1">
                              Log de envios ({log.length})
                            </p>
                            {log.length === 0 ? (
                              <p className="text-xs text-muted-foreground italic">Aguardando envios...</p>
                            ) : (
                              log.slice().reverse().map((l, idx) => (
                                <div
                                  key={idx}
                                  className={`text-xs p-2 rounded border ${
                                    l.status === 'enviado'
                                      ? 'bg-emerald-50 dark:bg-emerald-950/20 border-emerald-200 dark:border-emerald-900'
                                      : 'bg-destructive/5 border-destructive/30'
                                  }`}
                                >
                                  <div className="flex items-center justify-between gap-2 flex-wrap">
                                    <span className="flex items-center gap-1.5 font-medium">
                                      {l.status === 'enviado' ? (
                                        <CheckCircle2 className="h-3 w-3 text-emerald-600" />
                                      ) : (
                                        <XCircle className="h-3 w-3 text-destructive" />
                                      )}
                                      #{l.indice} · {l.simulando}
                                    </span>
                                    <span className="text-[10px] text-muted-foreground">
                                      {l.timestamp ? new Date(l.timestamp).toLocaleTimeString('pt-BR') : ''}
                                      {l.variacao_ordem ? ` · var ${l.variacao_ordem}` : ''}
                                    </span>
                                  </div>
                                  {l.erro && (
                                    <p className="text-destructive mt-1 break-all">{l.erro}</p>
                                  )}
                                </div>
                              ))
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

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
