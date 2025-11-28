import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { QrCode, Save } from 'lucide-react';

interface ConfiguracaoPix {
  tipo_chave: string;
  chave_pix: string;
  nome_recebedor: string;
  cidade: string;
}

const ConfiguracaoPixTab = () => {
  const [configuracao, setConfiguracao] = useState<ConfiguracaoPix>({
    tipo_chave: 'cpf',
    chave_pix: '',
    nome_recebedor: '',
    cidade: '',
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    fetchConfiguracao();
  }, []);

  const fetchConfiguracao = async () => {
    try {
      const { data, error } = await supabase
        .from('configuracoes_pix')
        .select('*')
        .maybeSingle();

      if (error) throw error;
      
      if (data) {
        setConfiguracao({
          tipo_chave: data.tipo_chave,
          chave_pix: data.chave_pix,
          nome_recebedor: data.nome_recebedor,
          cidade: data.cidade,
        });
      }
    } catch (error) {
      console.error('Erro ao buscar configuração PIX:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!configuracao.chave_pix || !configuracao.nome_recebedor || !configuracao.cidade) {
      toast({
        title: "Erro",
        description: "Preencha todos os campos obrigatórios",
        variant: "destructive",
      });
      return;
    }

    setSaving(true);
    try {
      // Verificar se já existe configuração
      const { data: existingData } = await supabase
        .from('configuracoes_pix')
        .select('id')
        .maybeSingle();

      if (existingData) {
        // Atualizar
        const { error } = await supabase
          .from('configuracoes_pix')
          .update(configuracao)
          .eq('id', existingData.id);

        if (error) throw error;
      } else {
        // Inserir
        const { error } = await supabase
          .from('configuracoes_pix')
          .insert([configuracao]);

        if (error) throw error;
      }

      toast({
        title: "Sucesso",
        description: "Configurações PIX salvas com sucesso!",
      });
    } catch (error) {
      console.error('Erro ao salvar configuração PIX:', error);
      toast({
        title: "Erro",
        description: "Não foi possível salvar as configurações PIX",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <div>Carregando...</div>;
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <QrCode className="h-5 w-5" />
            Configuração PIX
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Configure suas informações PIX para gerar QR Codes automáticos nos pagamentos.
          </p>

          <div className="space-y-4">
            <div>
              <Label htmlFor="tipo_chave">Tipo de Chave PIX *</Label>
              <Select
                value={configuracao.tipo_chave}
                onValueChange={(value) =>
                  setConfiguracao({ ...configuracao, tipo_chave: value })
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecione o tipo de chave" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="cpf">CPF</SelectItem>
                  <SelectItem value="cnpj">CNPJ</SelectItem>
                  <SelectItem value="email">Email</SelectItem>
                  <SelectItem value="telefone">Telefone</SelectItem>
                  <SelectItem value="aleatoria">Chave Aleatória</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label htmlFor="chave_pix">Chave PIX *</Label>
              <Input
                id="chave_pix"
                value={configuracao.chave_pix}
                onChange={(e) =>
                  setConfiguracao({ ...configuracao, chave_pix: e.target.value })
                }
                placeholder={
                  configuracao.tipo_chave === 'cpf'
                    ? '000.000.000-00'
                    : configuracao.tipo_chave === 'cnpj'
                    ? '00.000.000/0000-00'
                    : configuracao.tipo_chave === 'email'
                    ? 'seu@email.com'
                    : configuracao.tipo_chave === 'telefone'
                    ? '+5511999999999'
                    : 'Sua chave aleatória'
                }
              />
            </div>

            <div>
              <Label htmlFor="nome_recebedor">Nome do Recebedor *</Label>
              <Input
                id="nome_recebedor"
                value={configuracao.nome_recebedor}
                onChange={(e) =>
                  setConfiguracao({ ...configuracao, nome_recebedor: e.target.value })
                }
                placeholder="Nome completo ou razão social"
                maxLength={25}
              />
              <p className="text-xs text-muted-foreground mt-1">
                Máximo 25 caracteres
              </p>
            </div>

            <div>
              <Label htmlFor="cidade">Cidade *</Label>
              <Input
                id="cidade"
                value={configuracao.cidade}
                onChange={(e) =>
                  setConfiguracao({ ...configuracao, cidade: e.target.value })
                }
                placeholder="Sua cidade"
                maxLength={15}
              />
              <p className="text-xs text-muted-foreground mt-1">
                Máximo 15 caracteres
              </p>
            </div>

            <Button onClick={handleSave} disabled={saving} className="w-full">
              <Save className="h-4 w-4 mr-2" />
              {saving ? 'Salvando...' : 'Salvar Configurações'}
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Como funciona?</CardTitle>
        </CardHeader>
        <CardContent>
          <ul className="space-y-2 text-sm text-muted-foreground">
            <li>• Configure suas informações PIX uma única vez</li>
            <li>• QR Codes serão gerados automaticamente para cada pagamento</li>
            <li>• O valor será incluído automaticamente no QR Code</li>
            <li>• O cliente pode copiar o código ou escanear com o app do banco</li>
          </ul>
        </CardContent>
      </Card>
    </div>
  );
};

export default ConfiguracaoPixTab;
