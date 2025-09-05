import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent } from '@/components/ui/card';
import { QrCode } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

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
}

const FormaPagamentoDialog: React.FC<FormaPagamentoDialogProps> = ({
  open,
  onOpenChange,
  onConfirm,
  agendamentoId
}) => {
  const [formasPagamento, setFormasPagamento] = useState<FormaPagamento[]>([]);
  const [formaSelecionada, setFormaSelecionada] = useState('');
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  useEffect(() => {
    if (open) {
      fetchFormasPagamento();
    }
  }, [open]);

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

    try {
      // Atualizar agendamento com a forma de pagamento
      const { error } = await supabase
        .from('agendamentos')
        .update({ forma_pagamento: formaSelecionada })
        .eq('id', agendamentoId);

      if (error) throw error;

      onConfirm(formaSelecionada);
      setFormaSelecionada('');
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

          {/* Mostrar QR Code PIX se disponível */}
          {formaSelecionadaObj?.qr_code_pix && (
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