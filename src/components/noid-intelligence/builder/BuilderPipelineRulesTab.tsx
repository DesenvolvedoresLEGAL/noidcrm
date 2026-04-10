import { Plus, Trash2 } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { usePipelineRules, useUpsertPipelineRule, useDeletePipelineRule } from '@/hooks/useEmailCadence';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import { supabase } from '@/integrations/supabase/client';
import { useQuery } from '@tanstack/react-query';
import { toast } from 'sonner';

interface Props {
  agentId: string;
  disabled?: boolean;
}

export default function BuilderPipelineRulesTab({ agentId, disabled }: Props) {
  const { data: user } = useCurrentUser();
  const orgId = user?.organization?.id;
  const { data: rules, isLoading } = usePipelineRules(agentId);
  const upsertRule = useUpsertPipelineRule();
  const deleteRule = useDeletePipelineRule();

  const { data: pipelines } = useQuery({
    queryKey: ['pipelines-for-rules', orgId],
    queryFn: async () => {
      if (!orgId) return [];
      const { data } = await supabase
        .from('pipelines')
        .select('id, name')
        .eq('organization_id', orgId)
        .order('name');
      return data || [];
    },
    enabled: !!orgId,
  });

  const handleAdd = async () => {
    if (!orgId || !pipelines?.length) return;
    try {
      await upsertRule.mutateAsync({
        organization_id: orgId,
        agent_id: agentId,
        pipeline_id: pipelines[0].id,
        is_enabled: true,
        allow_email_agent: true,
      });
      toast.success('Regra adicionada');
    } catch { toast.error('Erro ao adicionar'); }
  };

  const handleUpdate = async (rule: any, field: string, value: any) => {
    try {
      await upsertRule.mutateAsync({
        id: rule.id,
        organization_id: rule.organization_id,
        agent_id: rule.agent_id,
        pipeline_id: rule.pipeline_id,
        [field]: value,
      });
    } catch { toast.error('Erro ao atualizar'); }
  };

  const handleDelete = async (id: string) => {
    try {
      await deleteRule.mutateAsync(id);
      toast.success('Regra removida');
    } catch { toast.error('Erro ao remover'); }
  };

  if (isLoading) return <p className="text-sm text-muted-foreground">Carregando...</p>;

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold">Regras por Pipeline</h2>
        <p className="text-sm text-muted-foreground">Configure como o Email Agent opera em cada pipeline e etapa.</p>
      </div>

      {!disabled && (
        <Button onClick={handleAdd} disabled={!pipelines?.length}>
          <Plus className="h-4 w-4 mr-1" /> Nova Regra
        </Button>
      )}

      {!rules?.length ? (
        <p className="text-sm text-muted-foreground">Nenhuma regra configurada. O agente usará configurações padrão.</p>
      ) : (
        <div className="space-y-3">
          {rules.map((rule: any) => (
            <Card key={rule.id}>
              <CardContent className="p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Badge variant={rule.is_enabled ? "default" : "secondary"}>
                      {rule.is_enabled ? "Ativo" : "Inativo"}
                    </Badge>
                    <span className="font-medium text-sm">
                      {pipelines?.find((p: any) => p.id === rule.pipeline_id)?.name || 'Pipeline'}
                    </span>
                  </div>
                  {!disabled && (
                    <Button variant="ghost" size="icon" onClick={() => handleDelete(rule.id)}>
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  )}
                </div>

                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <Label className="text-xs">Pipeline</Label>
                    <Select value={rule.pipeline_id} disabled={disabled} onValueChange={(v) => handleUpdate(rule, 'pipeline_id', v)}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {pipelines?.map((p: any) => (
                          <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label className="text-xs">Prioridade</Label>
                    <Input type="number" value={rule.priority} disabled={disabled} onChange={(e) => handleUpdate(rule, 'priority', parseInt(e.target.value))} />
                  </div>
                  <div>
                    <Label className="text-xs">Autonomia Override</Label>
                    <Select value={rule.autonomy_override || 'none'} disabled={disabled} onValueChange={(v) => handleUpdate(rule, 'autonomy_override', v === 'none' ? null : v)}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">Sem override</SelectItem>
                        <SelectItem value="observer">Observador</SelectItem>
                        <SelectItem value="recommender">Recomendador</SelectItem>
                        <SelectItem value="assisted">Assistido</SelectItem>
                        <SelectItem value="autonomous">Autônomo</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="flex gap-4">
                  <div className="flex items-center gap-2">
                    <Switch checked={rule.allow_email_agent} disabled={disabled} onCheckedChange={(v) => handleUpdate(rule, 'allow_email_agent', v)} />
                    <Label className="text-xs">Permitir Email Agent</Label>
                  </div>
                  <div className="flex items-center gap-2">
                    <Switch checked={rule.approval_required || false} disabled={disabled} onCheckedChange={(v) => handleUpdate(rule, 'approval_required', v)} />
                    <Label className="text-xs">Requer Aprovação</Label>
                  </div>
                  <div className="flex items-center gap-2">
                    <Switch checked={rule.is_enabled} disabled={disabled} onCheckedChange={(v) => handleUpdate(rule, 'is_enabled', v)} />
                    <Label className="text-xs">Ativo</Label>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
