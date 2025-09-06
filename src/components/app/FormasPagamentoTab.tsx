import React, { useState, useEffect } from 'react';
import { Plus, Edit2, Trash2, QrCode, CreditCard } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { useToast } from '@/hooks/use-toast';

interface FormaPagamento {
  id: string;
  nome: string;
  ativa: boolean;
  qr_code_pix: string | null;
  percentual_acrescimo: number | null;
  created_at: string;
}

const FormasPagamentoTab = () => {
  const [formasPagamento, setFormasPagamento] = useState<FormaPagamento[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingForma, setEditingForma] = useState<FormaPagamento | null>(null);
  const [formData, setFormData] = useState({
    nome: '',
    ativa: true,
    qr_code_pix: '',
    percentual_acrescimo: ''
  });
  const { toast } = useToast();

  useEffect(() => {
    fetchFormasPagamento();
  }, []);

  const fetchFormasPagamento = async () => {
    try {
      const { data, error } = await supabase
        .from('formas_pagamento')
        .select('*')
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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.nome.trim()) {
      toast({
        title: "Erro",
        description: "Nome da forma de pagamento é obrigatório",
        variant: "destructive",
      });
      return;
    }

    try {
      const dadosFormaPagamento = {
        ...formData,
        qr_code_pix: formData.qr_code_pix.trim() || null,
        percentual_acrescimo: formData.percentual_acrescimo ? parseFloat(formData.percentual_acrescimo) : null
      };

      if (editingForma) {
        const { error } = await supabase
          .from('formas_pagamento')
          .update(dadosFormaPagamento)
          .eq('id', editingForma.id);

        if (error) throw error;

        toast({
          title: "Sucesso",
          description: "Forma de pagamento atualizada com sucesso!",
        });
      } else {
        const { error } = await supabase
          .from('formas_pagamento')
          .insert([dadosFormaPagamento]);

        if (error) throw error;

        toast({
          title: "Sucesso",
          description: "Forma de pagamento adicionada com sucesso!",
        });
      }

      resetForm();
      fetchFormasPagamento();
    } catch (error) {
      console.error('Erro ao salvar forma de pagamento:', error);
      toast({
        title: "Erro",
        description: "Não foi possível salvar a forma de pagamento",
        variant: "destructive",
      });
    }
  };

  const handleEdit = (forma: FormaPagamento) => {
    setFormData({
      nome: forma.nome,
      ativa: forma.ativa,
      qr_code_pix: forma.qr_code_pix || '',
      percentual_acrescimo: forma.percentual_acrescimo?.toString() || ''
    });
    setEditingForma(forma);
    setDialogOpen(true);
  };

  const handleDelete = async (id: string) => {
    try {
      const { error } = await supabase
        .from('formas_pagamento')
        .delete()
        .eq('id', id);

      if (error) throw error;

      toast({
        title: "Sucesso",
        description: "Forma de pagamento excluída com sucesso!",
      });

      fetchFormasPagamento();
    } catch (error) {
      console.error('Erro ao excluir forma de pagamento:', error);
      toast({
        title: "Erro",
        description: "Não foi possível excluir a forma de pagamento",
        variant: "destructive",
      });
    }
  };

  const toggleStatus = async (id: string, novaAtivacao: boolean) => {
    try {
      const { error } = await supabase
        .from('formas_pagamento')
        .update({ ativa: novaAtivacao })
        .eq('id', id);

      if (error) throw error;

      toast({
        title: "Sucesso",
        description: `Forma de pagamento ${novaAtivacao ? 'ativada' : 'desativada'} com sucesso!`,
      });

      fetchFormasPagamento();
    } catch (error) {
      console.error('Erro ao alterar status:', error);
      toast({
        title: "Erro",
        description: "Não foi possível alterar o status",
        variant: "destructive",
      });
    }
  };

  const resetForm = () => {
    setFormData({
      nome: '',
      ativa: true,
      qr_code_pix: '',
      percentual_acrescimo: ''
    });
    setEditingForma(null);
    setDialogOpen(false);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-muted-foreground">Carregando formas de pagamento...</div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold">Formas de Pagamento</h3>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button onClick={() => {
              resetForm();
              setDialogOpen(true);
            }}>
              <Plus className="h-4 w-4 mr-2" />
              Nova Forma
            </Button>
          </DialogTrigger>
          <DialogContent className="w-[90%] max-w-md mx-auto">
            <DialogHeader>
              <DialogTitle>
                {editingForma ? 'Editar Forma de Pagamento' : 'Nova Forma de Pagamento'}
              </DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <Label htmlFor="nome">Nome *</Label>
                <Input
                  id="nome"
                  value={formData.nome}
                  onChange={(e) => setFormData({ ...formData, nome: e.target.value })}
                  placeholder="Ex: PIX, Dinheiro, Cartão..."
                />
              </div>
              
              <div className="flex items-center justify-between">
                <Label htmlFor="ativa">Ativa</Label>
                <Switch
                  id="ativa"
                  checked={formData.ativa}
                  onCheckedChange={(checked) => setFormData({ ...formData, ativa: checked })}
                />
              </div>

              {formData.nome.toLowerCase().includes('pix') && (
                <div>
                  <Label htmlFor="qr_code_pix">QR Code PIX (opcional)</Label>
                  <Textarea
                    id="qr_code_pix"
                    value={formData.qr_code_pix}
                    onChange={(e) => setFormData({ ...formData, qr_code_pix: e.target.value })}
                    placeholder="Cole aqui o código do QR Code PIX..."
                    className="min-h-[100px]"
                  />
                </div>
              )}

              {formData.nome.toLowerCase().includes('cartão') && (
                <div>
                  <Label htmlFor="percentual_acrescimo">Percentual de Acréscimo (%)</Label>
                  <Input
                    id="percentual_acrescimo"
                    type="number"
                    min="0"
                    max="100"
                    step="0.01"
                    value={formData.percentual_acrescimo}
                    onChange={(e) => setFormData({ ...formData, percentual_acrescimo: e.target.value })}
                    placeholder="Ex: 3.5 para 3,5%"
                  />
                </div>
              )}

              <div className="flex gap-2 pt-2">
                <Button type="button" variant="outline" onClick={resetForm} className="flex-1">
                  Cancelar
                </Button>
                <Button type="submit" className="flex-1">
                  {editingForma ? 'Atualizar' : 'Salvar'}
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {/* Lista de formas de pagamento */}
      {formasPagamento.length === 0 ? (
        <div className="text-center py-8 text-muted-foreground">
          Nenhuma forma de pagamento cadastrada
        </div>
      ) : (
        <div className="space-y-3">
          {formasPagamento.map((forma) => (
            <Card key={forma.id}>
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-primary/10">
                      {forma.nome.toLowerCase().includes('pix') ? (
                        <QrCode className="h-5 w-5 text-primary" />
                      ) : (
                        <CreditCard className="h-5 w-5 text-primary" />
                      )}
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="font-medium">{forma.nome}</h3>
                        <Badge variant={forma.ativa ? "default" : "secondary"}>
                          {forma.ativa ? "Ativa" : "Inativa"}
                        </Badge>
                      </div>
                      {forma.qr_code_pix && (
                        <div className="text-xs text-muted-foreground mt-1">
                          QR Code configurado
                        </div>
                      )}
                      {forma.percentual_acrescimo && forma.percentual_acrescimo > 0 && (
                        <div className="text-xs text-orange-600 mt-1">
                          Acréscimo: {forma.percentual_acrescimo}%
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <Switch
                      checked={forma.ativa}
                      onCheckedChange={(checked) => toggleStatus(forma.id, checked)}
                    />
                    
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleEdit(forma)}
                    >
                      <Edit2 className="h-4 w-4" />
                    </Button>
                    
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button size="sm" variant="outline" className="text-red-600 border-red-600">
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Excluir Forma de Pagamento</AlertDialogTitle>
                          <AlertDialogDescription>
                            Tem certeza que deseja excluir "{forma.nome}"? Esta ação não pode ser desfeita.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancelar</AlertDialogCancel>
                          <AlertDialogAction 
                            onClick={() => handleDelete(forma.id)}
                            className="bg-red-600 hover:bg-red-700"
                          >
                            Excluir
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
};

export default FormasPagamentoTab;