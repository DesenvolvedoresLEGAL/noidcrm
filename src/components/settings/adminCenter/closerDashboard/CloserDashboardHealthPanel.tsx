import { Alert, AlertDescription } from '@/components/ui/alert';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Info } from 'lucide-react';
import { useCloserDashboardObservability } from '@/hooks/dashboard/useCloserDashboardObservability';
import { CloserDashboardHealthCards } from './CloserDashboardHealthCards';
import { CloserPilotRolloutPanel } from './CloserPilotRolloutPanel';
import { ActiveCloserPilotsList } from './ActiveCloserPilotsList';
import { CloserPerformanceMetrics } from './CloserPerformanceMetrics';
import { CloserDashboardFeedbackSummary } from './CloserDashboardFeedbackSummary';
import { CloserRolloutDecisionCard } from './CloserRolloutDecisionCard';
import { CloserRollbackPanel } from './CloserRollbackPanel';
import { CloserDashboardAuditTable } from './CloserDashboardAuditTable';
import { CloserDashboardReconciliation } from './CloserDashboardReconciliation';
import { CloserHomologationChecklist } from './CloserHomologationChecklist';
import { CloserRunbookCard } from './CloserRunbookCard';

interface Props {
  tenantId: string;
}

export function CloserDashboardHealthPanel({ tenantId }: Props) {
  const obs = useCloserDashboardObservability(tenantId);

  return (
    <div className="space-y-4">
      <Alert>
        <Info className="h-4 w-4" />
        <AlertDescription>
          <strong>Importante:</strong> o nome comercial da tela é{' '}
          <strong>Dashboard Comercial</strong>. A função técnica usada pelo NOID continua sendo{' '}
          <strong>Closer</strong>, pois representa o usuário responsável por fechamento.
        </AlertDescription>
      </Alert>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Saúde do Dashboard Comercial</CardTitle>
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

      <CloserDashboardAuditTable
        tenantId={tenantId}
        activePilots={obs.activePilots}
        eligibleClosers={obs.eligibleClosers}
      />

      <CloserDashboardReconciliation
        tenantId={tenantId}
        activePilots={obs.activePilots}
        eligibleClosers={obs.eligibleClosers}
      />

      <CloserHomologationChecklist
        tenantId={tenantId}
        activePilots={obs.activePilots}
        eligibleClosers={obs.eligibleClosers}
        health={obs.healthSummary}
        feedback={obs.feedbackSummary}
        onRefetch={obs.refetch}
      />

      <CloserRunbookCard />

      <CloserRolloutDecisionCard decision={obs.rolloutDecision} />

      <CloserRollbackPanel tenantId={tenantId} />
    </div>
  );
}
