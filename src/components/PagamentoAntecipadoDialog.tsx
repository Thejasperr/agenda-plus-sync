import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { DollarSign } from 'lucide-react';

interface PagamentoAntecipadoDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  agendamentoId: string;
  nomeCliente: string;
  precoTotal: number;
  temDesconto: boolean;
  porcentagemDesconto: number | null;
  porcentagemAtual?: number;
  onConfirm: () => void;
}

const PagamentoAntecipadoDialog: React.FC<PagamentoAntecipadoDialogProps> = ({
  open,
  onOpenChange,
  agendamentoId,
  nomeCliente,
  precoTotal,
  temDesconto,
  porcentagemDesconto,
  porcentagemAtual = 0,
  onConfirm,
}) => {
  const [porcentagem, setPorcentagem] = useState(porcentagemAtual);
  const [formaPagamento, setFormaPagamento] = useState('');
  const [formasPagamento, setFormasPagamento] = useState<{
    id: string;
    nome: string;
    ativa: boolean;
  }[]>([]);
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    if (open) {
      fetchFormasPagamento();
      setPorcentagem(porcentagemAtual);
      setFormaPagamento('');
    }
  }, [open, porcentagemAtual]);

  const fetchFormasPagamento = async () => {
    try {
      const { data, error } = await supabase
        .from('formas_pagamento')
        .select('*')
        .eq('ativa', true)
        .order('nome');
      
      if (error) throw error;
      setFormasPagamento(data || []);
    } catch (error) {
      console.error('Erro ao buscar formas de pagamento:', error);
    }
  };

  const calcularValorFinal = () => {
    let valorFinal = precoTotal;
    if (temDesconto && porcentagemDesconto) {
      valorFinal = valorFinal * (1 - porcentagemDesconto / 100);
    }
    return valorFinal;
  };

  const calcularValorAdiantamento = () => {
    const valorFinal = calcularValorFinal();
    return valorFinal * (porcentagem / 100);
  };

  const handleConfirm = async () => {
    if (!formaPagamento) {
      toast({
        title: "Erro",
        description: "Selecione uma forma de pagamento",
        variant: "destructive",
      });
      return;
    }

    if (porcentagem <= 0 || porcentagem > 100) {
      toast({
        title: "Erro",
        description: "A porcentagem deve ser entre 1 e 100",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);
    try {
      // Atualizar o agendamento com os dados de pagamento antecipado
      const { error: agendamentoError } = await supabase
        .from('agendamentos')
        .update({
          pagamento_antecipado: true,
          porcentagem_pagamento_antecipado: porcentagem,
        })
        .eq('id', agendamentoId);

      if (agendamentoError) throw agendamentoError;

      // Buscar informações do agendamento para a transação
      const { data: agendamento, error: fetchError } = await supabase
        .from('agendamentos')
        .select('data_agendamento, procedimento_id')
        .eq('id', agendamentoId)
        .single();

      if (fetchError) throw fetchError;

      // Buscar nome do procedimento se existir
      let nomeProcedimento = '';
      if (agendamento.procedimento_id) {
        const { data: servico } = await supabase
          .from('servicos')
          .select('nome_procedimento')
          .eq('id', agendamento.procedimento_id)
          .single();
        
        if (servico) {
          nomeProcedimento = servico.nome_procedimento;
        }
      }

      // Criar transação de adiantamento
      const valorAdiantamento = calcularValorAdiantamento();
      const { error: transacaoError } = await supabase
        .from('transacoes')
        .insert({
          tipo: 'Adiantamento',
          data_transacao: agendamento.data_agendamento,
          tipo_operacao: 'entrada',
          valor: valorAdiantamento,
          agendamento_id: agendamentoId,
          forma_pagamento: formaPagamento,
          observacoes: `Adiantamento de ${porcentagem}% - ${nomeCliente}${nomeProcedimento ? ` - ${nomeProcedimento}` : ''}`,
        });

      if (transacaoError) throw transacaoError;

      toast({
        title: "Sucesso",
        description: `Adiantamento de R$ ${valorAdiantamento.toFixed(2)} registrado com sucesso!`,
      });

      onConfirm();
      onOpenChange(false);
    } catch (error) {
      console.error('Erro ao registrar adiantamento:', error);
      toast({
        title: "Erro",
        description: "Não foi possível registrar o adiantamento",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Pagamento Antecipado</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="bg-muted/50 p-4 rounded-lg">
            <div className="text-sm text-muted-foreground mb-1">Cliente</div>
            <div className="font-semibold">{nomeCliente}</div>
          </div>

          <div className="bg-muted/50 p-4 rounded-lg">
            <div className="text-sm text-muted-foreground mb-1">Valor do Procedimento</div>
            <div className="font-semibold">R$ {precoTotal.toFixed(2)}</div>
            {temDesconto && porcentagemDesconto && (
              <div className="text-xs text-green-600 mt-1">
                Com desconto de {porcentagemDesconto}%: R$ {calcularValorFinal().toFixed(2)}
              </div>
            )}
          </div>

          <div>
            <Label htmlFor="porcentagem">Porcentagem do Adiantamento (%)</Label>
            <Input
              id="porcentagem"
              type="number"
              min="1"
              max="100"
              value={porcentagem}
              onChange={(e) => setPorcentagem(Number(e.target.value))}
              placeholder="Ex: 40"
            />
          </div>

          <div className="bg-primary/10 border border-primary/20 rounded-lg p-4">
            <div className="flex items-center gap-2 mb-2">
              <DollarSign className="w-5 h-5 text-primary" />
              <div className="text-sm font-semibold text-primary">Valor do Adiantamento</div>
            </div>
            <div className="text-2xl font-bold text-primary">
              R$ {calcularValorAdiantamento().toFixed(2)}
            </div>
            <div className="text-xs text-muted-foreground mt-1">
              Restante: R$ {(calcularValorFinal() - calcularValorAdiantamento()).toFixed(2)}
            </div>
          </div>

          <div>
            <Label htmlFor="forma-pagamento">Forma de Pagamento</Label>
            <Select value={formaPagamento} onValueChange={setFormaPagamento}>
              <SelectTrigger id="forma-pagamento">
                <SelectValue placeholder="Selecione a forma de pagamento" />
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

          <div className="flex gap-2">
            <Button
              variant="outline"
              onClick={() => onOpenChange(false)}
              className="flex-1"
              disabled={loading}
            >
              Cancelar
            </Button>
            <Button
              onClick={handleConfirm}
              className="flex-1"
              disabled={loading}
            >
              {loading ? 'Processando...' : 'Confirmar'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default PagamentoAntecipadoDialog;
