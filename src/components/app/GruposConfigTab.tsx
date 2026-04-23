import React, { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Sparkles, Save } from 'lucide-react';

const GruposConfigTab: React.FC = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [webhookUrl, setWebhookUrl] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [configId, setConfigId] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;
    (async () => {
      const { data } = await supabase
        .from('grupos_mensagens_config')
        .select('id, webhook_url')
        .eq('user_id', user.id)
        .maybeSingle();
      if (data) {
        setWebhookUrl(data.webhook_url);
        setConfigId(data.id);
      }
      setLoading(false);
    })();
  }, [user]);

  const handleSave = async () => {
    if (!user) return;
    if (!webhookUrl.trim()) {
      toast({ title: 'Cole a URL do webhook', variant: 'destructive' });
      return;
    }
    setSaving(true);
    try {
      if (configId) {
        const { error } = await supabase
          .from('grupos_mensagens_config')
          .update({ webhook_url: webhookUrl.trim() })
          .eq('id', configId);
        if (error) throw error;
      } else {
        const { data, error } = await supabase
          .from('grupos_mensagens_config')
          .insert({ user_id: user.id, webhook_url: webhookUrl.trim() })
          .select()
          .single();
        if (error) throw error;
        setConfigId(data.id);
      }
      toast({ title: 'Salvo!', description: 'Webhook do n8n atualizado.' });
    } catch (err: any) {
      toast({ title: 'Erro ao salvar', description: err.message, variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Sparkles className="h-5 w-5 text-primary" />
          Mensagens IA para grupos
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="text-sm text-muted-foreground space-y-1">
          <p>Cole a URL do webhook n8n que reestrutura suas mensagens com IA.</p>
          <p className="text-xs">
            O n8n recebe <code className="bg-muted px-1 rounded">{`{ mensagem_original, grupo_nome, user_id }`}</code> e
            deve responder <code className="bg-muted px-1 rounded">{`{ mensagem_reestruturada: "..." }`}</code>.
          </p>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="grupos-webhook">URL do webhook n8n</Label>
          <Input
            id="grupos-webhook"
            type="url"
            placeholder="https://n8n.seu-servidor.com/webhook/reestruturar-grupo"
            value={webhookUrl}
            onChange={(e) => setWebhookUrl(e.target.value)}
            disabled={loading || saving}
          />
        </div>

        <Button onClick={handleSave} disabled={saving || loading} className="w-full sm:w-auto">
          {saving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}
          Salvar
        </Button>
      </CardContent>
    </Card>
  );
};

export default GruposConfigTab;
