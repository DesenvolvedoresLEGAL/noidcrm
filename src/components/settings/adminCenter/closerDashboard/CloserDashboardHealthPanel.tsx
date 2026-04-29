import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { useCloserDashboardObservability } from '@/hooks/dashboard/useCloserDashboardObservability';
import { CloserDashboardHealthCards } from './CloserDashboardHealthCards';
import { CloserPilotRolloutPanel } from './CloserPilotRolloutPanel';
import { ActiveCloserPilotsList } from './ActiveCloserPilotsList';
import { CloserPerformanceMetrics } from './CloserPerformanceMetrics';
import { CloserDashboardFeedbackSummary } from './CloserDashboardFeedbackSummary';
import { CloserRolloutDecisionCard } from './CloserRolloutDecisionCard';
import { CloserRollbackPanel } from './CloserRollbackPanel';

interface Props {
  tenantId: string;
}

export function CloserDashboardHealthPanel({ tenantId }: Props) {
  const obs = useCloserDashboardObservability(tenantId);

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Saúde do Dashboard Closer</CardTitle>
          <CardDescription>
            Acompanhe uso real, fallback, erros, performance e feedback dos pilotos.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <CloserDashboardHealthCards health={obs.healthSummary} />
        </CardContent>
      </Card>

      <CloserPilotRolloutPanel
        tenantId={tenantId}
        activePilots={obs.activePilots}
        eligibleClosers={obs.eligibleClosers}
        canEnableMore={obs.canEnableMore}
      />

      <ActiveCloserPilotsList tenantId={tenantId} adoption={obs.adoptionByUser} />

      <CloserPerformanceMetrics perf={obs.performanceSummary} />

      <CloserDashboardFeedbackSummary summary={obs.feedbackSummary} list={obs.feedbackList} />

      <CloserRolloutDecisionCard decision={obs.rolloutDecision} />

      <CloserRollbackPanel tenantId={tenantId} />
    </div>
  );
}
