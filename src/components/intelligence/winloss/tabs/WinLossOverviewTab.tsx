import { LossAnalysisSection } from './LossAnalysisSection';
import { WinAnalysisSection } from './WinAnalysisSection';
import { SalesCycleSection } from './SalesCycleSection';
import { MonthlyPulseCards } from '../MonthlyPulseCards';
import { AIDiagnosisCard } from '../AIDiagnosisCard';
import { MonthSignalsCard } from '../MonthSignalsCard';
import { SmartAlertsCard } from '@/components/intelligence/SmartAlertsCard';
import { LossReasonsTrendChart } from '@/components/intelligence/LossReasonsTrendChart';
import type { WinLossDataResult, TimeframePreset, DateRange } from '@/hooks/useWinLossData';

interface Props {
  data: WinLossDataResult | undefined;
  isLoading: boolean;
  organizationId: string;
  pipelineContext: 'qualification' | 'sales' | 'onboarding';
  terminology: { lostPlural: string };
  timeframe: TimeframePreset;
  dateRange: DateRange;
}

export function WinLossOverviewTab({ data, isLoading, pipelineContext, terminology, timeframe, dateRange }: Props) {
  const showMonthlyPulse = timeframe !== 'month';
  const showTrend = timeframe !== 'month';

  return (
    <div className="space-y-6">
      {/* 1. Diagnóstico Executivo da IA */}
      <AIDiagnosisCard data={data} dateRange={dateRange} />

      {/* 2. Alertas Inteligentes */}
      <SmartAlertsCard
        losses={data?.losses || []}
        lossReasons={data?.lossReasons || []}
        isLoading={isLoading}
        contextLabel={terminology.lostPlural}
      />

      {/* 3. Pulso Mensal (oculto no filtro Mês) */}
      {showMonthlyPulse && data && data.monthlyPulse.length > 0 && (
        <MonthlyPulseCards data={data.monthlyPulse} />
      )}

      {/* 4. Análise de Perdas */}
      <LossAnalysisSection
        data={data}
        isLoading={isLoading}
        lostLabel={terminology.lostPlural}
        dateRange={dateRange}
      />

      {/* 5. Análise de Ganhos */}
      <WinAnalysisSection data={data} isLoading={isLoading} />

      {/* 6. Ciclo de Venda */}
      <SalesCycleSection data={data} isLoading={isLoading} />

      {/* 7. Tendência ou Sinais do Mês */}
      {showTrend ? (
        <LossReasonsTrendChart losses={data?.losses || []} isLoading={isLoading} />
      ) : (
        <MonthSignalsCard data={data} dateRange={dateRange} />
      )}
    </div>
  );
}
