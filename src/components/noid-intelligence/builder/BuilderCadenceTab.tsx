import { useState } from 'react';
import { Plus, Trash2, GripVertical, Clock, Mail } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { useCadencePolicies, useCreateCadencePolicy, useDeleteCadencePolicy, useCadenceSteps, useUpsertCadenceStep, useDeleteCadenceStep } from '@/hooks/useEmailCadence';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import { toast } from 'sonner';
import { EMAIL_PURPOSE_LABELS } from '@/types/ai-agents';

interface Props {
  agentId: string;
  disabled?: boolean;
}

export default function BuilderCadenceTab({ agentId, disabled }: Props) {
  const { data: user } = useCurrentUser();
  const { data: policies, isLoading } = useCadencePolicies(agentId);
  const createPolicy = useCreateCadencePolicy();
  const deletePolicy = useDeleteCadencePolicy();
  const [selectedPolicyId, setSelectedPolicyId] = useState<string | null>(null);
  const [newName, setNewName] = useState('');

  const handleCreate = async () => {
    if (!newName.trim() || !user?.organization_id) return;
    try {
      await createPolicy.mutateAsync({
        organization_id: user.organization_id,
        agent_id: agentId,
        name: newName.trim(),
        created_by: user.id,
      });
      setNewName('');
      toast.success('Cadência criada');
    } catch { toast.error('Erro ao criar cadência'); }
  };

  const handleDelete = async (id: string) => {
    try {
      await deletePolicy.mutateAsync(id);
      if (selectedPolicyId === id) setSelectedPolicyId(null);
      toast.success('Cadência removida');
    } catch { toast.error('Erro ao remover'); }
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold">Cadências</h2>
        <p className="text-sm text-muted-foreground">Defina sequências estruturadas de follow-up por estágio.</p>
      </div>

      {!disabled && (
        <div className="flex gap-2">
          <Input placeholder="Nome da cadência" value={newName} onChange={(e) => setNewName(e.target.value)} className="max-w-xs" />
          <Button onClick={handleCreate} disabled={!newName.trim() || createPolicy.isPending}><Plus className="h-4 w-4 mr-1" /> Nova</Button>
        </div>
      )}

      {isLoading ? (
        <p className="text-sm text-muted-foreground">Carregando...</p>
      ) : !policies?.length ? (
        <p className="text-sm text-muted-foreground">Nenhuma cadência configurada.</p>
      ) : (
        <div className="grid gap-3">
          {policies.map((p: any) => (
            <Card key={p.id} className={`cursor-pointer transition-all ${selectedPolicyId === p.id ? 'border-primary' : ''}`} onClick={() => setSelectedPolicyId(p.id)}>
              <CardContent className="p-4 flex items-center justify-between">
                <div>
                  <p className="font-medium">{p.name}</p>
                  <p className="text-xs text-muted-foreground">Tipo: {p.cadence_type} · Max {p.max_steps} steps</p>
                  <div className="flex gap-1 mt-1">
                    {p.stop_on_reply && <Badge variant="secondary" className="text-xs">Stop on reply</Badge>}
                    {p.stop_on_stage_change && <Badge variant="secondary" className="text-xs">Stop on stage change</Badge>}
                  </div>
                </div>
                {!disabled && (
                  <Button variant="ghost" size="icon" onClick={(e) => { e.stopPropagation(); handleDelete(p.id); }}>
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {selectedPolicyId && (
        <>
          <Separator />
          <CadenceStepEditor policyId={selectedPolicyId} agentId={agentId} disabled={disabled} organizationId={user?.organization_id} />
        </>
      )}
    </div>
  );
}

function CadenceStepEditor({ policyId, agentId, disabled, organizationId }: { policyId: string; agentId: string; disabled?: boolean; organizationId?: string }) {
  const { data: steps, isLoading } = useCadenceSteps(policyId);
  const upsertStep = useUpsertCadenceStep();
  const deleteStep = useDeleteCadenceStep();

  const handleAddStep = async () => {
    if (!organizationId) return;
    const nextOrder = (steps?.length || 0) + 1;
    try {
      await upsertStep.mutateAsync({
        organization_id: organizationId,
        cadence_policy_id: policyId,
        step_order: nextOrder,
        step_name: `Step ${nextOrder}`,
        email_purpose: 'follow_up_proposal',
        min_delay_hours: 24,
      });
      toast.success('Step adicionado');
    } catch { toast.error('Erro ao adicionar step'); }
  };

  const handleDeleteStep = async (id: string) => {
    try {
      await deleteStep.mutateAsync(id);
      toast.success('Step removido');
    } catch { toast.error('Erro ao remover step'); }
  };

  const handleUpdateStep = async (step: any, field: string, value: any) => {
    try {
      await upsertStep.mutateAsync({
        id: step.id,
        organization_id: step.organization_id,
        cadence_policy_id: policyId,
        step_order: step.step_order,
        step_name: step.step_name,
        email_purpose: step.email_purpose,
        [field]: value,
      });
    } catch { toast.error('Erro ao atualizar'); }
  };

  if (isLoading) return <p className="text-sm text-muted-foreground">Carregando steps...</p>;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold">Steps da Cadência</h3>
        {!disabled && (
          <Button size="sm" variant="outline" onClick={handleAddStep}><Plus className="h-4 w-4 mr-1" /> Adicionar Step</Button>
        )}
      </div>

      {!steps?.length ? (
        <p className="text-sm text-muted-foreground">Nenhum step configurado.</p>
      ) : (
        <div className="space-y-3">
          {steps.map((step: any, i: number) => (
            <Card key={step.id}>
              <CardContent className="p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <GripVertical className="h-4 w-4 text-muted-foreground" />
                    <Badge variant="outline">#{step.step_order}</Badge>
                    <span className="font-medium text-sm">{step.step_name}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="flex items-center gap-1 text-xs text-muted-foreground">
                      <Clock className="h-3 w-3" /> {step.min_delay_hours}h
                    </div>
                    {!disabled && (
                      <Button variant="ghost" size="icon" onClick={() => handleDeleteStep(step.id)}>
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    )}
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label className="text-xs">Nome</Label>
                    <Input value={step.step_name} disabled={disabled} onChange={(e) => handleUpdateStep(step, 'step_name', e.target.value)} />
                  </div>
                  <div>
                    <Label className="text-xs">Propósito</Label>
                    <Select value={step.email_purpose} disabled={disabled} onValueChange={(v) => handleUpdateStep(step, 'email_purpose', v)}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {Object.entries(EMAIL_PURPOSE_LABELS).map(([k, v]) => (
                          <SelectItem key={k} value={k}>{v}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label className="text-xs">Delay mínimo (horas)</Label>
                    <Input type="number" value={step.min_delay_hours} disabled={disabled} onChange={(e) => handleUpdateStep(step, 'min_delay_hours', parseInt(e.target.value))} />
                  </div>
                  <div>
                    <Label className="text-xs">Angle Guidance</Label>
                    <Input value={step.angle_guidance || ''} disabled={disabled} onChange={(e) => handleUpdateStep(step, 'angle_guidance', e.target.value)} placeholder="Ex: risk_reduction" />
                  </div>
                </div>

                <div>
                  <Label className="text-xs">CTA Guidance</Label>
                  <Textarea value={step.cta_guidance || ''} disabled={disabled} onChange={(e) => handleUpdateStep(step, 'cta_guidance', e.target.value)} rows={2} placeholder="Orientação para o CTA do email" />
                </div>

                {i < (steps.length - 1) && (
                  <div className="flex justify-center">
                    <div className="h-6 w-px bg-border" />
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
