import React, { useState, useEffect } from 'react';
import { Plus, Search, Edit2, Trash2, Package, Check, X } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Switch } from '@/components/ui/switch';
import { useToast } from '@/hooks/use-toast';

interface Servico {
  id: string;
  nome_procedimento: string;
  valor: number;
  duracao_minutos: number | null;
  categoria: string;
}

interface Pacote {
  id: string;
  nome: string;
  descricao: string | null;
  valor_total: number;
  ativo: boolean;
  created_at: string;
  servicos?: Servico[];
}

const PacotesTab = () => {
  const [pacotes, setPacotes] = useState<Pacote[]>([]);
  const [servicos, setServicos] = useState<Servico[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingPacote, setEditingPacote] = useState<Pacote | null>(null);
  const { toast } = useToast();

  const [formData, setFormData] = useState({
    nome: '',
    descricao: '',
    valor_total: 0,
    servico_ids: [] as string[],
  });

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [{ data: pacotesData }, { data: servicosData }, { data: pacoteServicosData }] = await Promise.all([
        supabase.from('pacotes').select('*').order('nome'),
        supabase.from('servicos').select('*').order('nome_procedimento'),
        supabase.from('pacote_servicos').select('*'),
      ]);

      setServicos(servicosData || []);

      const pacotesComServicos = (pacotesData || []).map(pacote => {
        const servicoIds = (pacoteServicosData || [])
          .filter(ps => ps.pacote_id === pacote.id)
          .map(ps => ps.servico_id);
        const servicosDoPacote = (servicosData || []).filter(s => servicoIds.includes(s.id));
        return { ...pacote, servicos: servicosDoPacote };
      });

      setPacotes(pacotesComServicos);
    } catch (error) {
      console.error('Erro ao buscar dados:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.nome || formData.valor_total <= 0) {
      toast({ title: 'Erro', description: 'Preencha nome e valor do pacote.', variant: 'destructive' });
      return;
    }

    try {
      if (editingPacote) {
        const { error } = await supabase
          .from('pacotes')
          .update({ nome: formData.nome, descricao: formData.descricao || null, valor_total: formData.valor_total })
          .eq('id', editingPacote.id);
        if (error) throw error;

        // Remove existing servicos and re-add
        await supabase.from('pacote_servicos').delete().eq('pacote_id', editingPacote.id);
        if (formData.servico_ids.length > 0) {
          const { error: insertError } = await supabase.from('pacote_servicos').insert(
            formData.servico_ids.map(sid => ({ pacote_id: editingPacote.id, servico_id: sid }))
          );
          if (insertError) throw insertError;
        }

        toast({ title: 'Sucesso', description: 'Pacote atualizado!' });
      } else {
        const { data: newPacote, error } = await supabase
          .from('pacotes')
          .insert({ nome: formData.nome, descricao: formData.descricao || null, valor_total: formData.valor_total })
          .select()
          .single();
        if (error) throw error;

        if (formData.servico_ids.length > 0 && newPacote) {
          const { error: insertError } = await supabase.from('pacote_servicos').insert(
            formData.servico_ids.map(sid => ({ pacote_id: newPacote.id, servico_id: sid }))
          );
          if (insertError) throw insertError;
        }

        toast({ title: 'Sucesso', description: 'Pacote criado!' });
      }

      resetForm();
      fetchData();
    } catch (error: any) {
      toast({ title: 'Erro', description: error.message, variant: 'destructive' });
    }
  };

  const handleToggleAtivo = async (pacote: Pacote) => {
    try {
      const { error } = await supabase
        .from('pacotes')
        .update({ ativo: !pacote.ativo })
        .eq('id', pacote.id);
      if (error) throw error;
      toast({ title: 'Sucesso', description: pacote.ativo ? 'Pacote desativado.' : 'Pacote ativado.' });
      fetchData();
    } catch (error: any) {
      toast({ title: 'Erro', description: error.message, variant: 'destructive' });
    }
  };

  const handleDelete = async (id: string) => {
    try {
      const { error } = await supabase.from('pacotes').delete().eq('id', id);
      if (error) throw error;
      toast({ title: 'Sucesso', description: 'Pacote excluído.' });
      fetchData();
    } catch (error: any) {
      toast({ title: 'Erro', description: error.message, variant: 'destructive' });
    }
  };

  const handleEdit = (pacote: Pacote) => {
    setEditingPacote(pacote);
    setFormData({
      nome: pacote.nome,
      descricao: pacote.descricao || '',
      valor_total: pacote.valor_total,
      servico_ids: pacote.servicos?.map(s => s.id) || [],
    });
    setDialogOpen(true);
  };

  const resetForm = () => {
    setFormData({ nome: '', descricao: '', valor_total: 0, servico_ids: [] });
    setEditingPacote(null);
    setDialogOpen(false);
  };

  const toggleServico = (servicoId: string) => {
    setFormData(prev => {
      const ids = prev.servico_ids.includes(servicoId)
        ? prev.servico_ids.filter(id => id !== servicoId)
        : [...prev.servico_ids, servicoId];
      
      // Auto-calculate total from selected services
      const total = ids.reduce((sum, id) => {
        const s = servicos.find(sv => sv.id === id);
        return sum + (s?.valor || 0);
      }, 0);
      
      return { ...prev, servico_ids: ids, valor_total: total };
    });
  };

  const filteredPacotes = pacotes.filter(p =>
    p.nome.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const servicosAdulto = servicos.filter(s => s.categoria === 'adulto');
  const servicosInfantil = servicos.filter(s => s.categoria === 'infantil');

  if (loading) {
    return <div className="flex items-center justify-center h-64"><div className="text-muted-foreground">Carregando pacotes...</div></div>;
  }

  return (
    <div className="space-y-4">
      <div className="flex gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Buscar pacotes..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="pl-10" />
        </div>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button className="mobile-button shrink-0" onClick={() => { resetForm(); setDialogOpen(true); }}>
              <Plus className="h-4 w-4 mr-1" /> Novo
            </Button>
          </DialogTrigger>
          <DialogContent className="w-[90%] max-w-lg mx-auto max-h-[85vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>{editingPacote ? 'Editar Pacote' : 'Novo Pacote'}</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <Label htmlFor="nome">Nome do Pacote *</Label>
                <Input id="nome" value={formData.nome} onChange={(e) => setFormData({ ...formData, nome: e.target.value })} placeholder="Ex: Pacote Completo, Dia da Noiva..." />
              </div>
              <div>
                <Label htmlFor="descricao">Descrição</Label>
                <Textarea id="descricao" value={formData.descricao} onChange={(e) => setFormData({ ...formData, descricao: e.target.value })} placeholder="Descrição do pacote..." rows={2} />
              </div>

              {/* Serviços para selecionar */}
              <div>
                <Label className="mb-2 block">Serviços inclusos</Label>
                
                {servicosAdulto.length > 0 && (
                  <div className="mb-3">
                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Adulto</p>
                    <div className="space-y-2">
                      {servicosAdulto.map(s => (
                        <label key={s.id} className="flex items-center gap-3 p-2 rounded-lg border border-border/50 hover:bg-muted/30 cursor-pointer transition-colors">
                          <Checkbox checked={formData.servico_ids.includes(s.id)} onCheckedChange={() => toggleServico(s.id)} />
                          <div className="flex-1">
                            <span className="text-sm font-medium">{s.nome_procedimento}</span>
                            {s.duracao_minutos && <span className="text-xs text-muted-foreground ml-2">({s.duracao_minutos}min)</span>}
                          </div>
                          <span className="text-sm font-semibold text-success">R$ {s.valor.toFixed(2)}</span>
                        </label>
                      ))}
                    </div>
                  </div>
                )}

                {servicosInfantil.length > 0 && (
                  <div>
                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">👶 Infantil</p>
                    <div className="space-y-2">
                      {servicosInfantil.map(s => (
                        <label key={s.id} className="flex items-center gap-3 p-2 rounded-lg border border-border/50 hover:bg-muted/30 cursor-pointer transition-colors">
                          <Checkbox checked={formData.servico_ids.includes(s.id)} onCheckedChange={() => toggleServico(s.id)} />
                          <div className="flex-1">
                            <span className="text-sm font-medium">{s.nome_procedimento}</span>
                            {s.duracao_minutos && <span className="text-xs text-muted-foreground ml-2">({s.duracao_minutos}min)</span>}
                          </div>
                          <span className="text-sm font-semibold text-success">R$ {s.valor.toFixed(2)}</span>
                        </label>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              <div>
                <Label htmlFor="valor_total">Valor do Pacote (R$) *</Label>
                <Input id="valor_total" type="number" step="0.01" min="0" value={formData.valor_total} onChange={(e) => setFormData({ ...formData, valor_total: parseFloat(e.target.value) || 0 })} />
                {formData.servico_ids.length > 0 && (
                  <p className="text-xs text-muted-foreground mt-1">
                    Soma dos serviços: R$ {formData.servico_ids.reduce((sum, id) => {
                      const s = servicos.find(sv => sv.id === id);
                      return sum + (s?.valor || 0);
                    }, 0).toFixed(2)} — ajuste para dar desconto
                  </p>
                )}
              </div>

              <div className="flex gap-2 pt-2">
                <Button type="button" variant="outline" onClick={resetForm} className="flex-1">Cancelar</Button>
                <Button type="submit" className="mobile-button flex-1">{editingPacote ? 'Atualizar' : 'Salvar'}</Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {filteredPacotes.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">
          <Package className="h-12 w-12 mx-auto mb-3 opacity-30" />
          <p>{searchTerm ? 'Nenhum pacote encontrado' : 'Nenhum pacote cadastrado'}</p>
          <p className="text-xs mt-1">Crie pacotes combinando serviços com preço especial</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filteredPacotes.map(pacote => (
            <Card key={pacote.id} className={`mobile-card transition-all ${!pacote.ativo ? 'opacity-60' : ''}`}>
              <CardContent className="p-4">
                <div className="flex items-start justify-between mb-3">
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <Package className="h-4 w-4 text-primary" />
                      <h3 className="font-semibold">{pacote.nome}</h3>
                      {!pacote.ativo && <Badge variant="outline" className="text-xs">Inativo</Badge>}
                    </div>
                    {pacote.descricao && <p className="text-sm text-muted-foreground mt-1">{pacote.descricao}</p>}
                  </div>
                  <div className="text-right">
                    <div className="text-lg font-bold text-primary">R$ {pacote.valor_total.toFixed(2)}</div>
                  </div>
                </div>

                {/* Serviços do pacote */}
                {pacote.servicos && pacote.servicos.length > 0 && (
                  <div className="mb-3">
                    <p className="text-xs font-medium text-muted-foreground mb-1">Serviços inclusos:</p>
                    <div className="flex flex-wrap gap-1">
                      {pacote.servicos.map(s => (
                        <Badge key={s.id} variant="secondary" className="text-xs">
                          {s.nome_procedimento}
                          {s.categoria === 'infantil' && ' 👶'}
                        </Badge>
                      ))}
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">
                      Valor individual: R$ {pacote.servicos.reduce((sum, s) => sum + s.valor, 0).toFixed(2)}
                      {pacote.servicos.reduce((sum, s) => sum + s.valor, 0) > pacote.valor_total && (
                        <span className="text-success ml-1">
                          (economia de R$ {(pacote.servicos.reduce((sum, s) => sum + s.valor, 0) - pacote.valor_total).toFixed(2)})
                        </span>
                      )}
                    </p>
                  </div>
                )}

                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Switch checked={pacote.ativo} onCheckedChange={() => handleToggleAtivo(pacote)} />
                    <span className="text-xs text-muted-foreground">{pacote.ativo ? 'Ativo' : 'Inativo'}</span>
                  </div>
                  <div className="flex gap-1">
                    <Button variant="ghost" size="sm" onClick={() => handleEdit(pacote)} className="h-8 w-8 p-0">
                      <Edit2 className="h-4 w-4" />
                    </Button>
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button variant="ghost" size="sm" className="h-8 w-8 p-0 text-destructive hover:text-destructive">
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Excluir Pacote</AlertDialogTitle>
                          <AlertDialogDescription>Tem certeza que deseja excluir o pacote "{pacote.nome}"?</AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancelar</AlertDialogCancel>
                          <AlertDialogAction onClick={() => handleDelete(pacote.id)} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">Excluir</AlertDialogAction>
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

      {filteredPacotes.length > 0 && (
        <Card className="mobile-card bg-muted/50">
          <CardContent className="p-4">
            <div className="flex justify-between items-center">
              <span className="text-sm font-medium text-muted-foreground">Total de Pacotes</span>
              <span className="font-semibold">{filteredPacotes.length}</span>
            </div>
            <div className="flex justify-between items-center mt-1">
              <span className="text-sm font-medium text-muted-foreground">Ativos</span>
              <span className="font-semibold text-success">{filteredPacotes.filter(p => p.ativo).length}</span>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default PacotesTab;
