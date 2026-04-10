import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Bot, Save, CheckCircle, Copy, ArrowLeft, Eye, Zap, Wrench, Brain, Shield, MessageSquare, AlertTriangle, LayoutDashboard, FlaskConical, Timer, ThermometerSnowflake, GitBranch } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { useBuilderConfig, useSaveBuilderSection, useValidateBuilder, useDuplicateVersion } from '@/hooks/useAgentBuilder';
import { ENVIRONMENT_LABELS, ENVIRONMENT_COLORS, BUILDER_STATUS_LABELS, BUILDER_STATUS_COLORS } from '@/types/ai-agents';
import type { AgentBuilderSection, AgentEnvironment, BuilderStatus } from '@/types/ai-agents';
import BuilderOverviewTab from '@/components/noid-intelligence/builder/BuilderOverviewTab';
import BuilderTriggersTab from '@/components/noid-intelligence/builder/BuilderTriggersTab';
import BuilderToolsTab from '@/components/noid-intelligence/builder/BuilderToolsTab';
import BuilderMemoryTab from '@/components/noid-intelligence/builder/BuilderMemoryTab';
import BuilderRulesTab from '@/components/noid-intelligence/builder/BuilderRulesTab';
import BuilderPromptsTab from '@/components/noid-intelligence/builder/BuilderPromptsTab';
import BuilderEscalationTab from '@/components/noid-intelligence/builder/BuilderEscalationTab';
import BuilderSummaryTab from '@/components/noid-intelligence/builder/BuilderSummaryTab';
import BuilderCadenceTab from '@/components/noid-intelligence/builder/BuilderCadenceTab';
import BuilderCooldownsTab from '@/components/noid-intelligence/builder/BuilderCooldownsTab';
import BuilderPipelineRulesTab from '@/components/noid-intelligence/builder/BuilderPipelineRulesTab';

type BuilderTab = AgentBuilderSection | 'summary' | 'cadence' | 'cooldowns' | 'pipeline_rules';

const BASE_TABS: { key: BuilderTab; label: string; icon: React.ElementType }[] = [
  { key: 'overview', label: 'Visão Geral', icon: LayoutDashboard },
  { key: 'triggers', label: 'Triggers', icon: Zap },
  { key: 'tools', label: 'Tools', icon: Wrench },
  { key: 'memory', label: 'Memória', icon: Brain },
  { key: 'rules', label: 'Regras', icon: Shield },
  { key: 'prompts', label: 'Prompts', icon: MessageSquare },
  { key: 'escalation', label: 'Escalonamento', icon: AlertTriangle },
  { key: 'summary', label: 'Resumo', icon: Eye },
];

const EMAIL_AGENT_TABS: { key: BuilderTab; label: string; icon: React.ElementType }[] = [
  { key: 'cadence', label: 'Cadência', icon: Timer },
  { key: 'cooldowns', label: 'Cooldowns', icon: ThermometerSnowflake },
  { key: 'pipeline_rules', label: 'Pipeline Rules', icon: GitBranch },
];

