import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent } from '@/components/ui/card';
import { QrCode, Copy } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { generatePixPayload } from '@/lib/pixQrCode';

interface FormaPagamento {
  id: string;
  nome: string;
  ativa: boolean;
  qr_code_pix: string | null;
}

interface FormaPagamentoDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: (formaPagamento: string) => void;
  agendamentoId: string;
  valorServico: number;
  clienteTelefone: string;
}

const FormaPagamentoDialog: React.FC<FormaPagamentoDialogProps> = ({
  open,
  onOpenChange,
  onConfirm,
  agendamentoId,
  valorServico,
  clienteTelefone
}) => {
  const [formasPagamento, setFormasPagamento] = useState<FormaPagamento[]>([]);
  const [formaSelecionada, setFormaSelecionada] = useState('');
  const [valorPago, setValorPago] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [pixPayload, setPixPayload] = useState<string>('');
  const { toast } = useToast();

  useEffect(() => {
    if (open) {
      fetchFormasPagamento();
      setValorPago(valorServico.toFixed(2));
      generatePixQrCode();
    }
  }, [open, valorServico]);

  const generatePixQrCode = async () => {
    try {
      const { data: configPix } = await supabase
        .from('configuracoes_pix')
        .select('*')
        .maybeSingle();

      if (configPix) {
        const payload = generatePixPayload(
          configPix.chave_pix,
          configPix.nome_recebedor,
          configPix.cidade,
          valorServico,
          agendamentoId.substring(0, 25)
        );
        setPixPayload(payload);
      }
    } catch (error) {
      console.error('Erro ao gerar QR Code PIX:', error);
    }
  };

  const fetchFormasPagamento = async () => {
    try {
      const { data, error } = await supabase
        .from('formas_pagamento')
        .select('*')
        .eq('ativa', true)
        .order('nome');

      if (error) throw error;
      setFormasPagamento((data as FormaPagamento[]) || []);
    } catch (error) {
      console.error('Erro ao buscar formas de pagamento:', error);
      toast({
        title: "Erro",
        description: "Não foi possível carregar as formas de pagamento",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleConfirm = async () => {
    if (!formaSelecionada) {
      toast({
        title: "Erro",
        description: "Selecione uma forma de pagamento",
        variant: "destructive",
      });
      return;
    }

    const valorPagoNum = parseFloat(valorPago);
    if (isNaN(valorPagoNum) || valorPagoNum < 0) {
      toast({
        title: "Erro",
        description: "Valor pago inválido",
        variant: "destructive",
      });
      return;
    }

    try {
      // Calcular o excedente
      const excedente = valorPagoNum - valorServico;

      // Se houver excedente, adicionar ao saldo do cliente
      if (excedente > 0) {
        const { data: clienteData, error: clienteError } = await supabase
          .from('clientes')
          .select('saldo_credito')
          .eq('telefone', clienteTelefone)
          .single();

        if (clienteError) throw clienteError;

        const novoSaldo = (clienteData.saldo_credito || 0) + excedente;

        const { error: updateError } = await supabase
          .from('clientes')
          .update({ saldo_credito: novoSaldo })
          .eq('telefone', clienteTelefone);

        if (updateError) throw updateError;

        toast({
          title: "Crédito adicionado",
          description: `R$ ${excedente.toFixed(2)} foi adicionado ao saldo do cliente`,
        });
      }

      // Atualizar agendamento com status concluído e forma de pagamento
      // O trigger do banco criará automaticamente a transação
      const { error } = await supabase
        .from('agendamentos')
        .update({ 
          status: 'Concluído',
          forma_pagamento: formaSelecionada 
        })
        .eq('id', agendamentoId);

      if (error) throw error;

      onConfirm(formaSelecionada);
      setFormaSelecionada('');
      setValorPago('');
    } catch (error) {
      console.error('Erro ao salvar forma de pagamento:', error);
      toast({
        title: "Erro",
        description: "Não foi possível salvar a forma de pagamento",
        variant: "destructive",
      });
    }
  };

  const formaSelecionadaObj = formasPagamento.find(f => f.nome === formaSelecionada);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[90%] max-w-md mx-auto">
        <DialogHeader>
          <DialogTitle>Forma de Pagamento</DialogTitle>
        </DialogHeader>
        
        <div className="space-y-4">
          <div>
            <Label>Valor do serviço</Label>
            <div className="text-2xl font-bold text-primary">
              R$ {valorServico.toFixed(2)}
            </div>
          </div>

          <div>
            <Label htmlFor="valor_pago">Valor pago pelo cliente *</Label>
            <Input
              id="valor_pago"
              type="number"
              step="0.01"
              min="0"
              value={valorPago}
              onChange={(e) => setValorPago(e.target.value)}
              placeholder="0.00"
            />
            {parseFloat(valorPago) > valorServico && (
              <p className="text-sm text-green-600 mt-1">
                Crédito de R$ {(parseFloat(valorPago) - valorServico).toFixed(2)} será adicionado ao cliente
              </p>
            )}
          </div>

          <div>
            <Label htmlFor="forma_pagamento">Selecione a forma de pagamento *</Label>
            <Select value={formaSelecionada} onValueChange={setFormaSelecionada}>
              <SelectTrigger>
                <SelectValue placeholder="Escolha uma forma de pagamento" />
              </SelectTrigger>
              <SelectContent>
                {formasPagamento.map((forma) => (
                  <SelectItem key={forma.id} value={forma.nome}>
                    {forma.nome}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Mostrar QR Code PIX dinâmico se PIX for selecionado */}
          {formaSelecionada?.toLowerCase().includes('pix') && pixPayload && (
            <Card>
              <CardContent className="p-4">
                <div className="text-center space-y-3">
                  <QrCode className="h-8 w-8 mx-auto text-primary" />
                  <div className="text-sm font-medium">PIX Copia e Cola</div>
                  <div className="bg-muted p-3 rounded-lg text-xs font-mono break-all max-h-32 overflow-y-auto">
                    {pixPayload}
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      navigator.clipboard.writeText(pixPayload);
                      toast({
                        title: "Copiado!",
                        description: "Código PIX copiado para a área de transferência",
                      });
                    }}
                    className="w-full"
                  >
                    <Copy className="h-4 w-4 mr-2" />
                    Copiar Código PIX
                  </Button>
                  <div className="text-xs text-muted-foreground">
                    O cliente pode colar este código no aplicativo do banco para pagar R$ {valorServico.toFixed(2)}
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Mostrar QR Code estático (legado) se disponível */}
          {formaSelecionadaObj?.qr_code_pix && !pixPayload && (
            <Card>
              <CardContent className="p-4">
                <div className="text-center space-y-2">
                  <QrCode className="h-8 w-8 mx-auto text-primary" />
                  <div className="text-sm font-medium">QR Code PIX</div>
                  <div className="bg-muted p-3 rounded text-xs font-mono break-all">
                    {formaSelecionadaObj.qr_code_pix}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    Copie o código acima ou escaneie o QR Code
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          <div className="flex gap-2 pt-2">
            <Button 
              type="button" 
              variant="outline" 
              onClick={() => {
                setFormaSelecionada('');
                onOpenChange(false);
              }} 
              className="flex-1"
            >
              Cancelar
            </Button>
            <Button 
              onClick={handleConfirm} 
              className="flex-1"
              disabled={!formaSelecionada}
            >
              Confirmar
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default FormaPagamentoDialog;