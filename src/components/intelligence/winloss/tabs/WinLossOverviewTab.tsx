import { LossAnalysisSection } from './LossAnalysisSection';
import { WinAnalysisSection } from './WinAnalysisSection';
import { SalesCycleSection } from './SalesCycleSection';
import { MonthlyPulseCards } from '../MonthlyPulseCards';
import { AIDiagnosisCard } from '../AIDiagnosisCard';
import { MonthSignalsCard } from '../MonthSignalsCard';
import { SmartAlertsCard } from '@/components/intelligence/SmartAlertsCard';
import { LossReasonsTrendChart } from '@/components/intelligence/LossReasonsTrendChart';
import { CrmTrustAndRecoverableStrip } from '../CrmTrustAndRecoverableStrip';
import { HiddenReasonsBlock } from '../HiddenReasonsBlock';
import { SellerCustomerGapBlock } from '../SellerCustomerGapBlock';
import { CompetitiveRadarBlock } from '../CompetitiveRadarBlock';
import { WinDriversBlock } from '../WinDriversBlock';
import { useLossSemantic } from '@/hooks/useLossSemantic';
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

export function WinLossOverviewTab({ data, isLoading, organizationId, terminology, timeframe, dateRange, pipelineId = null }: Props) {
  const showMonthlyPulse = timeframe !== 'month';
  const showTrend = timeframe !== 'month';

  const { data: semantic } = useLossSemantic(organizationId, pipelineId, dateRange);

  return (
    <div className="space-y-6">
      {/* 1. Diagnóstico Executivo da IA (humano × IA) */}
      <AIDiagnosisCard data={data} dateRange={dateRange} semantic={semantic} />

      {/* 2. Alertas Inteligentes (heurísticos + semânticos) */}
      <SmartAlertsCard
        losses={data?.losses || []}
        lossReasons={data?.lossReasons || []}
        isLoading={isLoading}
        contextLabel={terminology.lostPlural}
        semantic={semantic}
      />

      {/* 3. CRM Trust Score + Receita Recuperável */}
      <CrmTrustAndRecoverableStrip semantic={semantic} isLoading={isLoading} />

      {/* 4. Motivos Ocultos (declarado vs inferido pela IA) */}
      <HiddenReasonsBlock semantic={semantic} />

      {/* 5. Top Motivos de Perda */}
      <LossAnalysisSection
        data={data}
        isLoading={isLoading}
        lostLabel={terminology.lostPlural}
        dateRange={dateRange}
      />

      {/* 6. Gap Vendedor × Cliente */}
      <SellerCustomerGapBlock semantic={semantic} />

      {/* 7. Radar Competitivo (humano + IA) */}
      <CompetitiveRadarBlock semantic={semantic} />

      {/* 8. Drivers de Vitória */}
      <WinDriversBlock data={data} />

      {/* 9. Pulso Mensal (oculto no filtro Mês) */}
      {showMonthlyPulse && data && data.monthlyPulse.length > 0 && (
        <MonthlyPulseCards data={data.monthlyPulse} />
      )}

      {/* 10. Análise de Ganhos */}
      <WinAnalysisSection data={data} isLoading={isLoading} />

      {/* 11. Ciclo de Venda */}
      <SalesCycleSection data={data} isLoading={isLoading} />

      {/* 12. Tendência ou Sinais do Mês */}
      {showTrend ? (
        <LossReasonsTrendChart
          losses={data?.losses || []}
          isLoading={isLoading}
          semantic={semantic}
        />
      ) : (
        <MonthSignalsCard data={data} dateRange={dateRange} />
      )}
    </div>
  );
}
