import React, { useState, useEffect } from 'react';
import { Plus, Search, DollarSign, Edit2, Trash2, AlertCircle } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { sanitizeInput, getSecureErrorMessage, servicoSchema } from '@/lib/security';

interface Servico {
  id: string;
  nome_procedimento: string;
  valor: number;
  created_at: string;
}

const ServicosTab = () => {
  const [servicos, setServicos] = useState<Servico[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingServico, setEditingServico] = useState<Servico | null>(null);
  const [formErrors, setFormErrors] = useState({ nome_procedimento: '', valor: '' });
  const { toast } = useToast();

  const [formData, setFormData] = useState({
    nome_procedimento: '',
    valor: 0
  });

  useEffect(() => {
    fetchServicos();
  }, []);

  const fetchServicos = async () => {
    try {
      const { data, error } = await supabase
        .from('servicos')
        .select('*')
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
    
    // Clear previous errors
    setFormErrors({ nome_procedimento: '', valor: '' });
    
    // Sanitize inputs
    const sanitizedData = {
      nome_procedimento: sanitizeInput(formData.nome_procedimento),
      valor: formData.valor
    };
    
    // Validate with schema
    try {
      servicoSchema.parse(sanitizedData);
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
        const { error } = await supabase
          .from('servicos')
          .update(sanitizedData)
          .eq('id', editingServico.id);

        if (error) throw error;

        toast({
          title: "Sucesso",
          description: "Serviço atualizado com sucesso!",
        });
      } else {
        const { error } = await supabase
          .from('servicos')
          .insert([sanitizedData]);

        if (error) throw error;

        toast({
          title: "Sucesso",
          description: "Serviço adicionado com sucesso!",
        });
      }

      resetForm();
      fetchServicos();
    } catch (error) {
      toast({
        title: "Erro",
        description: getSecureErrorMessage(error, 'salvamento do serviço'),
        variant: "destructive",
      });
    }
  };

  const resetForm = () => {
    setFormData({
      nome_procedimento: '',
      valor: 0
    });
    setFormErrors({ nome_procedimento: '', valor: '' });
    setEditingServico(null);
    setDialogOpen(false);
  };

  const handleEdit = (servico: Servico) => {
    setFormData({
      nome_procedimento: servico.nome_procedimento,
      valor: servico.valor
    });
    setEditingServico(servico);
    setDialogOpen(true);
  };

  const handleDelete = async (servico: Servico) => {
    try {
      const { error } = await supabase
        .from('servicos')
        .delete()
        .eq('id', servico.id);

      if (error) throw error;

      toast({
        title: "Sucesso",
        description: "Serviço excluído com sucesso!",
      });

      fetchServicos();
    } catch (error) {
      toast({
        title: "Erro",
        description: getSecureErrorMessage(error, 'exclusão do serviço'),
        variant: "destructive",
      });
    }
  };

  const filteredServicos = servicos.filter(servico =>
    servico.nome_procedimento.toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-muted-foreground">Carregando serviços...</div>
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
            placeholder="Buscar serviços..."
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
                {editingServico ? 'Editar Serviço' : 'Novo Serviço'}
              </DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <Label htmlFor="nome_procedimento">Nome do Procedimento *</Label>
                <Input
                  id="nome_procedimento"
                  value={formData.nome_procedimento}
                  onChange={(e) => {
                    setFormData({ ...formData, nome_procedimento: e.target.value });
                    setFormErrors({ ...formErrors, nome_procedimento: '' });
                  }}
                  placeholder="Ex: Corte Masculino, Manicure..."
                  className={formErrors.nome_procedimento ? 'border-destructive' : ''}
                />
                {formErrors.nome_procedimento && (
                  <div className="text-sm text-destructive flex items-center gap-1 mt-1">
                    <AlertCircle className="h-3 w-3" />
                    {formErrors.nome_procedimento}
                  </div>
                )}
              </div>
              
              <div>
                <Label htmlFor="valor">Valor (R$) *</Label>
                <Input
                  id="valor"
                  type="number"
                  step="0.01"
                  min="0"
                  value={formData.valor}
                  onChange={(e) => {
                    setFormData({ ...formData, valor: parseFloat(e.target.value) || 0 });
                    setFormErrors({ ...formErrors, valor: '' });
                  }}
                  placeholder="0.00"
                  className={formErrors.valor ? 'border-destructive' : ''}
                />
                {formErrors.valor && (
                  <div className="text-sm text-destructive flex items-center gap-1 mt-1">
                    <AlertCircle className="h-3 w-3" />
                    {formErrors.valor}
                  </div>
                )}
              </div>

              <div className="flex gap-2 pt-2">
                <Button type="button" variant="outline" onClick={resetForm} className="flex-1">
                  Cancelar
                </Button>
                <Button type="submit" className="mobile-button flex-1">
                  {editingServico ? 'Atualizar' : 'Salvar'}
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {/* Lista de serviços */}
      {filteredServicos.length === 0 ? (
        <div className="text-center py-8 text-muted-foreground">
          {searchTerm ? 'Nenhum serviço encontrado' : 'Nenhum serviço cadastrado'}
        </div>
      ) : (
        <div className="space-y-3">
          {filteredServicos.map((servico) => (
            <Card key={servico.id} className="mobile-card">
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div className="flex-1">
                    <h3 className="font-semibold text-foreground mb-1">
                      {servico.nome_procedimento}
                    </h3>
                    <div className="flex items-center text-success">
                      <DollarSign className="h-4 w-4 mr-1" />
                      <span className="font-medium text-lg">
                        R$ {servico.valor.toFixed(2)}
                      </span>
                    </div>
                  </div>
                  
                  <div className="flex gap-1">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleEdit(servico)}
                      className="h-8 w-8 p-0"
                    >
                      <Edit2 className="h-4 w-4" />
                    </Button>
                    
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-8 w-8 p-0 text-destructive hover:text-destructive"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Excluir Serviço</AlertDialogTitle>
                          <AlertDialogDescription>
                            Tem certeza que deseja excluir o serviço "{servico.nome_procedimento}"? Esta ação não pode ser desfeita.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancelar</AlertDialogCancel>
                          <AlertDialogAction
                            onClick={() => handleDelete(servico)}
                            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
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

      {/* Resumo */}
      {filteredServicos.length > 0 && (
        <Card className="mobile-card bg-muted/50">
          <CardContent className="p-4">
            <div className="flex justify-between items-center">
              <span className="text-sm font-medium text-muted-foreground">
                Total de Serviços
              </span>
              <span className="font-semibold">
                {filteredServicos.length}
              </span>
            </div>
            <div className="flex justify-between items-center mt-1">
              <span className="text-sm font-medium text-muted-foreground">
                Valor Médio
              </span>
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