import { CheckCircle, XCircle, AlertTriangle, Bot, Zap, Wrench, Brain, Shield, MessageSquare } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import type { AgentBuilderConfig, BuilderStatus } from '@/types/ai-agents';
import { BUILDER_STATUS_LABELS, BUILDER_STATUS_COLORS, AUTONOMY_LEVEL_LABELS } from '@/types/ai-agents';
import type { AutonomyLevel } from '@/types/ai-agents';

interface Props {
  config: AgentBuilderConfig;
  onValidate: () => void;
  validating: boolean;
  validationResult?: { is_valid: boolean; builder_status: string; errors: string[]; warnings: string[]; summary: Record<string, unknown> } | null;
}

export default function BuilderSummaryTab({ config, onValidate, validating, validationResult }: Props) {
  const { agent, version, triggers, tools, memory, rulesets, prompts, escalation } = config;
  const builderStatus = (version as any)?.builder_status as BuilderStatus || 'incomplete';
  const enabledTools = tools?.filter(t => t.is_enabled) || [];

  const sections = [
    { label: 'Identidade', icon: Bot, ok: !!(agent.name && agent.objective), detail: agent.name || 'Sem nome' },
    { label: 'Escopo', icon: Bot, ok: (agent.agent_scope?.length || 0) > 0, detail: `${agent.agent_scope?.length || 0} escopos` },
    { label: 'Triggers', icon: Zap, ok: (triggers?.length || 0) > 0, detail: `${triggers?.length || 0} configurados` },
    { label: 'Tools', icon: Wrench, ok: enabledTools.length > 0, detail: `${enabledTools.length} habilitadas` },
    { label: 'Memória', icon: Brain, ok: !!memory, detail: memory ? 'Configurada' : 'Não configurada' },
    { label: 'Regras', icon: Shield, ok: !!rulesets, detail: rulesets ? `${(rulesets.rules_json as any[])?.length || 0} regras` : 'Nenhuma' },
    { label: 'Prompts', icon: MessageSquare, ok: !!prompts?.system_prompt, detail: prompts?.system_prompt ? 'System prompt configurado' : 'Sem prompts' },
    { label: 'Escalonamento', icon: AlertTriangle, ok: !!escalation, detail: escalation ? escalation.escalation_mode : 'Não configurado' },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold">Resumo Técnico</h2>
          <p className="text-sm text-muted-foreground">Visão consolidada da configuração do agente</p>
        </div>
        <div className="flex gap-2 items-center">
          <Badge className={BUILDER_STATUS_COLORS[builderStatus]}>{BUILDER_STATUS_LABELS[builderStatus]}</Badge>
          <Button onClick={onValidate} disabled={validating}>
            <CheckCircle className="h-4 w-4 mr-1" /> Validar Configuração
          </Button>
        </div>
      </div>

      {/* Checklist */}
      <Card>
        <CardHeader><CardTitle className="text-sm">Checklist de Completude</CardTitle></CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {sections.map(s => (
              <div key={s.label} className="flex items-center gap-3 p-2 rounded-md bg-muted/30">
                {s.ok ? <CheckCircle className="h-4 w-4 text-green-600" /> : <XCircle className="h-4 w-4 text-muted-foreground/50" />}
                <s.icon className="h-4 w-4 text-muted-foreground" />
                <div>
                  <p className="text-sm font-medium">{s.label}</p>
                  <p className="text-xs text-muted-foreground">{s.detail}</p>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Agent Summary */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader><CardTitle className="text-sm">Agente</CardTitle></CardHeader>
          <CardContent className="space-y-2 text-sm">
            <div><span className="text-muted-foreground">Nome:</span> {agent.name}</div>
            <div><span className="text-muted-foreground">Autonomia:</span> {AUTONOMY_LEVEL_LABELS[agent.autonomy_level as AutonomyLevel]}</div>
            <div><span className="text-muted-foreground">Canal:</span> {agent.primary_channel || '—'}</div>
            <div><span className="text-muted-foreground">Versão:</span> v{version.version_number}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-sm">Métricas</CardTitle></CardHeader>
          <CardContent className="space-y-2 text-sm">
            <div><span className="text-muted-foreground">Triggers:</span> {triggers?.length || 0}</div>
            <div><span className="text-muted-foreground">Tools:</span> {enabledTools.length}</div>
            <div><span className="text-muted-foreground">Regras:</span> {(rulesets?.rules_json as any[])?.length || 0}</div>
            <div><span className="text-muted-foreground">Camadas de prompt:</span> {prompts ? Object.values(prompts).filter(v => typeof v === 'string' && v).length : 0}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-sm">Escalonamento</CardTitle></CardHeader>
          <CardContent className="space-y-2 text-sm">
            <div><span className="text-muted-foreground">Modo:</span> {escalation?.escalation_mode || 'Não configurado'}</div>
            {escalation?.confidence_threshold && (
              <div><span className="text-muted-foreground">Threshold:</span> {escalation.confidence_threshold}</div>
            )}
            {escalation?.risk_threshold && (
              <div><span className="text-muted-foreground">Risco:</span> {escalation.risk_threshold}</div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Validation Results */}
      {validationResult && (
        <Card>
          <CardHeader>
            <CardTitle className="text-sm flex items-center gap-2">
              {validationResult.is_valid ? (
                <><CheckCircle className="h-4 w-4 text-green-600" /> Configuração Válida</>
              ) : (
                <><XCircle className="h-4 w-4 text-destructive" /> Problemas Encontrados</>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {validationResult.errors.length > 0 && (
              <div className="space-y-1">
                <p className="text-xs font-medium text-destructive">Erros Bloqueantes</p>
                {validationResult.errors.map((e, i) => (
                  <div key={i} className="flex items-center gap-2 text-sm text-destructive">
                    <XCircle className="h-3 w-3" /> {e}
                  </div>
                ))}
              </div>
            )}
            {validationResult.warnings.length > 0 && (
              <div className="space-y-1">
                <p className="text-xs font-medium text-yellow-700 dark:text-yellow-400">Avisos</p>
                {validationResult.warnings.map((w, i) => (
                  <div key={i} className="flex items-center gap-2 text-sm text-yellow-700 dark:text-yellow-400">
                    <AlertTriangle className="h-3 w-3" /> {w}
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
