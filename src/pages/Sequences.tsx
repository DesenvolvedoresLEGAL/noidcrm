import { useEffect, useState } from 'react';
import { Layout } from '@/components/Layout';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { SequenceBuilder } from '@/components/SequenceBuilder';
import { Plus, Play, Pause, Copy, Trash2, Mail, MessageSquare, CheckSquare, Phone, Clock } from 'lucide-react';
import { listSequences, createSequence, deleteSequence } from '@/services/crm/sequences';
import { Sequence } from '@/services/crm/types';
import { useToast } from '@/hooks/use-toast';
import { LoadingSpinner } from '@/components/LoadingSpinner';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';

interface SequencesProps {
  embedded?: boolean;
}

export default function Sequences({ embedded = false }: SequencesProps) {
  const { toast } = useToast();
  const [sequences, setSequences] = useState<Sequence[]>([]);
  const [loading, setLoading] = useState(true);
  const [builderOpen, setBuilderOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [sequenceToDelete, setSequenceToDelete] = useState<string | null>(null);

  useEffect(() => {
    loadSequences();
  }, []);

  const loadSequences = async () => {
    try {
      const data = await listSequences();
      setSequences(data);
    } catch (error) {
      console.error('Erro ao carregar cadências:', error);
      toast({
        title: 'Erro',
        description: 'Erro ao carregar cadências',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleCreateSequence = async (data: any) => {
    try {
      await createSequence(data);
      await loadSequences();
    } catch (error) {
      console.error('Erro ao criar cadência:', error);
      throw error;
    }
  };

  const handleDeleteSequence = async () => {
    if (!sequenceToDelete) return;
    
    try {
      await deleteSequence(sequenceToDelete);
      await loadSequences();
      toast({
        title: 'Sucesso',
        description: 'Cadência excluída com sucesso',
      });
    } catch (error) {
      toast({
        title: 'Erro',
        description: 'Erro ao excluir cadência',
        variant: 'destructive',
      });
    } finally {
      setDeleteDialogOpen(false);
      setSequenceToDelete(null);
    }
  };

  const getStepIcon = (type: string) => {
    switch (type) {
      case 'email':
        return <Mail className="h-4 w-4 text-primary" />;
      case 'whatsapp':
        return <MessageSquare className="h-4 w-4 text-green-600" />;
      case 'task':
        return <CheckSquare className="h-4 w-4 text-accent" />;
      case 'call':
        return <Phone className="h-4 w-4 text-secondary" />;
      case 'wait':
        return <Clock className="h-4 w-4 text-muted-foreground" />;
      default:
        return null;
    }
  };

  if (loading) {
    const content = <LoadingSpinner />;
    return embedded ? content : <Layout>{content}</Layout>;
  }

  const content = (
    <div className={embedded ? 'space-y-6' : 'p-4 md:p-8 space-y-6'}>
      {/* Cabeçalho */}
      {!embedded && (
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 animate-fade-in">
          <div>
            <h1 className="text-2xl md:text-3xl font-black text-foreground">Cadências</h1>
            <p className="text-sm md:text-base text-muted-foreground mt-1">
              Configure sequências de follow-up automatizadas
            </p>
          </div>
          <Button
            onClick={() => setBuilderOpen(true)}
            size="lg"
            className="bg-accent text-accent-foreground hover:bg-accent/90 w-full md:w-auto animate-scale-in"
          >
            <Plus className="h-5 w-5 mr-2" />
            Nova Cadência
          </Button>
        </div>
      )}

      {embedded && (
        <div className="flex justify-end">
          <Button
            onClick={() => setBuilderOpen(true)}
            className="gap-2"
          >
            <Plus className="h-4 w-4" />
            Nova Cadência
          </Button>
        </div>
      )}

      {/* Lista de Cadências */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 md:gap-6">
        {sequences.map((sequence, index) => {
          const steps = sequence.steps?.steps || [];
          const stepTypeCounts = steps.reduce((acc, step) => {
            acc[step.type] = (acc[step.type] || 0) + 1;
            return acc;
          }, {} as Record<string, number>);

          return (
            <Card 
              key={sequence.id} 
              className="shadow-card hover:shadow-card-hover transition-all duration-300 hover:scale-[1.02] animate-fade-in"
              style={{ animationDelay: `${index * 100}ms` }}
            >
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <CardTitle className="text-lg">{sequence.name}</CardTitle>
                    <div className="flex flex-wrap gap-2 mt-2">
                      <Badge variant="outline" className="text-xs">
                        {steps.length} passos
                      </Badge>
                    </div>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Resumo dos Passos */}
                <div>
                  <p className="text-sm text-muted-foreground mb-2">Tipos de passos:</p>
                  <div className="flex flex-wrap gap-2">
                    {Object.entries(stepTypeCounts).map(([type, count]) => (
                      <div
                        key={type}
                        className="flex items-center gap-1 px-2 py-1 bg-muted rounded-md"
                      >
                        {getStepIcon(type)}
                        <span className="text-xs font-medium">{String(count)}x</span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Ações */}
                <div className="flex items-center gap-2 pt-4 border-t">
                  <Button size="sm" variant="outline" className="flex-1">
                    <Play className="h-4 w-4 mr-1" />
                    Ativar
                  </Button>
                  <Button size="sm" variant="outline">
                    <Copy className="h-4 w-4" />
                  </Button>
                  <Button size="sm" variant="outline">
                    Editar
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      setSequenceToDelete(sequence.id);
                      setDeleteDialogOpen(true);
                    }}
                  >
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </div>

                {/* Data de Criação */}
                <div className="text-xs text-muted-foreground text-center pt-2 border-t">
                  Criada em {new Date(sequence.created_at).toLocaleDateString('pt-BR')}
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {sequences.length === 0 && (
        <Card className="shadow-card">
          <CardContent className="py-12 text-center">
            <div className="space-y-4">
              <div className="flex justify-center">
                <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center">
                  <Plus className="h-8 w-8 text-primary" />
                </div>
              </div>
              <div>
                <h3 className="text-lg font-semibold mb-2">Nenhuma cadência criada ainda</h3>
                <p className="text-muted-foreground mb-4">
                  Crie sua primeira cadência automatizada para começar a nutrir seus leads.
                </p>
                <Button onClick={() => setBuilderOpen(true)}>
                  <Plus className="h-4 w-4 mr-2" />
                  Criar Primeira Cadência
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Modal de Criação */}
      <SequenceBuilder
        open={builderOpen}
        onOpenChange={setBuilderOpen}
        onCreateSequence={handleCreateSequence}
      />

      {/* Dialog de Confirmação de Exclusão */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmar Exclusão</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir esta cadência? Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteSequence} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );

  return embedded ? content : <Layout>{content}</Layout>;
}
