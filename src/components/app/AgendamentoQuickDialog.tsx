import React, { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { format } from 'date-fns';

interface Servico {
  id: string;
  nome_procedimento: string;
  valor: number;
}

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  nome: string;
  telefone: string;
}

const AgendamentoQuickDialog = ({ open, onOpenChange, nome, telefone }: Props) => {
  const [servicos, setServicos] = useState<Servico[]>([]);
  const [procedimentoId, setProcedimentoId] = useState<string>('');
  const [data, setData] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [hora, setHora] = useState('09:00');
  const [preco, setPreco] = useState(0);
  const [observacoes, setObservacoes] = useState('');
  const [saving, setSaving] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    if (!open) return;
    supabase.from('servicos').select('id, nome_procedimento, valor').then(({ data }) => {
      if (data) setServicos(data as Servico[]);
    });
  }, [open]);

  useEffect(() => {
    const s = servicos.find((s) => s.id === procedimentoId);
    if (s) setPreco(Number(s.valor));
  }, [procedimentoId, servicos]);

  const handleSave = async () => {
    if (!procedimentoId || !data || !hora) {
      toast({ title: 'Preencha todos os campos', variant: 'destructive' });
      return;
    }
    setSaving(true);
    const { error } = await supabase.from('agendamentos').insert({
      nome,
      telefone,
      procedimento_id: procedimentoId,
      data_agendamento: data,
      hora_agendamento: hora,
      preco,
      status: 'A fazer',
      observacoes: observacoes || null,
    });
    setSaving(false);
    if (error) {
      toast({ title: 'Erro ao agendar', description: error.message, variant: 'destructive' });
    } else {
      toast({ title: 'Agendamento criado!', description: `${nome} - ${data} ${hora}` });
      onOpenChange(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Novo agendamento</DialogTitle>
        </DialogHeader>
        <div className="space-y-3 py-2">
          <div>
            <Label>Cliente</Label>
            <Input value={`${nome} • ${telefone}`} disabled />
          </div>
          <div>
            <Label>Serviço</Label>
            <Select value={procedimentoId} onValueChange={setProcedimentoId}>
              <SelectTrigger><SelectValue placeholder="Selecione o serviço" /></SelectTrigger>
              <SelectContent>
                {servicos.map((s) => (
                  <SelectItem key={s.id} value={s.id}>
                    {s.nome_procedimento} — R$ {Number(s.valor).toFixed(2)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <Label>Data</Label>
              <Input type="date" value={data} onChange={(e) => setData(e.target.value)} />
            </div>
            <div>
              <Label>Hora</Label>
              <Input type="time" value={hora} onChange={(e) => setHora(e.target.value)} />
            </div>
          </div>
          <div>
            <Label>Valor (R$)</Label>
            <Input type="number" step="0.01" value={preco} onChange={(e) => setPreco(Number(e.target.value))} />
          </div>
          <div>
            <Label>Observações</Label>
            <Textarea value={observacoes} onChange={(e) => setObservacoes(e.target.value)} placeholder="Opcional" />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={handleSave} disabled={saving}>{saving ? 'Salvando...' : 'Agendar'}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default AgendamentoQuickDialog;
