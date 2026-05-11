import React, { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Search, Package, User, Calendar, CheckCircle2, AlertCircle } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { ClientePerfilDialog } from './ClientePerfilDialog';

interface ClientePacoteAtivo {
  id: string;
  cliente_id: string;
  pacote_id: string;
  sessoes_totais: number;
  sessoes_restantes: number;
  valor_pago: number;
  status: string;
  created_at: string;
  clientes: {
    id: string;
    nome: string;
    telefone: string;
  };
  pacotes: {
    nome: string;
  };
}

const PacotesGerenciamentoTab = () => {
  const [pacotesAtivos, setPacotesAtivos] = useState<ClientePacoteAtivo[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedClienteId, setSelectedClienteId] = useState<string | null>(null);
  const { toast } = useToast();

  const fetchPacotesAtivos = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('cliente_pacotes')
        .select(`
          *,
          clientes:cliente_id (id, nome, telefone),
          pacotes:pacote_id (nome)
        `)
        .eq('status', 'ativo')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setPacotesAtivos(data as any || []);
    } catch (error: any) {
      console.error('Erro ao buscar pacotes ativos:', error);
      toast({ title: "Erro", description: "Não foi possível carregar os pacotes ativos.", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPacotesAtivos();
  }, []);

  const filteredPacotes = pacotesAtivos.filter(item => 
    item.clientes?.nome.toLowerCase().includes(searchTerm.toLowerCase()) ||
    item.pacotes?.nome.toLowerCase().includes(searchTerm.toLowerCase()) ||
    item.clientes?.telefone.includes(searchTerm)
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-1">
        <h2 className="text-2xl font-bold tracking-tight">Gerenciamento de Pacotes</h2>
        <p className="text-muted-foreground">Visualize e gerencie os pacotes ativos de seus clientes.</p>
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Buscar por cliente ou pacote..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="pl-10"
        />
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        </div>
      ) : filteredPacotes.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredPacotes.map((item) => (
            <Card 
              key={item.id} 
              className="hover:shadow-md transition-shadow cursor-pointer border-l-4 border-l-primary"
              onClick={() => setSelectedClienteId(item.clientes.id)}
            >
              <CardHeader className="pb-2">
                <div className="flex justify-between items-start">
                  <div className="space-y-1">
                    <CardTitle className="text-base flex items-center gap-2">
                      <User className="h-4 w-4 text-muted-foreground" />
                      {item.clientes?.nome}
                    </CardTitle>
                    <CardDescription className="flex items-center gap-1">
                      <Package className="h-3 w-3" />
                      {item.pacotes?.nome || 'Pacote Personalizado'}
                    </CardDescription>
                  </div>
                  <Badge variant="outline" className="bg-green-500/10 text-green-700 border-green-200">
                    Ativo
                  </Badge>
                </div>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 gap-2 mt-2">
                  <div className="bg-muted/30 p-2 rounded-lg text-center">
                    <div className="text-lg font-bold">{item.sessoes_totais}</div>
                    <div className="text-[10px] text-muted-foreground uppercase">Total</div>
                  </div>
                  <div className={`p-2 rounded-lg text-center ${item.sessoes_restantes <= 1 ? 'bg-amber-500/10 text-amber-600' : 'bg-primary/10 text-primary'}`}>
                    <div className="text-lg font-bold">{item.sessoes_restantes}</div>
                    <div className="text-[10px] uppercase font-semibold">Restantes</div>
                  </div>
                </div>
                <div className="mt-4 pt-4 border-t flex justify-between items-center text-xs text-muted-foreground">
                  <span className="flex items-center gap-1">
                    <Calendar className="h-3 w-3" />
                    Desde {new Date(item.created_at).toLocaleDateString('pt-BR')}
                  </span>
                  <span className="font-semibold text-foreground">
                    R$ {item.valor_pago.toFixed(2)}
                  </span>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <Card className="border-dashed py-12">
          <CardContent className="flex flex-col items-center justify-center text-muted-foreground">
            <Package className="h-12 w-12 mb-4 opacity-20" />
            <p>Nenhum pacote ativo encontrado.</p>
          </CardContent>
        </Card>
      )}

      {selectedClienteId && (
        <ClientePerfilDialog 
          clienteId={selectedClienteId} 
          open={!!selectedClienteId} 
          onOpenChange={(open) => {
            if (!open) {
              setSelectedClienteId(null);
              fetchPacotesAtivos(); // Atualiza a lista ao fechar o perfil
            }
          }} 
        />
      )}
    </div>
  );
};

export default PacotesGerenciamentoTab;
