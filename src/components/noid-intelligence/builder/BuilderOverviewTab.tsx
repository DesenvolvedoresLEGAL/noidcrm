import { useState, useEffect } from 'react';
import { Save } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import type { AgentBuilderConfig, AgentScope } from '@/types/ai-agents';
import { AUTONOMY_LEVEL_LABELS, AGENT_SCOPE_LABELS } from '@/types/ai-agents';

const ALL_SCOPES: AgentScope[] = ['lead','contact','account','opportunity','proposal','activity','pipeline','forecast','playbook','external_signal'];

interface Props {
  config: AgentBuilderConfig;
  onSave: (payload: Record<string, unknown>) => Promise<void>;
  saving: boolean;
  disabled: boolean;
}

export default function BuilderOverviewTab({ config, onSave, saving, disabled }: Props) {
  const { agent } = config;
  const [form, setForm] = useState({
    name: agent.name || '',
    objective: agent.objective || '',
    description: agent.description || '',
    autonomy_level: agent.autonomy_level || 'observer',
    agent_scope: [...(agent.agent_scope || [])],
    primary_channel: agent.primary_channel || '',
  });

  useEffect(() => {
    setForm({
      name: agent.name || '',
      objective: agent.objective || '',
      description: agent.description || '',
      autonomy_level: agent.autonomy_level || 'observer',
      agent_scope: [...(agent.agent_scope || [])],
      primary_channel: agent.primary_channel || '',
    });
  }, [agent]);

  const toggleScope = (scope: AgentScope) => {
    setForm(f => ({
      ...f,
      agent_scope: f.agent_scope.includes(scope)
        ? f.agent_scope.filter(s => s !== scope)
        : [...f.agent_scope, scope],
    }));
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">Visão Geral</h2>
        {!disabled && (
          <Button onClick={() => onSave(form)} disabled={saving}>
            <Save className="h-4 w-4 mr-2" /> Salvar
          </Button>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card>
          <CardHeader><CardTitle className="text-sm">Identidade</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>Nome do Agente</Label>
              <Input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} disabled={disabled} />
            </div>
            <div className="space-y-2">
              <Label>Objetivo Principal</Label>
              <Textarea value={form.objective} onChange={e => setForm(f => ({ ...f, objective: e.target.value }))} disabled={disabled} rows={3} placeholder="O que este agente deve alcançar?" />
            </div>
            <div className="space-y-2">
              <Label>Descrição Operacional</Label>
              <Textarea value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} disabled={disabled} rows={3} placeholder="Como ele funciona operacionalmente?" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-sm">Configuração</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>Nível de Autonomia</Label>
              <Select value={form.autonomy_level} onValueChange={v => setForm(f => ({ ...f, autonomy_level: v as typeof f.autonomy_level }))} disabled={disabled}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {Object.entries(AUTONOMY_LEVEL_LABELS).map(([k, v]) => (
                    <SelectItem key={k} value={k}>{v}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Canal Principal</Label>
              <Input value={form.primary_channel} onChange={e => setForm(f => ({ ...f, primary_channel: e.target.value }))} disabled={disabled} placeholder="ex: email, slack, whatsapp" />
            </div>
            <div className="space-y-2">
              <Label>Escopo do Agente</Label>
              <div className="flex flex-wrap gap-2">
                {ALL_SCOPES.map(scope => (
                  <Badge
                    key={scope}
                    variant={form.agent_scope.includes(scope) ? 'default' : 'outline'}
                    className={`cursor-pointer ${disabled ? 'pointer-events-none opacity-60' : ''}`}
                    onClick={() => !disabled && toggleScope(scope)}
                  >
                    {AGENT_SCOPE_LABELS[scope]}
                  </Badge>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