export default function AgentBuilderPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<AgentBuilderSection | 'summary'>('overview');
  const { data: config, isLoading } = useBuilderConfig(id);
  const saveMutation = useSaveBuilderSection();
  const validateMutation = useValidateBuilder();
  const duplicateMutation = useDuplicateVersion();

  const handleSave = async (section: AgentBuilderSection, payload: Record<string, unknown>) => {
    if (!id || !config?.version?.id) return;
    await saveMutation.mutateAsync({ agentId: id, versionId: config.version.id, section, payload });
  };

  const handleValidate = async () => {
    if (!id || !config?.version?.id) return;
    await validateMutation.mutateAsync({ agentId: id, versionId: config.version.id });
  };

  const handleDuplicate = async () => {
    if (!id || !config?.version?.id) return;
    await duplicateMutation.mutateAsync({ agentId: id, sourceVersionId: config.version.id });
  };

  if (isLoading) {
    return (
      <div className="space-y-4 p-6">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-96 w-full" />
      </div>
    );
  }

  if (!config) {
    return (
      <div className="text-center py-16">
        <p className="text-muted-foreground">Configuração não encontrada</p>
        <Button variant="outline" className="mt-4" onClick={() => navigate(-1)}>Voltar</Button>
      </div>
    );
  }

  const { agent, version } = config;
  const isPublished = version?.is_published;
  const builderStatus = (version as any)?.builder_status as BuilderStatus || 'incomplete';
  const agentEnv = (agent as any)?.environment as AgentEnvironment || 'draft';

  const completeness = {
    overview: !!(agent.name && agent.objective && agent.agent_scope?.length),
    triggers: (config.triggers?.length || 0) > 0,
    tools: (config.tools?.filter((t) => t.is_enabled)?.length || 0) > 0,
    memory: !!config.memory,
    rules: !!config.rulesets,
    prompts: !!config.prompts?.system_prompt,
    escalation: !!config.escalation,
    summary: true,
  };

  return (
    <div className="flex h-[calc(100vh-8rem)] gap-0 -mx-6 -mt-6">
      {/* Sidebar */}
      <div className="w-56 flex-shrink-0 border-r bg-muted/30 flex flex-col">
        <div className="p-4 border-b space-y-2">
          <Button variant="ghost" size="sm" className="w-full justify-start text-muted-foreground" onClick={() => navigate(`/app/settings/noid-intelligence/agents/${id}`)}>
            <ArrowLeft className="h-4 w-4 mr-2" /> Voltar
          </Button>
          <div className="flex items-center gap-2">
            <Bot className="h-5 w-5 text-primary" />
            <span className="font-semibold text-sm truncate">{agent.name}</span>
          </div>
          <div className="flex gap-1 flex-wrap">
            <Badge className={`text-xs ${ENVIRONMENT_COLORS[agentEnv]}`}>{ENVIRONMENT_LABELS[agentEnv]}</Badge>
            <Badge className={`text-xs ${BUILDER_STATUS_COLORS[builderStatus]}`}>{BUILDER_STATUS_LABELS[builderStatus]}</Badge>
          </div>
          <p className="text-xs text-muted-foreground">v{version.version_number} {isPublished ? '(publicada)' : '(draft)'}</p>
        </div>
        <nav className="flex-1 p-2 space-y-0.5">
          {TABS.map(({ key, label, icon: Icon }) => (
            <button
              key={key}
              onClick={() => setActiveTab(key)}
              className={`w-full flex items-center gap-2 px-3 py-2 text-sm rounded-md transition-colors ${
                activeTab === key ? 'bg-primary/10 text-primary font-medium' : 'text-muted-foreground hover:bg-muted hover:text-foreground'
              }`}
            >
              <Icon className="h-4 w-4 flex-shrink-0" />
              <span className="truncate">{label}</span>
              {key !== 'summary' && (
                <span className={`ml-auto h-2 w-2 rounded-full flex-shrink-0 ${completeness[key as keyof typeof completeness] ? 'bg-green-500' : 'bg-muted-foreground/30'}`} />
              )}
            </button>
          ))}
        </nav>
        <div className="p-3 border-t space-y-2">
          <Button size="sm" className="w-full" variant="default" onClick={() => navigate(`/app/settings/noid-intelligence/agents/${id}/simulator`)}>
            <FlaskConical className="h-4 w-4 mr-1" /> Simular
          </Button>
          <Button size="sm" className="w-full" variant="outline" onClick={handleValidate} disabled={validateMutation.isPending}>
            <CheckCircle className="h-4 w-4 mr-1" /> Validar
          </Button>
          {isPublished && (
            <Button size="sm" className="w-full" variant="outline" onClick={handleDuplicate} disabled={duplicateMutation.isPending}>
              <Copy className="h-4 w-4 mr-1" /> Duplicar como Draft
            </Button>
          )}
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-6">
        {isPublished && (
          <div className="mb-4 p-3 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg text-sm text-yellow-800 dark:text-yellow-300 flex items-center gap-2">
            <AlertTriangle className="h-4 w-4" />
            Esta versão está publicada e não pode ser editada. Duplique para criar uma nova draft.
          </div>
        )}

        {activeTab === 'overview' && <BuilderOverviewTab config={config} onSave={(p) => handleSave('overview', p)} saving={saveMutation.isPending} disabled={!!isPublished} />}
        {activeTab === 'triggers' && <BuilderTriggersTab config={config} onSave={(p) => handleSave('triggers', p)} saving={saveMutation.isPending} disabled={!!isPublished} />}
        {activeTab === 'tools' && <BuilderToolsTab config={config} onSave={(p) => handleSave('tools', p)} saving={saveMutation.isPending} disabled={!!isPublished} />}
        {activeTab === 'memory' && <BuilderMemoryTab config={config} onSave={(p) => handleSave('memory', p)} saving={saveMutation.isPending} disabled={!!isPublished} />}
        {activeTab === 'rules' && <BuilderRulesTab config={config} onSave={(p) => handleSave('rules', p)} saving={saveMutation.isPending} disabled={!!isPublished} />}
        {activeTab === 'prompts' && <BuilderPromptsTab config={config} onSave={(p) => handleSave('prompts', p)} saving={saveMutation.isPending} disabled={!!isPublished} />}
        {activeTab === 'escalation' && <BuilderEscalationTab config={config} onSave={(p) => handleSave('escalation', p)} saving={saveMutation.isPending} disabled={!!isPublished} />}
        {activeTab === 'summary' && <BuilderSummaryTab config={config} onValidate={handleValidate} validating={validateMutation.isPending} validationResult={validateMutation.data} />}
      </div>
    </div>
  );
}
