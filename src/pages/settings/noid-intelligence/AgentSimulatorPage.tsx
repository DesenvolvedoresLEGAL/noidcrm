import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Bot, FlaskConical, MessageSquareMore } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { useBuilderConfig } from '@/hooks/useAgentBuilder';
import { useRunSimulation, useSimulationHistory, useTestScenarios, useSubmitFeedback } from '@/hooks/useAgentSimulator';
import { ENVIRONMENT_LABELS, ENVIRONMENT_COLORS, BUILDER_STATUS_LABELS, BUILDER_STATUS_COLORS } from '@/types/ai-agents';
import type { AgentEnvironment, BuilderStatus, SimulationExecutionMode } from '@/types/ai-agents';
import SimulationScenarioPanel from '@/components/noid-intelligence/simulator/SimulationScenarioPanel';
import SimulationResultsPanel from '@/components/noid-intelligence/simulator/SimulationResultsPanel';
import SimulationFeedbackModal from '@/components/noid-intelligence/simulator/SimulationFeedbackModal';
import SimulationHistoryList from '@/components/noid-intelligence/simulator/SimulationHistoryList';

export default function AgentSimulatorPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { data: config, isLoading } = useBuilderConfig(id);
  const { data: scenarios = [] } = useTestScenarios();
  const { data: history = [] } = useSimulationHistory(id, config?.version?.id);
  const runMutation = useRunSimulation();
  const feedbackMutation = useSubmitFeedback();
  const [result, setResult] = useState<any>(null);
  const [feedbackOpen, setFeedbackOpen] = useState(false);

  const handleRun = async (scenario: Record<string, unknown>, mode: SimulationExecutionMode) => {
    if (!id || !config?.version?.id) return;
    const res = await runMutation.mutateAsync({ agentId: id, versionId: config.version.id, scenario, executionMode: mode });
    setResult(res);
  };

  const handleSelectHistory = (run: any) => {
    setResult({
      run,
      context: run.context_snapshot_json,
      deliberation: run.deliberation_json,
      tool_plan: run.tool_plan_json,
      output_preview: run.output_preview_json,
      validation: run.validation_result_json,
      execution_time_ms: run.execution_time_ms,
      total_tokens: run.total_tokens,
      estimated_cost: run.estimated_cost,
    });
  };

  const handleFeedback = async (rating: number, notes: string) => {
    if (!result?.run?.id) return;
    await feedbackMutation.mutateAsync({ simulation_run_id: result.run.id, rating, notes });
    setFeedbackOpen(false);
  };

  if (isLoading) {
    return <div className="space-y-4 p-6"><Skeleton className="h-8 w-64" /><Skeleton className="h-96 w-full" /></div>;
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
  const agentEnv = (agent as any)?.environment as AgentEnvironment || 'draft';
  const builderStatus = (version as any)?.builder_status as BuilderStatus || 'incomplete';

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" onClick={() => navigate(`/app/settings/noid-intelligence/agents/${id}/builder`)}>
            <ArrowLeft className="h-4 w-4 mr-1" /> Builder
          </Button>
          <div className="flex items-center gap-2">
            <FlaskConical className="h-5 w-5 text-primary" />
            <h1 className="text-lg font-semibold">Simulation Studio</h1>
          </div>
          <div className="flex items-center gap-2">
            <Bot className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm font-medium">{agent.name}</span>
            <Badge className={`text-xs ${ENVIRONMENT_COLORS[agentEnv]}`}>{ENVIRONMENT_LABELS[agentEnv]}</Badge>
            <Badge className={`text-xs ${BUILDER_STATUS_COLORS[builderStatus]}`}>{BUILDER_STATUS_LABELS[builderStatus]}</Badge>
            <span className="text-xs text-muted-foreground">v{version.version_number}</span>
          </div>
        </div>
        {result?.run?.id && (
          <Button variant="outline" size="sm" onClick={() => setFeedbackOpen(true)}>
            <MessageSquareMore className="h-4 w-4 mr-1" /> Feedback
          </Button>
        )}
      </div>

      {/* 2-column layout */}
      <div className="grid grid-cols-1 lg:grid-cols-[320px_1fr] gap-6">
        {/* Left: scenario + history */}
        <div className="space-y-4">
          <SimulationScenarioPanel scenarios={scenarios} onRun={handleRun} running={runMutation.isPending} />
          <SimulationHistoryList history={history} onSelect={handleSelectHistory} />
        </div>

        {/* Right: results */}
        <div>
          <SimulationResultsPanel result={result} />
        </div>
      </div>

      <SimulationFeedbackModal open={feedbackOpen} onOpenChange={setFeedbackOpen} onSubmit={handleFeedback} submitting={feedbackMutation.isPending} />
    </div>
  );
}
