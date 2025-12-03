import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
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
import { Plus, MoreVertical, Edit, Copy, Trash2, Zap, Activity, CheckCircle2 } from 'lucide-react';
import {
  useWorkflowRules,
  useToggleWorkflowRule,
  useDeleteWorkflowRule,
  useDuplicateWorkflowRule,
  useWorkflowExecutions,
} from '@/hooks/useWorkflowRules';
import { TRIGGER_TYPE_LABELS, ACTION_TYPE_LABELS, WorkflowRule } from '@/services/crm/workflow-rules';
import { WorkflowRuleModal } from './WorkflowRuleModal';
import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';

export function WorkflowRulesList() {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedRule, setSelectedRule] = useState<WorkflowRule | null>(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

  const { data: rules = [], isLoading } = useWorkflowRules();
  const { data: executions = [] } = useWorkflowExecutions({ limit: 100 });
  const toggleMutation = useToggleWorkflowRule();
  const deleteMutation = useDeleteWorkflowRule();
  const duplicateMutation = useDuplicateWorkflowRule();

  const activeRules = rules.filter(r => r.is_active).length;
  const totalExecutions = executions.length;

  const handleEdit = (rule: WorkflowRule) => {
    setSelectedRule(rule);
    setIsModalOpen(true);
  };

  const handleCreate = () => {
    setSelectedRule(null);
    setIsModalOpen(true);
  };

  const handleDelete = (id: string) => {
    deleteMutation.mutate(id);
    setDeleteConfirmId(null);
  };

  if (isLoading) {
    return <div className="text-center py-8 text-muted-foreground">Carregando...</div>;
  }

  return (
    <div className="space-y-6">
      {/* KPIs */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-primary/10 rounded-lg">
                <Zap className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Total de Regras</p>
                <p className="text-2xl font-bold">{rules.length}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-green-500/10 rounded-lg">
                <CheckCircle2 className="h-5 w-5 text-green-500" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Regras Ativas</p>
                <p className="text-2xl font-bold">{activeRules}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-blue-500/10 rounded-lg">
                <Activity className="h-5 w-5 text-blue-500" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Execuções (7 dias)</p>
                <p className="text-2xl font-bold">{totalExecutions}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6 flex items-center justify-center">
            <Button onClick={handleCreate} className="w-full">
              <Plus className="h-4 w-4 mr-2" />
              Nova Regra
            </Button>
          </CardContent>
        </Card>
      </div>

      {/* Rules List */}
      {rules.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <Zap className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <h3 className="text-lg font-medium mb-2">Nenhuma regra de workflow</h3>
            <p className="text-muted-foreground mb-4">
              Crie sua primeira regra para automatizar ações no CRM
            </p>
            <Button onClick={handleCreate}>
              <Plus className="h-4 w-4 mr-2" />
              Criar Regra
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4">
          {rules.map((rule) => (
            <Card key={rule.id} className={!rule.is_active ? 'opacity-60' : ''}>
              <CardContent className="py-4">
                <div className="flex items-center justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <h3 className="font-medium">{rule.name}</h3>
                      <Badge variant={rule.is_active ? 'default' : 'secondary'}>
                        {rule.is_active ? 'Ativa' : 'Inativa'}
                      </Badge>
                    </div>

                    {rule.description && (
                      <p className="text-sm text-muted-foreground mb-2">{rule.description}</p>
                    )}

                    <div className="flex flex-wrap items-center gap-2 text-sm">
                      <Badge variant="outline">
                        {TRIGGER_TYPE_LABELS[rule.trigger_type] || rule.trigger_type}
                      </Badge>
                      <span className="text-muted-foreground">→</span>
                      {rule.actions.map((action, idx) => (
                        <Badge key={idx} variant="outline" className="bg-primary/5">
                          {ACTION_TYPE_LABELS[action.type] || action.type}
                        </Badge>
                      ))}
                    </div>

                    <div className="flex items-center gap-4 mt-3 text-xs text-muted-foreground">
                      <span>Execuções: {rule.executions_count || 0}</span>
                      {rule.last_executed_at && (
                        <span>
                          Última: {formatDistanceToNow(new Date(rule.last_executed_at), { addSuffix: true, locale: ptBR })}
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-3">
                    <Switch
                      checked={rule.is_active}
                      onCheckedChange={(checked) =>
                        toggleMutation.mutate({ id: rule.id, isActive: checked })
                      }
                    />

                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon">
                          <MoreVertical className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => handleEdit(rule)}>
                          <Edit className="h-4 w-4 mr-2" />
                          Editar
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => duplicateMutation.mutate(rule.id)}>
                          <Copy className="h-4 w-4 mr-2" />
                          Duplicar
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          className="text-destructive"
                          onClick={() => setDeleteConfirmId(rule.id)}
                        >
                          <Trash2 className="h-4 w-4 mr-2" />
                          Excluir
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Modal */}
      <WorkflowRuleModal
        open={isModalOpen}
        onOpenChange={setIsModalOpen}
        rule={selectedRule}
      />

      {/* Delete Confirmation */}
      <AlertDialog open={!!deleteConfirmId} onOpenChange={() => setDeleteConfirmId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir regra de workflow?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta ação não pode ser desfeita. A regra será permanentemente excluída.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground"
              onClick={() => deleteConfirmId && handleDelete(deleteConfirmId)}
            >
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
