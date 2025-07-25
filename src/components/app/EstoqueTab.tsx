import React, { useState, useEffect } from 'react';
import { Plus, Search, Package, Edit2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';

interface ItemEstoque {
  id: string;
  nome_item: string;
  quantidade: number;
  categoria?: string;
  observacoes?: string;
  created_at: string;
}

const EstoqueTab = () => {
  const [itens, setItens] = useState<ItemEstoque[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<ItemEstoque | null>(null);
  const { toast } = useToast();

  const [formData, setFormData] = useState({
    nome_item: '',
    quantidade: 0,
    categoria: '',
    observacoes: ''
  });

  useEffect(() => {
    fetchItens();
  }, []);

  const fetchItens = async () => {
    try {
      const { data, error } = await supabase
        .from('estoque')
        .select('*')
        .order('nome_item');

      if (error) throw error;
      setItens(data || []);
    } catch (error) {
      console.error('Erro ao buscar itens:', error);
      toast({
        title: "Erro",
        description: "Não foi possível carregar o estoque",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.nome_item) {
      toast({
        title: "Erro",
        description: "Nome do item é obrigatório",
        variant: "destructive",
      });
      return;
    }

    try {
      if (editingItem) {
        const { error } = await supabase
          .from('estoque')
          .update(formData)
          .eq('id', editingItem.id);

        if (error) throw error;

        toast({
          title: "Sucesso",
          description: "Item atualizado com sucesso!",
        });
      } else {
        const { error } = await supabase
          .from('estoque')
          .insert([formData]);

        if (error) throw error;

        toast({
          title: "Sucesso",
          description: "Item adicionado com sucesso!",
        });
      }

      resetForm();
      fetchItens();
    } catch (error) {
      console.error('Erro ao salvar item:', error);
      toast({
        title: "Erro",
        description: "Não foi possível salvar o item",
        variant: "destructive",
      });
    }
  };

  const resetForm = () => {
    setFormData({
      nome_item: '',
      quantidade: 0,
      categoria: '',
      observacoes: ''
    });
    setEditingItem(null);
    setDialogOpen(false);
  };

  const handleEdit = (item: ItemEstoque) => {
    setFormData({
      nome_item: item.nome_item,
      quantidade: item.quantidade,
      categoria: item.categoria || '',
      observacoes: item.observacoes || ''
    });
    setEditingItem(item);
    setDialogOpen(true);
  };

  const getQuantidadeColor = (quantidade: number) => {
    if (quantidade === 0) return 'bg-destructive text-destructive-foreground';
    if (quantidade <= 5) return 'bg-warning text-warning-foreground';
    return 'bg-success text-success-foreground';
  };

  const filteredItens = itens.filter(item =>
    item.nome_item.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (item.categoria && item.categoria.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  const groupedItens = filteredItens.reduce((groups, item) => {
    const categoria = item.categoria || 'Sem Categoria';
    if (!groups[categoria]) {
      groups[categoria] = [];
    }
    groups[categoria].push(item);
    return groups;
  }, {} as Record<string, ItemEstoque[]>);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-muted-foreground">Carregando estoque...</div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar itens..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10"
          />
        </div>
        
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button 
              className="mobile-button shrink-0"
              onClick={() => {
                resetForm();
                setDialogOpen(true);
              }}
            >
              <Plus className="h-4 w-4 mr-1" />
              Novo
            </Button>
          </DialogTrigger>
          <DialogContent className="w-[90%] max-w-md mx-auto">
            <DialogHeader>
              <DialogTitle>
                {editingItem ? 'Editar Item' : 'Novo Item do Estoque'}
              </DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <Label htmlFor="nome_item">Nome do Item *</Label>
                <Input
                  id="nome_item"
                  value={formData.nome_item}
                  onChange={(e) => setFormData({ ...formData, nome_item: e.target.value })}
                  placeholder="Nome do item"
                />
              </div>
              
              <div>
                <Label htmlFor="quantidade">Quantidade *</Label>
                <Input
                  id="quantidade"
                  type="number"
                  min="0"
                  value={formData.quantidade}
                  onChange={(e) => setFormData({ ...formData, quantidade: parseInt(e.target.value) || 0 })}
                />
              </div>

              <div>
                <Label htmlFor="categoria">Categoria (opcional)</Label>
                <Input
                  id="categoria"
                  value={formData.categoria}
                  onChange={(e) => setFormData({ ...formData, categoria: e.target.value })}
                  placeholder="Ex: Produtos, Ferramentas, etc."
                />
              </div>

              <div>
                <Label htmlFor="observacoes">Observações (opcional)</Label>
                <Textarea
                  id="observacoes"
                  value={formData.observacoes}
                  onChange={(e) => setFormData({ ...formData, observacoes: e.target.value })}
                  placeholder="Observações sobre o item"
                  rows={3}
                />
              </div>

              <div className="flex gap-2 pt-2">
                <Button type="button" variant="outline" onClick={resetForm} className="flex-1">
                  Cancelar
                </Button>
                <Button type="submit" className="mobile-button flex-1">
                  {editingItem ? 'Atualizar' : 'Salvar'}
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {/* Lista de itens por categoria */}
      {Object.keys(groupedItens).length === 0 ? (
        <div className="text-center py-8 text-muted-foreground">
          {searchTerm ? 'Nenhum item encontrado' : 'Nenhum item no estoque'}
        </div>
      ) : (
        <div className="space-y-4">
          {Object.entries(groupedItens).map(([categoria, itensCategoria]) => (
            <div key={categoria}>
              <h3 className="font-semibold text-foreground mb-2 text-sm uppercase tracking-wide">
                {categoria}
              </h3>
              <div className="space-y-2">
                {itensCategoria.map((item) => (
                  <Card key={item.id} className="mobile-card">
                    <CardContent className="p-4">
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <Package className="h-4 w-4 text-muted-foreground" />
                            <span className="font-semibold">{item.nome_item}</span>
                          </div>
                          
                          <div className="flex items-center gap-2 mb-2">
                            <Badge className={getQuantidadeColor(item.quantidade)}>
                              {item.quantidade} unidades
                            </Badge>
                          </div>

                          {item.observacoes && (
                            <div className="text-sm text-muted-foreground">
                              {item.observacoes}
                            </div>
                          )}
                        </div>
                        
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleEdit(item)}
                          className="h-8 w-8 p-0"
                        >
                          <Edit2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default EstoqueTab;