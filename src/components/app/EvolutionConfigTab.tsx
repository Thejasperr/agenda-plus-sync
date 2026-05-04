import React, { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
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

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Plug className="h-5 w-5" />
          Conexão Evolution API
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm text-muted-foreground">
          Conecte o app diretamente ao seu servidor Evolution. Estes dados são usados para todos os envios e sincronizações de WhatsApp.
        </p>

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
            Salvar
          </Button>
          <Button onClick={testar} variant="outline" disabled={testing || !apiUrl || !instanceName || !apiKey}>
            {testing ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
            Testar conexão
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};

export default EvolutionConfigTab;
