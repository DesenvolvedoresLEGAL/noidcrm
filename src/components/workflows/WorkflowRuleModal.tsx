import { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Plus, Trash2, GripVertical } from 'lucide-react';
import { useOrganizationPipelines } from '@/hooks/useOrganizationPipelines';
import { useCreateWorkflowRule, useUpdateWorkflowRule } from '@/hooks/useWorkflowRules';
import {
  WorkflowRule,
  WorkflowCondition,
  WorkflowAction,
  TRIGGER_TYPE_LABELS,
  ACTION_TYPE_LABELS,
  CONDITION_OPERATOR_LABELS,
} from '@/services/crm/workflow-rules';

interface WorkflowRuleModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  rule: WorkflowRule | null;
}

const TRIGGER_TYPES = Object.keys(TRIGGER_TYPE_LABELS);
const ACTION_TYPES = Object.keys(ACTION_TYPE_LABELS);
const CONDITION_OPERATORS = Object.keys(CONDITION_OPERATOR_LABELS);

const CONDITION_FIELDS = [
  { value: 'valor_previsto', label: 'Valor Previsto' },
  { value: 'prob', label: 'Probabilidade' },
  { value: 'status', label: 'Status' },
  { value: 'temperature', label: 'Temperatura' },
  { value: 'produto', label: 'Produto' },
  { value: 'origem', label: 'Origem' },
];

const ACTIVITY_TYPES = [
  { value: 'follow_up', label: 'Follow-up' },
  { value: 'meeting', label: 'Reunião' },
  { value: 'call', label: 'Ligação' },
  { value: 'email', label: 'E-mail' },
  { value: 'task', label: 'Tarefa' },
];

