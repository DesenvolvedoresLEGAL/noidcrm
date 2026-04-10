import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useCreateAIAgent } from '@/hooks/useAIAgents';
import { AUTONOMY_LEVEL_LABELS, AGENT_SCOPE_LABELS } from '@/types/ai-agents';
import type { AutonomyLevel, AgentScope, CreateAgentPayload } from '@/types/ai-agents';
import { X } from 'lucide-react';

const ALL_SCOPES: AgentScope[] = [
  'lead', 'contact', 'account', 'opportunity', 'proposal',
  'activity', 'pipeline', 'forecast', 'playbook', 'external_signal',
];

export default function ManualCreationMode() {
  const navigate = useNavigate();
  const createMutation = useCreateAIAgent();

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [objective, setObjective] = useState('');
  const [autonomyLevel, setAutonomyLevel] = useState<AutonomyLevel>('observer');
  const [agentScope, setAgentScope] = useState<AgentScope[]>([]);
  const [primaryChannel, setPrimaryChannel] = useState('');

  const toggleScope = (scope: AgentScope) => {
    setAgentScope((prev) =>
      prev.includes(scope) ? prev.filter((s) => s !== scope) : [...prev, scope]
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    const payload: CreateAgentPayload = {
      name: name.trim(),
      description: description.trim() || undefined,
      objective: objective.trim() || undefined,
      autonomy_level: autonomyLevel,
      agent_scope: agentScope,
      primary_channel: primaryChannel.trim() || undefined,
    };

    const result = await createMutation.mutateAsync(payload);
    if (result?.agent?.id) {
      navigate(`/app/settings/noid-intelligence/agents/${result.agent.id}`);
    } else {
      navigate('/app/settings/noid-intelligence/agents');
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Informações básicas</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="name">Nome *</Label>
            <Input id="name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Ex: Email Follow-up Agent" required />
          </div>
          <div className="space-y-2">
            <Label htmlFor="objective">Objetivo</Label>
            <Textarea id="objective" value={objective} onChange={(e) => setObjective(e.target.value)} placeholder="Descreva o objetivo principal..." rows={2} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="description">Descrição</Label>
            <Textarea id="description" value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Descrição opcional..." rows={2} />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Configuração</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>Nível de Autonomia</Label>
            <Select value={autonomyLevel} onValueChange={(v) => setAutonomyLevel(v as AutonomyLevel)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {Object.entries(AUTONOMY_LEVEL_LABELS).map(([k, v]) => (
                  <SelectItem key={k} value={k}>{v}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Escopo do Agente</Label>
            <div className="flex flex-wrap gap-2">
              {ALL_SCOPES.map((scope) => (
                <Badge
                  key={scope}
                  variant={agentScope.includes(scope) ? 'default' : 'outline'}
                  className="cursor-pointer select-none"
                  onClick={() => toggleScope(scope)}
                >
                  {AGENT_SCOPE_LABELS[scope]}
                  {agentScope.includes(scope) && <X className="h-3 w-3 ml-1" />}
                </Badge>
              ))}
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="channel">Canal Principal</Label>
            <Input id="channel" value={primaryChannel} onChange={(e) => setPrimaryChannel(e.target.value)} placeholder="Ex: email, whatsapp, internal" />
          </div>
        </CardContent>
      </Card>

      <div className="flex justify-end gap-3">
        <Button type="submit" disabled={!name.trim() || createMutation.isPending}>
          {createMutation.isPending ? 'Criando...' : 'Criar Agente'}
        </Button>
      </div>
    </form>
  );
}
