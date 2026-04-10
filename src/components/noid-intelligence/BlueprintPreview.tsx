import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { AlertTriangle, Info, ArrowLeft, Sparkles, X, Zap, Wrench, ShieldAlert } from 'lucide-react';
import { useCreateAIAgent } from '@/hooks/useAIAgents';
import { AUTONOMY_LEVEL_LABELS, AGENT_SCOPE_LABELS, AGENT_TYPE_LABELS } from '@/types/ai-agents';
import type { AgentBlueprint, AutonomyLevel, AgentScope, CreateAgentFromBlueprintPayload } from '@/types/ai-agents';

interface BlueprintPreviewProps {
  blueprint: AgentBlueprint;
  onBack: () => void;
  onRefine: () => void;
}

const ALL_SCOPES: AgentScope[] = [
  'lead', 'contact', 'account', 'opportunity', 'proposal',
  'activity', 'pipeline', 'forecast', 'playbook', 'external_signal',
];

export default function BlueprintPreview({ blueprint, onBack, onRefine }: BlueprintPreviewProps) {
  const navigate = useNavigate();
  const createMutation = useCreateAIAgent();

  const [name, setName] = useState(blueprint.name);
  const [objective, setObjective] = useState(blueprint.objective);
  const [description, setDescription] = useState(blueprint.description);
  const [autonomyLevel, setAutonomyLevel] = useState<AutonomyLevel>(blueprint.autonomy_level);
  const [agentScope, setAgentScope] = useState<AgentScope[]>(blueprint.agent_scope || []);
  const [primaryChannel, setPrimaryChannel] = useState(blueprint.primary_channel || '');
  const [promptSystem, setPromptSystem] = useState(blueprint.prompts?.system || '');
  const [promptDeliberation, setPromptDeliberation] = useState(blueprint.prompts?.deliberation || '');
  const [promptGeneration, setPromptGeneration] = useState(blueprint.prompts?.generation || '');
  const [promptReview, setPromptReview] = useState(blueprint.prompts?.review || '');

  const toggleScope = (scope: AgentScope) => {
    setAgentScope((prev) =>
      prev.includes(scope) ? prev.filter((s) => s !== scope) : [...prev, scope]
    );
  };

  const handleCreate = async () => {
    if (!name.trim()) return;

    const payload: CreateAgentFromBlueprintPayload = {
      name: name.trim(),
      description: description.trim() || undefined,
      objective: objective.trim() || undefined,
      autonomy_level: autonomyLevel,
      agent_scope: agentScope,
      primary_channel: primaryChannel.trim() || undefined,
      prompt_system: promptSystem.trim() || undefined,
      prompt_deliberation: promptDeliberation.trim() || undefined,
      prompt_generation: promptGeneration.trim() || undefined,
      prompt_review: promptReview.trim() || undefined,
      source_type: blueprint.source_type,
      source_text: blueprint.source_text,
    };

    const result = await createMutation.mutateAsync(payload);
    if (result?.agent?.id) {
      navigate(`/app/settings/noid-intelligence/agents/${result.agent.id}`);
    } else {
      navigate('/app/settings/noid-intelligence/agents');
    }
  };

  const hasWarnings = blueprint.warnings && blueprint.warnings.length > 0;
  const hasMissing = blueprint.missing_info && blueprint.missing_info.length > 0;

  return (
    <div className="space-y-6">
      {/* Alerts */}
      {(hasWarnings || hasMissing) && (
        <div className="space-y-3">
          {hasWarnings && (
            <Card className="border-amber-500/30 bg-amber-500/5">
              <CardContent className="p-4 flex gap-3">
                <AlertTriangle className="h-5 w-5 text-amber-500 shrink-0 mt-0.5" />
                <div className="space-y-1">
                  <p className="font-medium text-sm text-amber-600">Alertas</p>
                  <ul className="text-sm text-muted-foreground space-y-1">
                    {blueprint.warnings!.map((w, i) => <li key={i}>• {w}</li>)}
                  </ul>
                </div>
              </CardContent>
            </Card>
          )}
          {hasMissing && (
            <Card className="border-blue-500/30 bg-blue-500/5">
              <CardContent className="p-4 flex gap-3">
                <Info className="h-5 w-5 text-blue-500 shrink-0 mt-0.5" />
                <div className="space-y-1">
                  <p className="font-medium text-sm text-blue-600">Informações pendentes</p>
                  <ul className="text-sm text-muted-foreground space-y-1">
                    {blueprint.missing_info!.map((m, i) => <li key={i}>• {m}</li>)}
                  </ul>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      )}

      {/* Basic Info */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            Informações Básicas
            {blueprint.suggested_type && (
              <Badge variant="secondary" className="text-xs font-normal">
                {AGENT_TYPE_LABELS[blueprint.suggested_type] || blueprint.suggested_type}
              </Badge>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>Nome</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label>Objetivo</Label>
            <Textarea value={objective} onChange={(e) => setObjective(e.target.value)} rows={2} />
          </div>
          <div className="space-y-2">
            <Label>Descrição</Label>
            <Textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={3} />
          </div>
        </CardContent>
      </Card>

      {/* Configuration */}
      <Card>
        <CardHeader><CardTitle className="text-lg">Configuração</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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
              <Label>Canal Principal</Label>
              <Input value={primaryChannel} onChange={(e) => setPrimaryChannel(e.target.value)} placeholder="Ex: email, whatsapp" />
            </div>
          </div>
          <div className="space-y-2">
            <Label>Escopo</Label>
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
        </CardContent>
      </Card>

      {/* Prompts */}
      <Card>
        <CardHeader><CardTitle className="text-lg">Prompts do Agente</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>System Prompt</Label>
            <Textarea value={promptSystem} onChange={(e) => setPromptSystem(e.target.value)} rows={4} className="font-mono text-xs" placeholder="Instruções base do agente..." />
          </div>
          <div className="space-y-2">
            <Label>Prompt de Deliberação</Label>
            <Textarea value={promptDeliberation} onChange={(e) => setPromptDeliberation(e.target.value)} rows={3} className="font-mono text-xs" placeholder="Como o agente deve raciocinar..." />
          </div>
          <div className="space-y-2">
            <Label>Prompt de Geração</Label>
            <Textarea value={promptGeneration} onChange={(e) => setPromptGeneration(e.target.value)} rows={3} className="font-mono text-xs" placeholder="Como o agente deve gerar conteúdo..." />
          </div>
          <div className="space-y-2">
            <Label>Prompt de Revisão</Label>
            <Textarea value={promptReview} onChange={(e) => setPromptReview(e.target.value)} rows={3} className="font-mono text-xs" placeholder="Como o agente deve revisar outputs..." />
          </div>
        </CardContent>
      </Card>

      {/* Suggestions (read-only) */}
      {(blueprint.suggested_triggers?.length || blueprint.suggested_tools?.length || blueprint.suggested_rules?.length || blueprint.escalation_criteria?.length) && (
        <Card>
          <CardHeader><CardTitle className="text-lg">Sugestões da IA</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            {blueprint.suggested_triggers && blueprint.suggested_triggers.length > 0 && (
              <div className="space-y-2">
                <Label className="flex items-center gap-2"><Zap className="h-4 w-4" /> Triggers Sugeridos</Label>
                <div className="space-y-1">
                  {blueprint.suggested_triggers.map((t, i) => (
                    <div key={i} className="text-sm bg-muted/50 rounded-md p-2">
                      <span className="font-medium">{t.event}</span>
                      {t.condition && <span className="text-muted-foreground"> — {t.condition}</span>}
                      <p className="text-muted-foreground text-xs mt-0.5">{t.description}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}
            {blueprint.suggested_tools && blueprint.suggested_tools.length > 0 && (
              <div className="space-y-2">
                <Label className="flex items-center gap-2"><Wrench className="h-4 w-4" /> Ferramentas Sugeridas</Label>
                <div className="flex flex-wrap gap-2">
                  {blueprint.suggested_tools.map((t, i) => (
                    <Badge key={i} variant="secondary">{t}</Badge>
                  ))}
                </div>
              </div>
            )}
            {blueprint.escalation_criteria && blueprint.escalation_criteria.length > 0 && (
              <div className="space-y-2">
                <Label className="flex items-center gap-2"><ShieldAlert className="h-4 w-4" /> Escalonamento</Label>
                <ul className="text-sm text-muted-foreground space-y-1">
                  {blueprint.escalation_criteria.map((c, i) => <li key={i}>• {c}</li>)}
                </ul>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Actions */}
      <div className="flex justify-between">
        <div className="flex gap-2">
          <Button variant="outline" onClick={onBack} className="gap-2">
            <ArrowLeft className="h-4 w-4" /> Voltar
          </Button>
          <Button variant="ghost" onClick={onRefine} className="gap-2">
            <Sparkles className="h-4 w-4" /> Refinar com IA
          </Button>
        </div>
        <Button onClick={handleCreate} disabled={!name.trim() || createMutation.isPending}>
          {createMutation.isPending ? 'Criando...' : 'Criar Agente em Draft'}
        </Button>
      </div>
    </div>
  );
}
