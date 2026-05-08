import React, { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { Loader2, Plug } from 'lucide-react';

const EvolutionConfigTab = () => {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [apiUrl, setApiUrl] = useState('');
  const [instanceName, setInstanceName] = useState('');
  const [apiKey, setApiKey] = useState('');
  const [cleanupTime, setCleanupTime] = useState('00:00');
  const [cleanupEnabled, setCleanupEnabled] = useState(false);

  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from('evolution_config')
        .select('*')
        .maybeSingle();
      if (data) {
        setApiUrl(data.api_url || '');
        setInstanceName(data.instance_name || '');
        setApiKey(data.api_key || '');
        setCleanupTime(data.cleanup_time || '00:00');
        setCleanupEnabled(data.cleanup_enabled || false);
      }
      setLoading(false);
    })();
  }, []);

  const salvar = async () => {
    if (!apiUrl.trim() || !instanceName.trim() || !apiKey.trim()) {
      toast({ title: 'Preencha todos os campos', variant: 'destructive' });
      return;
    }
    setSaving(true);
    const { data: u } = await supabase.auth.getUser();
    const userId = u.user?.id;
    if (!userId) { setSaving(false); return; }

    const { error } = await supabase
      .from('evolution_config')
      .upsert({
        user_id: userId,
        api_url: apiUrl.trim().replace(/\/$/, ''),
        instance_name: instanceName.trim(),
        api_key: apiKey.trim(),
        cleanup_time: cleanupTime,
        cleanup_enabled: cleanupEnabled,
      }, { onConflict: 'user_id' });

    setSaving(false);
    if (error) {
      toast({ title: 'Erro ao salvar', description: error.message, variant: 'destructive' });
    } else {
      toast({ title: 'Configuração salva!' });
    }
  };

  const testar = async () => {
    setTesting(true);
    try {
      const url = `${apiUrl.trim().replace(/\/$/, '')}/instance/connectionState/${instanceName.trim()}`;
      const r = await fetch(url, { headers: { apikey: apiKey.trim() } });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(j?.message || `HTTP ${r.status}`);
      const state = j?.instance?.state || j?.state || 'desconhecido';
      toast({ title: 'Conexão OK', description: `Estado: ${state}` });
    } catch (e: any) {
      toast({ title: 'Falha ao conectar', description: String(e?.message || e), variant: 'destructive' });
    } finally {
      setTesting(false);
    }
  };

  if (loading) {
    return <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin" /></div>;
  }

  const webhookUrl = `${(supabase as any).supabaseUrl}/functions/v1/whatsapp-webhook`;

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Plug className="h-5 w-5" />
            Conexão Evolution API
          </CardTitle>
          <CardDescription>
            Conecte o app diretamente ao seu servidor Evolution para envios e sincronização em tempo real.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>URL da Evolution</Label>
              <Input
                placeholder="https://sua-evolution.com"
                value={apiUrl}
                onChange={(e) => setApiUrl(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label>Nome da Instância</Label>
              <Input
                placeholder="minha-instancia"
                value={instanceName}
                onChange={(e) => setInstanceName(e.target.value)}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label>API Key</Label>
            <Input
              type="password"
              placeholder="sua chave de API"
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
            />
          </div>

          <div className="flex flex-col sm:flex-row gap-2">
            <Button onClick={salvar} disabled={saving} className="flex-1">
              {saving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
              Salvar Dados de Acesso
            </Button>
            <Button onClick={testar} variant="outline" disabled={testing || !apiUrl || !instanceName || !apiKey}>
              {testing ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
              Testar conexão
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Webhook e Tempo Real</CardTitle>
          <CardDescription>
            Configuração necessária para receber mensagens instantaneamente no app.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Copie o URL abaixo e cole nas configurações de Webhook da sua instância na Evolution API:
          </p>
          <div className="bg-muted p-3 rounded-md break-all font-mono text-xs select-all border border-dashed">
            {webhookUrl}
          </div>
          <div className="rounded-md bg-blue-50 p-3 text-xs text-blue-800 border border-blue-100">
            <p className="font-semibold mb-1">Eventos sugeridos:</p>
            <ul className="list-disc list-inside space-y-0.5">
              <li>MESSAGES_UPSERT (Recebimento de mensagens)</li>
              <li>CHATS_UPSERT (Criação de novas conversas)</li>
            </ul>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Limpeza Automática</CardTitle>
          <CardDescription>
            Libere espaço apagando mensagens e chats antigos do sistema.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between p-4 rounded-lg border bg-muted/10">
            <div className="space-y-0.5">
              <Label className="text-base">Ativar limpeza diária</Label>
              <p className="text-xs text-muted-foreground italic">
                Atenção: Isso apaga as mensagens APENAS no app, mantendo-as no seu WhatsApp.
              </p>
            </div>
            <input 
              type="checkbox" 
              checked={cleanupEnabled} 
              onChange={(e) => setCleanupEnabled(e.target.checked)}
              className="h-5 w-5 rounded border-gray-300 text-primary focus:ring-primary cursor-pointer"
            />
          </div>

          {cleanupEnabled && (
            <div className="space-y-2 animate-in fade-in slide-in-from-top-1">
              <Label>Horário preferencial para a limpeza</Label>
              <Input
                type="time"
                value={cleanupTime}
                onChange={(e) => setCleanupTime(e.target.value)}
                className="w-32"
              />
            </div>
          )}

          <Button onClick={salvar} disabled={saving} variant="secondary" className="w-full">
            Salvar Preferências de Limpeza
          </Button>
        </CardContent>
      </Card>
    </div>
  );
};

export default EvolutionConfigTab;
