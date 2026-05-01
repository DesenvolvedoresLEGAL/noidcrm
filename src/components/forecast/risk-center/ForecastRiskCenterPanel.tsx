import { format } from 'date-fns';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { AlertTriangle, RefreshCw, Shield } from 'lucide-react';
import { useCurrentOrganization } from '@/hooks/useCurrentOrganization';
import { useForecastRiskCenter } from '@/hooks/forecast/useForecastRiskCenter';
import { ForecastRisksPanel } from '@/components/forecast/ForecastRisksPanel';
import type { ForecastOpportunity } from '@/hooks/useForecastData';
import { RiskSummaryCards } from './RiskSummaryCards';
import { RiskQuickActions } from './RiskQuickActions';
import { RiskGroupsAccordion } from './RiskGroupsAccordion';
import { SellerRiskRankingTable } from './SellerRiskRankingTable';
import { TopDealsLists } from './TopDealsLists';

interface Props {
  periodStart: Date;
  periodEnd: Date;
  pipelineId?: string;
  sellerId?: string | null;
  opportunitiesFallback: ForecastOpportunity[];
}

export function ForecastRiskCenterPanel({ periodStart, periodEnd, pipelineId, sellerId, opportunitiesFallback }: Props) {
  const { organization } = useCurrentOrganization();
  const orgId = organization?.id ?? null;

  const { riskCenter, isLoading, error, refetch } = useForecastRiskCenter({
    organizationId: orgId,
    pipelineId: pipelineId ?? null,
    periodStart: format(periodStart, 'yyyy-MM-dd'),
    periodEnd: format(periodEnd, 'yyyy-MM-dd'),
    sellerId: sellerId ?? null,
    enabled: Boolean(orgId),
  });

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-24" />
        <Skeleton className="h-32" />
        <Skeleton className="h-64" />
      </div>
    );
  }

  if (error || riskCenter?.error) {
    return (
      <div className="space-y-4">
        <Card className="border-amber-500/40 bg-amber-500/5">
          <CardContent className="p-4 flex items-start justify-between gap-3">
            <div className="flex items-start gap-2 text-sm">
              <AlertTriangle className="h-4 w-4 text-amber-600 mt-0.5" />
              <div>
                <div className="font-medium">Não foi possível carregar o Risk Center V2 agora.</div>
                <div className="text-muted-foreground">A visualização legada continua disponível abaixo.</div>
              </div>
            </div>
            <Button size="sm" variant="outline" onClick={() => refetch()}>
              <RefreshCw className="h-3.5 w-3.5 mr-1" /> Tentar novamente
            </Button>
          </CardContent>
        </Card>
        <ForecastRisksPanel opportunities={opportunitiesFallback} />
      </div>
    );
  }

  const noRun = !riskCenter || !riskCenter.metadata?.run_id;
  if (noRun) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Shield className="h-4 w-4 text-muted-foreground" />
            Risk Center em formação
          </CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground">
          Assim que houver cálculo de Forecast no período, o NOID exibirá os riscos financeiros, slipping e problemas de higiene operacional.
        </CardContent>
      </Card>
    );
  }

  const lowSample = (riskCenter.summary?.total_risk_deals ?? 0) < 5;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2">
          <Shield className="h-5 w-5 text-muted-foreground" />
          <h2 className="text-lg font-semibold">Risk Center</h2>
          {lowSample && <Badge variant="outline" className="bg-muted text-muted-foreground">Baixa amostra</Badge>}
          {riskCenter.metadata?.calculation_version && (
            <Badge variant="outline" className="text-[10px]">{riskCenter.metadata.calculation_version}</Badge>
          )}
        </div>
        <Button size="sm" variant="outline" onClick={() => refetch()}>
          <RefreshCw className="h-3.5 w-3.5 mr-1" /> Atualizar
        </Button>
      </div>

      <RiskSummaryCards summary={riskCenter.summary} />

      <section className="space-y-2">
        <h3 className="text-sm font-medium text-muted-foreground">Ações rápidas</h3>
        <RiskQuickActions actions={riskCenter.quick_actions} />
      </section>

      <section className="space-y-2">
        <h3 className="text-sm font-medium text-muted-foreground">Grupos de risco</h3>
        <RiskGroupsAccordion groups={riskCenter.groups} />
      </section>

      <section className="space-y-2">
        <h3 className="text-sm font-medium text-muted-foreground">Ranking de risco por vendedor</h3>
        <SellerRiskRankingTable ranking={riskCenter.seller_risk_ranking} />
      </section>

      <section className="space-y-2">
        <h3 className="text-sm font-medium text-muted-foreground">Deals críticos e recuperáveis</h3>
        <TopDealsLists risky={riskCenter.top_risky_deals} recovery={riskCenter.top_recovery_deals} />
      </section>
    </div>
  );
}
