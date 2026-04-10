import { useState, useEffect } from 'react';
import { Save, Plus, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import type { AgentBuilderConfig, AIAgentTrigger, TriggerKind } from '@/types/ai-agents';
import { TRIGGER_KIND_LABELS, AGENT_SCOPE_LABELS } from '@/types/ai-agents';

const ENTITY_TYPES = ['lead','contact','account','opportunity','proposal','activity','pipeline','forecast','playbook','external_signal'];
const EVENT_EXAMPLES = ['proposal_viewed','opportunity_stalled','activity_due','stage_changed','no_response_timeout','meeting_completed','deal_won','deal_lost'];

const emptyTrigger = (): AIAgentTrigger => ({
  trigger_kind: 'event',
  trigger_name: '',
  entity_type: null,
  event_name: null,
  schedule_cron: null,
  condition_json: {},
  priority: 100,
  is_active: true,
});

interface Props {
  config: AgentBuilderConfig;
  onSave: (payload: Record<string, unknown>) => Promise<void>;
  saving: boolean;
  disabled: boolean;
}

export default function BuilderTriggersTab({ config, onSave, saving, disabled }: Props) {
  const [triggers, setTriggers] = useState<AIAgentTrigger[]>(config.triggers || []);

  useEffect(() => { setTriggers(config.triggers || []); }, [config.triggers]);

  const addTrigger = () => setTriggers([...triggers, emptyTrigger()]);
  const removeTrigger = (idx: number) => setTriggers(triggers.filter((_, i) => i !== idx));
  const updateTrigger = (idx: number, partial: Partial<AIAgentTrigger>) => {
    setTriggers(triggers.map((t, i) => i === idx ? { ...t, ...partial } : t));
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold">Triggers</h2>
          <p className="text-sm text-muted-foreground">Configure quando o agente entra em ação</p>
        </div>
        <div className="flex gap-2">
          {!disabled && (
            <>
              <Button variant="outline" onClick={addTrigger}><Plus className="h-4 w-4 mr-1" /> Adicionar</Button>
              <Button onClick={() => onSave({ triggers })} disabled={saving}><Save className="h-4 w-4 mr-1" /> Salvar</Button>
            </>
          )}
        </div>
      </div>

      {triggers.length === 0 && (
        <Card>
          <CardContent className="py-8 text-center text-muted-foreground">
            Nenhum trigger configurado. Adicione pelo menos um trigger.
          </CardContent>
        </Card>
      )}

      {triggers.map((trigger, idx) => (
        <Card key={idx}>
          <CardHeader className="flex flex-row items-center justify-between py-3">
            <CardTitle className="text-sm">{trigger.trigger_name || `Trigger ${idx + 1}`}</CardTitle>
            <div className="flex items-center gap-2">
              <Switch checked={trigger.is_active} onCheckedChange={v => updateTrigger(idx, { is_active: v })} disabled={disabled} />
              {!disabled && (
                <Button variant="ghost" size="sm" onClick={() => removeTrigger(idx)}>
                  <Trash2 className="h-4 w-4 text-destructive" />
                </Button>
              )}
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div className="space-y-1">
                <Label className="text-xs">Nome</Label>
                <Input value={trigger.trigger_name} onChange={e => updateTrigger(idx, { trigger_name: e.target.value })} disabled={disabled} placeholder="Nome do trigger" />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Tipo</Label>
                <Select value={trigger.trigger_kind} onValueChange={v => updateTrigger(idx, { trigger_kind: v as TriggerKind })} disabled={disabled}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {Object.entries(TRIGGER_KIND_LABELS).map(([k, v]) => (
                      <SelectItem key={k} value={k}>{v}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Prioridade</Label>
                <Input type="number" value={trigger.priority} onChange={e => updateTrigger(idx, { priority: Number(e.target.value) })} disabled={disabled} />
              </div>
            </div>

            {(trigger.trigger_kind === 'event' || trigger.trigger_kind === 'hybrid') && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label className="text-xs">Entidade</Label>
                  <Select value={trigger.entity_type || ''} onValueChange={v => updateTrigger(idx, { entity_type: v })} disabled={disabled}>
                    <SelectTrigger><SelectValue placeholder="Selecionar" /></SelectTrigger>
                    <SelectContent>
                      {ENTITY_TYPES.map(t => (
                        <SelectItem key={t} value={t}>{AGENT_SCOPE_LABELS[t as keyof typeof AGENT_SCOPE_LABELS] || t}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Evento</Label>
                  <Select value={trigger.event_name || ''} onValueChange={v => updateTrigger(idx, { event_name: v })} disabled={disabled}>
                    <SelectTrigger><SelectValue placeholder="Selecionar evento" /></SelectTrigger>
                    <SelectContent>
                      {EVENT_EXAMPLES.map(e => (
                        <SelectItem key={e} value={e}>{e}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            )}

            {(trigger.trigger_kind === 'schedule' || trigger.trigger_kind === 'hybrid') && (
              <div className="space-y-1">
                <Label className="text-xs">CRON / Frequência</Label>
                <Input value={trigger.schedule_cron || ''} onChange={e => updateTrigger(idx, { schedule_cron: e.target.value })} disabled={disabled} placeholder="ex: 0 9 * * 1-5" />
              </div>
            )}
          </CardContent>
        </Card>
      ))}

      {!disabled && triggers.length > 0 && (
        <div className="flex flex-wrap gap-2">
          <p className="text-xs text-muted-foreground mr-2">Templates rápidos:</p>
          {[
            { name: 'Proposta sem resposta', kind: 'event' as TriggerKind, entity: 'proposal', event: 'no_response_timeout' },
            { name: 'Oportunidade parada', kind: 'event' as TriggerKind, entity: 'opportunity', event: 'opportunity_stalled' },
            { name: 'Atividade vencida', kind: 'event' as TriggerKind, entity: 'activity', event: 'activity_due' },
          ].map(tpl => (
            <Badge
              key={tpl.name}
              variant="outline"
              className="cursor-pointer hover:bg-primary/10"
              onClick={() => setTriggers([...triggers, { ...emptyTrigger(), trigger_name: tpl.name, trigger_kind: tpl.kind, entity_type: tpl.entity, event_name: tpl.event }])}
            >
              + {tpl.name}
            </Badge>
          ))}
        </div>
      )}
    </div>
  );
}