export function WorkflowRuleModal({ open, onOpenChange, rule }: WorkflowRuleModalProps) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [triggerType, setTriggerType] = useState<string>('stage_enter');
  const [triggerConfig, setTriggerConfig] = useState<any>({});
  const [conditions, setConditions] = useState<WorkflowCondition[]>([]);
  const [actions, setActions] = useState<WorkflowAction[]>([]);
  const [activeTab, setActiveTab] = useState('trigger');

  const { pipelines = [] } = useOrganizationPipelines();
  const createMutation = useCreateWorkflowRule();
  const updateMutation = useUpdateWorkflowRule();

  const selectedPipeline = pipelines.find(p => p.id === triggerConfig.pipeline_id);
  const stages = selectedPipeline?.stages || [];

  useEffect(() => {
    if (rule) {
      setName(rule.name);
      setDescription(rule.description || '');
      setTriggerType(rule.trigger_type);
      setTriggerConfig(rule.trigger_config || {});
      setConditions(rule.conditions || []);
      setActions(rule.actions || []);
    } else {
      setName('');
      setDescription('');
      setTriggerType('stage_enter');
      setTriggerConfig({});
      setConditions([]);
      setActions([]);
    }
    setActiveTab('trigger');
  }, [rule, open]);

  const handleSave = async () => {
    const data = {
      name,
      description,
      trigger_type: triggerType as WorkflowRule['trigger_type'],
      trigger_config: triggerConfig,
      conditions,
      actions,
    };

    if (rule) {
      await updateMutation.mutateAsync({ id: rule.id, rule: data });
    } else {
      await createMutation.mutateAsync(data);
    }
    onOpenChange(false);
  };

  const addCondition = () => {
    setConditions([...conditions, { field: 'valor_previsto', operator: 'greater_than', value: '' }]);
  };

  const updateCondition = (index: number, updates: Partial<WorkflowCondition>) => {
    const newConditions = [...conditions];
    newConditions[index] = { ...newConditions[index], ...updates };
    setConditions(newConditions);
  };

  const removeCondition = (index: number) => {
    setConditions(conditions.filter((_, i) => i !== index));
  };

  const addAction = () => {
    setActions([...actions, { type: 'move_stage', config: {} }]);
  };

  const updateAction = (index: number, updates: Partial<WorkflowAction>) => {
    const newActions = [...actions];
    newActions[index] = { ...newActions[index], ...updates };
    setActions(newActions);
  };

  const removeAction = (index: number) => {
    setActions(actions.filter((_, i) => i !== index));
  };

  const isValid = name && triggerType && actions.length > 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{rule ? 'Editar Regra' : 'Nova Regra de Workflow'}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2">
              <Label>Nome da Regra *</Label>
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Ex: Mover para Negociação após follow-up"
              />
            </div>
            <div className="col-span-2">
              <Label>Descrição</Label>
              <Textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Descreva o que esta regra faz..."
                rows={2}
              />
            </div>
          </div>

          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="trigger">1. Gatilho</TabsTrigger>
              <TabsTrigger value="conditions">2. Condições</TabsTrigger>
              <TabsTrigger value="actions">3. Ações</TabsTrigger>
            </TabsList>

            <TabsContent value="trigger" className="space-y-4 mt-4">
              <div>
                <Label>Tipo de Gatilho *</Label>
                <Select value={triggerType} onValueChange={setTriggerType}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {TRIGGER_TYPES.map((type) => (
                      <SelectItem key={type} value={type}>
                        {TRIGGER_TYPE_LABELS[type]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {(triggerType === 'stage_enter' || triggerType === 'stage_exit') && (
                <>
                  <div>
                    <Label>Pipeline</Label>
                    <Select
                      value={triggerConfig.pipeline_id || '_none'}
                      onValueChange={(v) => setTriggerConfig({ ...triggerConfig, pipeline_id: v === '_none' ? undefined : v, stage_id: undefined })}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Selecione o pipeline" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="_none">Qualquer pipeline</SelectItem>
                        {pipelines.map((p) => (
                          <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  {triggerConfig.pipeline_id && (
                    <div>
                      <Label>Etapa</Label>
                      <Select
                        value={triggerConfig.stage_id || '_none'}
                        onValueChange={(v) => setTriggerConfig({ ...triggerConfig, stage_id: v === '_none' ? undefined : v })}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Selecione a etapa" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="_none">Qualquer etapa</SelectItem>
                          {stages.map((s: any) => (
                            <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  )}
                </>
              )}

              {triggerType === 'activity_completed' && (
                <div>
                  <Label>Tipo de Atividade</Label>
                  <Select
                    value={triggerConfig.activity_type || '_none'}
                    onValueChange={(v) => setTriggerConfig({ ...triggerConfig, activity_type: v === '_none' ? undefined : v })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Qualquer tipo" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="_none">Qualquer tipo</SelectItem>
                      {ACTIVITY_TYPES.map((t) => (
                        <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
            </TabsContent>

            <TabsContent value="conditions" className="space-y-4 mt-4">
              <p className="text-sm text-muted-foreground">
                Condições são opcionais. Se não definidas, a regra será executada sempre que o gatilho disparar.
              </p>

              {conditions.map((condition, index) => (
                <Card key={index}>
                  <CardContent className="pt-4">
                    <div className="flex items-start gap-2">
                      <GripVertical className="h-5 w-5 text-muted-foreground mt-2" />
                      <div className="flex-1 grid grid-cols-3 gap-2">
                        <Select
                          value={condition.field}
                          onValueChange={(v) => updateCondition(index, { field: v })}
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {CONDITION_FIELDS.map((f) => (
                              <SelectItem key={f.value} value={f.value}>{f.label}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>

                        <Select
                          value={condition.operator}
                          onValueChange={(v) => updateCondition(index, { operator: v as WorkflowCondition['operator'] })}
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {CONDITION_OPERATORS.map((op) => (
                              <SelectItem key={op} value={op}>{CONDITION_OPERATOR_LABELS[op]}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>

                        <Input
                          value={condition.value}
                          onChange={(e) => updateCondition(index, { value: e.target.value })}
                          placeholder="Valor"
                        />
                      </div>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => removeCondition(index)}
                      >
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}

              <Button variant="outline" onClick={addCondition} className="w-full">
                <Plus className="h-4 w-4 mr-2" />
                Adicionar Condição
              </Button>
            </TabsContent>

            <TabsContent value="actions" className="space-y-4 mt-4">
              <p className="text-sm text-muted-foreground">
                Defina as ações que serão executadas quando o gatilho disparar.
              </p>

              {actions.map((action, index) => (
                <Card key={index}>
                  <CardContent className="pt-4 space-y-3">
                    <div className="flex items-start gap-2">
                      <GripVertical className="h-5 w-5 text-muted-foreground mt-2" />
                      <div className="flex-1">
                        <Select
                          value={action.type}
                          onValueChange={(v) => updateAction(index, { type: v as WorkflowAction['type'], config: {} })}
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {ACTION_TYPES.map((type) => (
                              <SelectItem key={type} value={type}>{ACTION_TYPE_LABELS[type]}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => removeAction(index)}
                      >
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>

                    {/* Action-specific config */}
                    {action.type === 'move_stage' && (
                      <div className="grid grid-cols-2 gap-2 pl-7">
                        <Select
                          value={action.config.target_pipeline_id || triggerConfig.pipeline_id || '_none'}
                          onValueChange={(v) => updateAction(index, { config: { ...action.config, target_pipeline_id: v === '_none' ? undefined : v } })}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Pipeline" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="_none">Mesmo pipeline</SelectItem>
                            {pipelines.map((p) => (
                              <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>

                        <Select
                          value={action.config.target_stage_id || '_none'}
                          onValueChange={(v) => updateAction(index, { config: { ...action.config, target_stage_id: v === '_none' ? undefined : v } })}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Etapa destino" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="_none">Selecione</SelectItem>
                            {(pipelines.find(p => p.id === (action.config.target_pipeline_id || triggerConfig.pipeline_id))?.stages || []).map((s: any) => (
                              <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    )}

                    {action.type === 'duplicate' && (
                      <div className="grid grid-cols-2 gap-2 pl-7">
                        <Input
                          value={action.config.title_prefix || ''}
                          onChange={(e) => updateAction(index, { config: { ...action.config, title_prefix: e.target.value } })}
                          placeholder="Prefixo do título (ex: Cópia - )"
                        />
                        <Select
                          value={action.config.target_pipeline_id || '_none'}
                          onValueChange={(v) => updateAction(index, { config: { ...action.config, target_pipeline_id: v === '_none' ? undefined : v } })}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Pipeline destino" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="_none">Mesmo pipeline</SelectItem>
                            {pipelines.map((p) => (
                              <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    )}

                    {action.type === 'create_activity' && (
                      <div className="grid grid-cols-2 gap-2 pl-7">
                        <Select
                          value={action.config.activity_type || '_none'}
                          onValueChange={(v) => updateAction(index, { config: { ...action.config, activity_type: v === '_none' ? undefined : v } })}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Tipo de atividade" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="_none">Selecione</SelectItem>
                            {ACTIVITY_TYPES.map((t) => (
                              <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <Input
                          type="number"
                          value={action.config.days_offset || 0}
                          onChange={(e) => updateAction(index, { config: { ...action.config, days_offset: parseInt(e.target.value) || 0 } })}
                          placeholder="Dias para agendar"
                        />
                        <Input
                          className="col-span-2"
                          value={action.config.title || ''}
                          onChange={(e) => updateAction(index, { config: { ...action.config, title: e.target.value } })}
                          placeholder="Título da atividade"
                        />
                      </div>
                    )}

                    {action.type === 'notify_user' && (
                      <div className="grid gap-2 pl-7">
                        <Input
                          value={action.config.title || ''}
                          onChange={(e) => updateAction(index, { config: { ...action.config, title: e.target.value } })}
                          placeholder="Título da notificação"
                        />
                        <Input
                          value={action.config.message || ''}
                          onChange={(e) => updateAction(index, { config: { ...action.config, message: e.target.value } })}
                          placeholder="Mensagem"
                        />
                      </div>
                    )}
                  </CardContent>
                </Card>
              ))}

              <Button variant="outline" onClick={addAction} className="w-full">
                <Plus className="h-4 w-4 mr-2" />
                Adicionar Ação
              </Button>
            </TabsContent>
          </Tabs>

          <div className="flex justify-end gap-2 pt-4 border-t">
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button onClick={handleSave} disabled={!isValid || createMutation.isPending || updateMutation.isPending}>
              {rule ? 'Salvar Alterações' : 'Criar Regra'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
