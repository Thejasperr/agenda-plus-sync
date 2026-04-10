import React, { useState, useEffect } from 'react';
import { Plus, Search, DollarSign, Edit2, Trash2, AlertCircle, Download, Baby, User } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { sanitizeInput, getSecureErrorMessage, servicoSchema } from '@/lib/security';

interface Servico {
  id: string;
  nome_procedimento: string;
  valor: number;
  duracao_minutos?: number;
  categoria: string;
  created_at: string;
}

const ServicosTab = () => {
  const [servicos, setServicos] = useState<Servico[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [categoriaFilter, setCategoriaFilter] = useState<string>('todos');
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingServico, setEditingServico] = useState<Servico | null>(null);
  const [formErrors, setFormErrors] = useState({ nome_procedimento: '', valor: '' });
  const { toast } = useToast();

  const [formData, setFormData] = useState({
    nome_procedimento: '',
    valor: 0,
    duracao_minutos: 0,
    categoria: 'adulto'
  });

  useEffect(() => {
    fetchServicos();
  }, []);

  const fetchServicos = async () => {
    try {
      const { data, error } = await supabase
        .from('servicos')
        .select('*')
        .order('categoria')
        .order('nome_procedimento');

      if (error) throw error;
      setServicos(data || []);
    } catch (error) {
      toast({
        title: "Erro",
        description: getSecureErrorMessage(error, 'carregamento de serviços'),
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormErrors({ nome_procedimento: '', valor: '' });

    const sanitizedData = {
      nome_procedimento: sanitizeInput(formData.nome_procedimento),
      valor: formData.valor,
      duracao_minutos: formData.duracao_minutos || null,
      categoria: formData.categoria
    };

    try {
      servicoSchema.parse({ nome_procedimento: sanitizedData.nome_procedimento, valor: sanitizedData.valor, duracao_minutos: sanitizedData.duracao_minutos });
    } catch (error: any) {
      if (error.errors?.[0]) {
        const field = error.errors[0].path[0];
        const message = error.errors[0].message;
        setFormErrors(prev => ({ ...prev, [field]: message }));
      }
      return;
    }

    try {
      if (editingServico) {
        const { error } = await supabase.from('servicos').update(sanitizedData).eq('id', editingServico.id);
        if (error) throw error;
        toast({ title: "Sucesso", description: "Serviço atualizado!" });
      } else {
        const { error } = await supabase.from('servicos').insert([sanitizedData]);
        if (error) throw error;
        toast({ title: "Sucesso", description: "Serviço adicionado!" });
      }
      resetForm();
      fetchServicos();
    } catch (error) {
      toast({ title: "Erro", description: getSecureErrorMessage(error, 'salvamento do serviço'), variant: "destructive" });
    }
  };

  const resetForm = () => {
    setFormData({ nome_procedimento: '', valor: 0, duracao_minutos: 0, categoria: 'adulto' });
    setFormErrors({ nome_procedimento: '', valor: '' });
    setEditingServico(null);
    setDialogOpen(false);
  };

  const handleEdit = (servico: Servico) => {
    setFormData({
      nome_procedimento: servico.nome_procedimento,
      valor: servico.valor,
      duracao_minutos: servico.duracao_minutos || 0,
      categoria: servico.categoria || 'adulto'
    });
    setEditingServico(servico);
    setDialogOpen(true);
  };

  const handleDelete = async (servico: Servico) => {
    try {
      const { error } = await supabase.from('servicos').delete().eq('id', servico.id);
      if (error) throw error;
      toast({ title: "Sucesso", description: "Serviço excluído!" });
      fetchServicos();
    } catch (error) {
      toast({ title: "Erro", description: getSecureErrorMessage(error, 'exclusão do serviço'), variant: "destructive" });
    }
  };

  const filteredServicos = servicos.filter(servico => {
    const matchesSearch = servico.nome_procedimento.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesCategoria = categoriaFilter === 'todos' || servico.categoria === categoriaFilter;
    return matchesSearch && matchesCategoria;
  });

  const servicosAdulto = filteredServicos.filter(s => s.categoria === 'adulto');
  const servicosInfantil = filteredServicos.filter(s => s.categoria === 'infantil');

  const handleDownloadServicos = () => {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const padding = 40;
    const rowHeight = 50;
    const headerHeight = 60;
    const width = 600;
    const height = headerHeight + (filteredServicos.length * rowHeight) + padding * 2 + 40;

    canvas.width = width;
    canvas.height = height;

    ctx.fillStyle = '#faf8f5';
    ctx.fillRect(0, 0, width, height);

    ctx.fillStyle = '#1a1a1a';
    ctx.font = 'bold 24px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('Tabela de Serviços', width / 2, padding + 10);

    const headerY = padding + headerHeight;
    ctx.fillStyle = '#d4a574';
    ctx.fillRect(padding, headerY - 30, width - padding * 2, 35);
    
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 14px system-ui, sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText('Procedimento', padding + 15, headerY - 8);
    ctx.fillText('Cat.', width - padding - 200, headerY - 8);
    ctx.fillText('Valor', width - padding - 130, headerY - 8);
    ctx.fillText('Duração', width - padding - 50, headerY - 8);

    ctx.font = '14px system-ui, sans-serif';
    filteredServicos.forEach((servico, index) => {
      const y = headerY + (index * rowHeight) + 30;
      if (index % 2 === 0) {
        ctx.fillStyle = '#f5f0e8';
        ctx.fillRect(padding, y - 25, width - padding * 2, rowHeight);
      }
      ctx.fillStyle = '#1a1a1a';
      ctx.textAlign = 'left';
      ctx.fillText(servico.nome_procedimento.substring(0, 25), padding + 15, y);
      ctx.fillStyle = servico.categoria === 'infantil' ? '#e879a0' : '#6b7280';
      ctx.fillText(servico.categoria === 'infantil' ? '👶 Infantil' : 'Adulto', width - padding - 200, y);
      ctx.fillStyle = '#22c55e';
      ctx.fillText(`R$ ${servico.valor.toFixed(2)}`, width - padding - 130, y);
      ctx.fillStyle = '#666';
      ctx.fillText(servico.duracao_minutos ? `${servico.duracao_minutos}min` : '-', width - padding - 50, y);
    });

    ctx.strokeStyle = '#d4a574';
    ctx.lineWidth = 2;
    ctx.strokeRect(padding, headerY - 30, width - padding * 2, (filteredServicos.length * rowHeight) + 35);

    const link = document.createElement('a');
    link.download = 'servicos.png';
    link.href = canvas.toDataURL('image/png');
    link.click();
    toast({ title: "Download concluído", description: "Imagem baixada!" });
  };

  if (loading) {
    return <div className="flex items-center justify-center h-64"><div className="text-muted-foreground">Carregando serviços...</div></div>;
  }

  const renderServicoCard = (servico: Servico) => (
    <Card key={servico.id} className="mobile-card">
      <CardContent className="p-4">
        <div className="flex items-center justify-between">
          <div className="flex-1">
            <div className="flex items-center gap-2">
              <h3 className="font-semibold text-foreground">{servico.nome_procedimento}</h3>
              {servico.categoria === 'infantil' && (
                <Badge className="bg-pink-100 text-pink-700 border-pink-200 text-xs">
                  <Baby className="h-3 w-3 mr-1" />
                  Infantil
                </Badge>
              )}
            </div>
            <div className="flex items-center gap-3 mt-1">
              <span className="font-semibold text-lg text-success">R$ {servico.valor.toFixed(2)}</span>
              {servico.duracao_minutos && (
                <span className="text-sm text-muted-foreground">• {servico.duracao_minutos} min</span>
              )}
            </div>
          </div>
          <div className="flex gap-1">
            <Button variant="ghost" size="sm" onClick={() => handleEdit(servico)} className="h-8 w-8 p-0">
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
                  <AlertDialogTitle>Excluir Serviço</AlertDialogTitle>
                  <AlertDialogDescription>Tem certeza que deseja excluir "{servico.nome_procedimento}"?</AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancelar</AlertDialogCancel>
                  <AlertDialogAction onClick={() => handleDelete(servico)} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">Excluir</AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        </div>
      </CardContent>
    </Card>
  );

  return (
    <div className="space-y-4">
      <div className="flex gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Buscar serviços..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="pl-10" />
        </div>
        <Button variant="outline" size="icon" onClick={handleDownloadServicos} disabled={filteredServicos.length === 0} title="Baixar tabela">
          <Download className="h-4 w-4" />
        </Button>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button className="mobile-button shrink-0" onClick={() => { resetForm(); setDialogOpen(true); }}>
              <Plus className="h-4 w-4 mr-1" /> Novo
            </Button>
          </DialogTrigger>
          <DialogContent className="w-[90%] max-w-md mx-auto">
            <DialogHeader>
              <DialogTitle>{editingServico ? 'Editar Serviço' : 'Novo Serviço'}</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <Label htmlFor="categoria">Categoria *</Label>
                <Select value={formData.categoria} onValueChange={(value) => setFormData({ ...formData, categoria: value })}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="adulto">
                      <div className="flex items-center gap-2"><User className="h-4 w-4" /> Adulto</div>
                    </SelectItem>
                    <SelectItem value="infantil">
                      <div className="flex items-center gap-2"><Baby className="h-4 w-4" /> Infantil</div>
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="nome_procedimento">Nome do Procedimento *</Label>
                <Input
                  id="nome_procedimento"
                  value={formData.nome_procedimento}
                  onChange={(e) => { setFormData({ ...formData, nome_procedimento: e.target.value }); setFormErrors({ ...formErrors, nome_procedimento: '' }); }}
                  placeholder="Ex: Corte Masculino, Manicure..."
                  className={formErrors.nome_procedimento ? 'border-destructive' : ''}
                />
                {formErrors.nome_procedimento && (
                  <div className="text-sm text-destructive flex items-center gap-1 mt-1"><AlertCircle className="h-3 w-3" />{formErrors.nome_procedimento}</div>
                )}
              </div>
              <div>
                <Label htmlFor="valor">Valor (R$) *</Label>
                <Input
                  id="valor" type="number" step="0.01" min="0"
                  value={formData.valor}
                  onChange={(e) => { setFormData({ ...formData, valor: parseFloat(e.target.value) || 0 }); setFormErrors({ ...formErrors, valor: '' }); }}
                  className={formErrors.valor ? 'border-destructive' : ''}
                />
                {formErrors.valor && (
                  <div className="text-sm text-destructive flex items-center gap-1 mt-1"><AlertCircle className="h-3 w-3" />{formErrors.valor}</div>
                )}
              </div>
              <div>
                <Label htmlFor="duracao_minutos">Duração (minutos)</Label>
                <Input id="duracao_minutos" type="number" min="0" value={formData.duracao_minutos} onChange={(e) => setFormData({ ...formData, duracao_minutos: parseInt(e.target.value) || 0 })} />
              </div>
              <div className="flex gap-2 pt-2">
                <Button type="button" variant="outline" onClick={resetForm} className="flex-1">Cancelar</Button>
                <Button type="submit" className="mobile-button flex-1">{editingServico ? 'Atualizar' : 'Salvar'}</Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {/* Filtro de categoria */}
      <div className="flex gap-2">
        <Button variant={categoriaFilter === 'todos' ? 'default' : 'outline'} size="sm" onClick={() => setCategoriaFilter('todos')}>
          Todos ({servicos.length})
        </Button>
        <Button variant={categoriaFilter === 'adulto' ? 'default' : 'outline'} size="sm" onClick={() => setCategoriaFilter('adulto')}>
          <User className="h-3 w-3 mr-1" /> Adulto ({servicos.filter(s => s.categoria === 'adulto').length})
        </Button>
        <Button variant={categoriaFilter === 'infantil' ? 'default' : 'outline'} size="sm" onClick={() => setCategoriaFilter('infantil')}>
          <Baby className="h-3 w-3 mr-1" /> Infantil ({servicos.filter(s => s.categoria === 'infantil').length})
        </Button>
      </div>

      {filteredServicos.length === 0 ? (
        <div className="text-center py-8 text-muted-foreground">
          {searchTerm || categoriaFilter !== 'todos' ? 'Nenhum serviço encontrado' : 'Nenhum serviço cadastrado'}
        </div>
      ) : (
        <div className="space-y-4">
          {categoriaFilter === 'todos' ? (
            <>
              {servicosAdulto.length > 0 && (
                <div>
                  <div className="flex items-center gap-2 mb-2">
                    <User className="h-4 w-4 text-muted-foreground" />
                    <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Adulto</h3>
                    <Badge variant="secondary" className="text-xs">{servicosAdulto.length}</Badge>
                  </div>
                  <div className="space-y-2">{servicosAdulto.map(renderServicoCard)}</div>
                </div>
              )}
              {servicosInfantil.length > 0 && (
                <div>
                  <div className="flex items-center gap-2 mb-2">
                    <Baby className="h-4 w-4 text-pink-500" />
                    <h3 className="text-sm font-semibold text-pink-600 uppercase tracking-wider">Infantil</h3>
                    <Badge className="bg-pink-100 text-pink-700 border-pink-200 text-xs">{servicosInfantil.length}</Badge>
                  </div>
                  <div className="space-y-2">{servicosInfantil.map(renderServicoCard)}</div>
                </div>
              )}
            </>
          ) : (
            <div className="space-y-2">{filteredServicos.map(renderServicoCard)}</div>
          )}
        </div>
      )}

      {filteredServicos.length > 0 && (
        <Card className="mobile-card bg-muted/50">
          <CardContent className="p-4">
            <div className="flex justify-between items-center">
              <span className="text-sm font-medium text-muted-foreground">Total de Serviços</span>
              <span className="font-semibold">{filteredServicos.length}</span>
            </div>
            <div className="flex justify-between items-center mt-1">
              <span className="text-sm font-medium text-muted-foreground">Valor Médio</span>
              <span className="font-semibold text-success">
                R$ {(filteredServicos.reduce((acc, s) => acc + s.valor, 0) / filteredServicos.length).toFixed(2)}
              </span>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default ServicosTab;
