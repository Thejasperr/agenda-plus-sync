import React, { useState, useEffect } from 'react';
import { Plus, Edit2, Trash2, Clock } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';

interface Horario {
  id: string;
  dia_semana: string;
  hora_inicio: string;
  hora_fim: string;
  created_at: string;
}

const HorariosTab = () => {
  const [horarios, setHorarios] = useState<Horario[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingHorario, setEditingHorario] = useState<Horario | null>(null);
  const [formData, setFormData] = useState({
    dia_semana: '',
    hora_inicio: '',
    hora_fim: ''
  });
  const { toast } = useToast();

  const diasSemana = [
    'Segunda-feira',
    'Terça-feira',
    'Quarta-feira',
    'Quinta-feira',
    'Sexta-feira',
    'Sábado',
    'Domingo'
  ];

  useEffect(() => {
    fetchHorarios();
  }, []);

  const fetchHorarios = async () => {
    try {
      // Como não temos uma tabela específica para horários, vamos simular com localStorage por enquanto
      const savedHorarios = localStorage.getItem('horarios_funcionamento');
      if (savedHorarios) {
        setHorarios(JSON.parse(savedHorarios));
      } else {
        // Definir horários padrão
        const horariosDefault = [
          { id: '1', dia_semana: 'Segunda-feira', hora_inicio: '09:00', hora_fim: '18:00', created_at: new Date().toISOString() },
          { id: '2', dia_semana: 'Terça-feira', hora_inicio: '09:00', hora_fim: '18:00', created_at: new Date().toISOString() },
          { id: '3', dia_semana: 'Quarta-feira', hora_inicio: '09:00', hora_fim: '18:00', created_at: new Date().toISOString() },
          { id: '4', dia_semana: 'Quinta-feira', hora_inicio: '09:00', hora_fim: '18:00', created_at: new Date().toISOString() },
          { id: '5', dia_semana: 'Sexta-feira', hora_inicio: '09:00', hora_fim: '18:00', created_at: new Date().toISOString() },
          { id: '6', dia_semana: 'Sábado', hora_inicio: '09:00', hora_fim: '15:00', created_at: new Date().toISOString() }
        ];
        setHorarios(horariosDefault);
        localStorage.setItem('horarios_funcionamento', JSON.stringify(horariosDefault));
      }
    } catch (error) {
      console.error('Erro ao buscar horários:', error);
      toast({
        title: "Erro",
        description: "Não foi possível carregar os horários",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.dia_semana || !formData.hora_inicio || !formData.hora_fim) {
      toast({
        title: "Erro",
        description: "Preencha todos os campos obrigatórios",
        variant: "destructive",
      });
      return;
    }

    // Validar se hora_fim é maior que hora_inicio
    if (formData.hora_fim <= formData.hora_inicio) {
      toast({
        title: "Erro",
        description: "Hora de fim deve ser maior que hora de início",
        variant: "destructive",
      });
      return;
    }

    try {
      let updatedHorarios = [...horarios];

      if (editingHorario) {
        // Editar horário existente
        updatedHorarios = horarios.map(h => 
          h.id === editingHorario.id 
            ? { ...h, ...formData }
            : h
        );
      } else {
        // Verificar se já existe horário para este dia
        const diaExistente = horarios.find(h => h.dia_semana === formData.dia_semana);
        if (diaExistente) {
          toast({
            title: "Erro",
            description: "Já existe um horário cadastrado para este dia",
            variant: "destructive",
          });
          return;
        }

        // Adicionar novo horário
        const novoHorario: Horario = {
          id: Date.now().toString(),
          ...formData,
          created_at: new Date().toISOString()
        };
        updatedHorarios.push(novoHorario);
      }

      // Salvar no localStorage
      localStorage.setItem('horarios_funcionamento', JSON.stringify(updatedHorarios));
      setHorarios(updatedHorarios);

      toast({
        title: "Sucesso",
        description: editingHorario ? "Horário atualizado com sucesso!" : "Horário adicionado com sucesso!",
      });

      resetForm();
    } catch (error) {
      console.error('Erro ao salvar horário:', error);
      toast({
        title: "Erro",
        description: "Não foi possível salvar o horário",
        variant: "destructive",
      });
    }
  };

  const handleEdit = (horario: Horario) => {
    setFormData({
      dia_semana: horario.dia_semana,
      hora_inicio: horario.hora_inicio,
      hora_fim: horario.hora_fim
    });
    setEditingHorario(horario);
    setDialogOpen(true);
  };

  const handleDelete = async (id: string) => {
    try {
      const updatedHorarios = horarios.filter(h => h.id !== id);
      localStorage.setItem('horarios_funcionamento', JSON.stringify(updatedHorarios));
      setHorarios(updatedHorarios);

      toast({
        title: "Sucesso",
        description: "Horário excluído com sucesso!",
      });
    } catch (error) {
      console.error('Erro ao excluir horário:', error);
      toast({
        title: "Erro",
        description: "Não foi possível excluir o horário",
        variant: "destructive",
      });
    }
  };

  const resetForm = () => {
    setFormData({
      dia_semana: '',
      hora_inicio: '',
      hora_fim: ''
    });
    setEditingHorario(null);
    setDialogOpen(false);
  };

  const getDiasDisponiveis = () => {
    return diasSemana.filter(dia => 
      !horarios.some(h => h.dia_semana === dia) || 
      (editingHorario && editingHorario.dia_semana === dia)
    );
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-muted-foreground">Carregando horários...</div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h3 className="text-lg font-semibold">Horários de Funcionamento</h3>
          <p className="text-sm text-muted-foreground">
            Configure os horários de funcionamento para cada dia da semana
          </p>
        </div>
        
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button onClick={() => {
              resetForm();
              setDialogOpen(true);
            }}>
              <Plus className="h-4 w-4 mr-2" />
              Novo Horário
            </Button>
          </DialogTrigger>
          <DialogContent className="w-[90%] max-w-md mx-auto">
            <DialogHeader>
              <DialogTitle>
                {editingHorario ? 'Editar Horário' : 'Novo Horário'}
              </DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <Label htmlFor="dia_semana">Dia da Semana *</Label>
                <Select value={formData.dia_semana} onValueChange={(value) => setFormData({ ...formData, dia_semana: value })}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione o dia" />
                  </SelectTrigger>
                  <SelectContent>
                    {getDiasDisponiveis().map((dia) => (
                      <SelectItem key={dia} value={dia}>{dia}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="hora_inicio">Hora de Início *</Label>
                <Input
                  id="hora_inicio"
                  type="time"
                  value={formData.hora_inicio}
                  onChange={(e) => setFormData({ ...formData, hora_inicio: e.target.value })}
                />
              </div>
              <div>
                <Label htmlFor="hora_fim">Hora de Fim *</Label>
                <Input
                  id="hora_fim"
                  type="time"
                  value={formData.hora_fim}
                  onChange={(e) => setFormData({ ...formData, hora_fim: e.target.value })}
                />
              </div>
              <div className="flex gap-2 pt-2">
                <Button type="button" variant="outline" onClick={resetForm} className="flex-1">
                  Cancelar
                </Button>
                <Button type="submit" className="flex-1">
                  {editingHorario ? 'Atualizar' : 'Salvar'}
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {/* Lista de horários */}
      {horarios.length === 0 ? (
        <div className="text-center py-8 text-muted-foreground">
          <Clock className="h-12 w-12 mx-auto mb-4 opacity-50" />
          <p>Nenhum horário cadastrado</p>
          <p className="text-xs">Adicione os horários de funcionamento do seu estabelecimento</p>
        </div>
      ) : (
        <div className="space-y-3">
          {diasSemana.map((dia) => {
            const horario = horarios.find(h => h.dia_semana === dia);
            return (
              <Card key={dia} className="mobile-card">
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <h3 className="font-semibold text-foreground">{dia}</h3>
                      {horario ? (
                        <div className="text-sm text-muted-foreground">
                          {horario.hora_inicio} às {horario.hora_fim}
                        </div>
                      ) : (
                        <div className="text-sm text-muted-foreground">Fechado</div>
                      )}
                    </div>
                    {horario && (
                      <div className="flex gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleEdit(horario)}
                        >
                          <Edit2 className="h-3 w-3" />
                        </Button>
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button variant="outline" size="sm" className="text-red-600 hover:text-red-700">
                              <Trash2 className="h-3 w-3" />
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>Confirmar exclusão</AlertDialogTitle>
                              <AlertDialogDescription>
                                Tem certeza que deseja excluir o horário de {dia}? Esta ação não pode ser desfeita.
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Cancelar</AlertDialogCancel>
                              <AlertDialogAction onClick={() => handleDelete(horario.id)}>
                                Excluir
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default HorariosTab;