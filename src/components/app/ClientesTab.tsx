import React, { useState, useEffect } from 'react';
import { Plus, Search, Phone } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';

interface Cliente {
  id: string;
  nome: string;
  telefone: string;
  ultimo_atendimento?: string;
  created_at: string;
}

const ClientesTab = () => {
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(true);
  const [formData, setFormData] = useState({ nome: '', telefone: '' });
  const [dialogOpen, setDialogOpen] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    fetchClientes();
  }, []);

  const fetchClientes = async () => {
    try {
      const { data, error } = await supabase
        .from('clientes')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setClientes(data || []);
    } catch (error) {
      console.error('Erro ao buscar clientes:', error);
      toast({
        title: "Erro",
        description: "Não foi possível carregar os clientes",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.nome || !formData.telefone) {
      toast({
        title: "Erro",
        description: "Preencha todos os campos obrigatórios",
        variant: "destructive",
      });
      return;
    }

    try {
      const { error } = await supabase
        .from('clientes')
        .insert([formData]);

      if (error) throw error;

      toast({
        title: "Sucesso",
        description: "Cliente adicionado com sucesso!",
      });

      setFormData({ nome: '', telefone: '' });
      setDialogOpen(false);
      fetchClientes();
    } catch (error: any) {
      console.error('Erro ao adicionar cliente:', error);
      if (error.code === '23505') {
        toast({
          title: "Erro",
          description: "Este telefone já está cadastrado",
          variant: "destructive",
        });
      } else {
        toast({
          title: "Erro",
          description: "Não foi possível adicionar o cliente",
          variant: "destructive",
        });
      }
    }
  };

  const filteredClientes = clientes.filter(cliente =>
    cliente.nome.toLowerCase().includes(searchTerm.toLowerCase()) ||
    cliente.telefone.includes(searchTerm)
  );

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('pt-BR');
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-muted-foreground">Carregando clientes...</div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header com busca e botão adicionar */}
      <div className="flex gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar por nome ou telefone..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10"
          />
        </div>
        
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button className="mobile-button shrink-0">
              <Plus className="h-4 w-4 mr-1" />
              Novo
            </Button>
          </DialogTrigger>
          <DialogContent className="w-[90%] max-w-md mx-auto">
            <DialogHeader>
              <DialogTitle>Novo Cliente</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <Label htmlFor="nome">Nome *</Label>
                <Input
                  id="nome"
                  value={formData.nome}
                  onChange={(e) => setFormData({ ...formData, nome: e.target.value })}
                  placeholder="Nome completo"
                />
              </div>
              <div>
                <Label htmlFor="telefone">Telefone *</Label>
                <Input
                  id="telefone"
                  value={formData.telefone}
                  onChange={(e) => setFormData({ ...formData, telefone: e.target.value })}
                  placeholder="(11) 99999-9999"
                />
              </div>
              <div className="flex gap-2 pt-2">
                <Button type="button" variant="outline" onClick={() => setDialogOpen(false)} className="flex-1">
                  Cancelar
                </Button>
                <Button type="submit" className="mobile-button flex-1">
                  Salvar
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {/* Lista de clientes */}
      {filteredClientes.length === 0 ? (
        <div className="text-center py-8 text-muted-foreground">
          {searchTerm ? 'Nenhum cliente encontrado' : 'Nenhum cliente cadastrado'}
        </div>
      ) : (
        <div className="space-y-3">
          {filteredClientes.map((cliente) => (
            <Card key={cliente.id} className="mobile-card">
              <CardContent className="p-4">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <h3 className="font-semibold text-foreground">{cliente.nome}</h3>
                    <div className="flex items-center text-muted-foreground text-sm mt-1">
                      <Phone className="h-3 w-3 mr-1" />
                      <span>{cliente.telefone}</span>
                    </div>
                    {cliente.ultimo_atendimento && (
                      <div className="text-xs text-muted-foreground mt-1">
                        Último atendimento: {formatDate(cliente.ultimo_atendimento)}
                      </div>
                    )}
                  </div>
                  <div className="text-right text-xs text-muted-foreground">
                    Cadastrado em {formatDate(cliente.created_at)}
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

export default ClientesTab;