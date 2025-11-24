import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Sparkles, CheckCircle2, Loader2 } from 'lucide-react';
import { createAutoTasks } from '@/services/crm/ai-automation';
import { toast } from 'sonner';

export function AutoTaskCreator() {
  const [loading, setLoading] = useState(false);
  const [lastResult, setLastResult] = useState<{ tasks_created: number } | null>(null);

  const handleCreateTasks = async () => {
    setLoading(true);
    try {
      const result = await createAutoTasks();
      setLastResult(result);
      
      if (result.tasks_created > 0) {
        toast.success(`${result.tasks_created} tarefa${result.tasks_created !== 1 ? 's' : ''} criada${result.tasks_created !== 1 ? 's' : ''} automaticamente!`);
      } else {
        toast.info('Nenhuma tarefa nova necessária no momento');
      }
    } catch (error: any) {
      console.error('Error creating auto tasks:', error);
      toast.error(error.message || 'Erro ao criar tarefas');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary" />
            <CardTitle>Auto Task Creator</CardTitle>
          </div>
          <Button 
            onClick={handleCreateTasks} 
            disabled={loading}
            size="sm"
          >
            {loading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Criando...
              </>
            ) : (
              <>
                <Sparkles className="mr-2 h-4 w-4" />
                Criar Tarefas
              </>
            )}
          </Button>
        </div>
        <CardDescription>
          Cria tarefas automaticamente baseado em regras inteligentes
        </CardDescription>
      </CardHeader>
      <CardContent>
        {lastResult ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <CheckCircle2 className="h-4 w-4 text-green-500" />
            <span>
              Última execução: {lastResult.tasks_created} tarefa{lastResult.tasks_created !== 1 ? 's' : ''} criada{lastResult.tasks_created !== 1 ? 's' : ''}
            </span>
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">
            Clique em "Criar Tarefas" para gerar automaticamente tarefas baseadas em:
          </p>
        )}
        <ul className="mt-3 space-y-2 text-xs text-muted-foreground">
          <li>• Follow-ups para oportunidades sem contato há 3+ dias</li>
          <li>• Preparação para reuniões agendadas</li>
          <li>• Envio de propostas para negociações em andamento</li>
        </ul>
      </CardContent>
    </Card>
  );
}
