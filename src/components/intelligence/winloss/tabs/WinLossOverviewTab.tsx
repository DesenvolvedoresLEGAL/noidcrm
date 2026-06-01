// Sprint WL-UI-02 — Cockpit executivo de Win/Loss (ajuste fino).
// Ordem: Diagnóstico IA → Alertas → Trust + Recuperável + Falha Comercial
// → O que mais gera vitória → Pulso do Período → Ciclo de Venda.
import { useMemo } from 'react';
import { SalesCycleSection } from './SalesCycleSection';
import { MonthlyPulseCards } from '../MonthlyPulseCards';
import { AIDiagnosisCard } from '../AIDiagnosisCard';
import { SmartAlertsCard } from '@/components/intelligence/SmartAlertsCard';
import { CrmTrustAndRecoverableStrip } from '../CrmTrustAndRecoverableStrip';
import { WinDriversBlock } from '../WinDriversBlock';
import { useLossSemantic } from '@/hooks/useLossSemantic';
import { buildCommercialFailureSummary } from '@/lib/winloss/diagnosis';
import type { WinLossDataResult, TimeframePreset, DateRange } from '@/hooks/useWinLossData';

interface Props {
  data: WinLossDataResult | undefined;
  isLoading: boolean;
  organizationId: string;
  pipelineContext: 'qualification' | 'sales' | 'onboarding';
  terminology: { lostPlural: string };
  timeframe: TimeframePreset;
  dateRange: DateRange;
  pipelineId?: string | null;
}

export function WinLossOverviewTab({
  data,
  isLoading,
  organizationId,
  terminology,
  timeframe,
  dateRange,
  pipelineId = null,
}: Props) {
  const showMonthlyPulse =
    timeframe !== 'today' && timeframe !== '7d' && timeframe !== '15d' && timeframe !== 'month';

  const { data: semantic } = useLossSemantic(organizationId, pipelineId, dateRange);

  const commercialFailure = useMemo(
    () => (data ? buildCommercialFailureSummary(data) : undefined),
    [data],
  );

  return (
    <div className="space-y-6">
      {/* 1. Diagnóstico Executivo da IA — cockpit (3 blocos + footer) */}
      <AIDiagnosisCard data={data} dateRange={dateRange} semantic={semantic} />

      {/* 2. Alertas Inteligentes (máx 3, ordenados por severidade) */}
      <SmartAlertsCard
        losses={data?.losses || []}
        lossReasons={data?.lossReasons || []}
        isLoading={isLoading}
        contextLabel={terminology.lostPlural}
        semantic={semantic}
      />

      {/* 3. CRM Trust + Receita Recuperável + Perda por Falha Comercial */}
      <CrmTrustAndRecoverableStrip
        semantic={semantic}
        commercialFailure={commercialFailure}
        isLoading={isLoading}
      />

      {/* 4. O que mais gera vitória (compacto) */}
      <WinDriversBlock data={data} />

      {/* 5. Pulso do Período */}
      {showMonthlyPulse && data && data.monthlyPulse.length > 0 && (
        <MonthlyPulseCards data={data.monthlyPulse} />
      )}

      {/* 6. Ciclo de Venda */}
      <SalesCycleSection data={data} isLoading={isLoading} />
    </div>
  );
}
