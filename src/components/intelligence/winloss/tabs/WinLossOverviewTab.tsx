// Sprint WL-UI-01 — Cockpit executivo de Win/Loss.
// Estrutura final: KPIs → Diagnóstico IA → Alertas (max 3) → Trust+Recuperável
// → Drivers de Vitória (compacto) → Pulso do Período → Ciclo de Venda.
// Blocos movidos: Análise de Perdas, Top Motivos, Concorrentes, Por que estamos perdendo,
// Radar Competitivo, Feedback dos Clientes, Tendência → migrados para outras abas.
import { SalesCycleSection } from './SalesCycleSection';
import { MonthlyPulseCards } from '../MonthlyPulseCards';
import { AIDiagnosisCard } from '../AIDiagnosisCard';
import { SmartAlertsCard } from '@/components/intelligence/SmartAlertsCard';
import { CrmTrustAndRecoverableStrip } from '../CrmTrustAndRecoverableStrip';
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

export function WinLossOverviewTab({
  data,
  isLoading,
  organizationId,
  terminology,
  timeframe,
  dateRange,
  pipelineId = null,
}: Props) {
  // Pulso só aparece quando o período é maior que "mês" e existem dados de pulso.
  const showMonthlyPulse =
    timeframe !== 'today' && timeframe !== '7d' && timeframe !== '15d' && timeframe !== 'month';

  const { data: semantic } = useLossSemantic(organizationId, pipelineId, dateRange);

  return (
    <div className="space-y-6">
      {/* 1. Diagnóstico Executivo da IA — bloco principal */}
      <AIDiagnosisCard data={data} dateRange={dateRange} semantic={semantic} />

      {/* 2. Alertas Inteligentes (máx 3, ordenados por severidade) */}
      <SmartAlertsCard
        losses={data?.losses || []}
        lossReasons={data?.lossReasons || []}
        isLoading={isLoading}
        contextLabel={terminology.lostPlural}
        semantic={semantic}
      />

      {/* 3. CRM Trust Score + Receita Recuperável */}
      <CrmTrustAndRecoverableStrip semantic={semantic} isLoading={isLoading} />

      {/* 4. Drivers de Vitória (compacto: top 3 motivos + top 3 diferenciais) */}
      <WinDriversBlock data={data} />

      {/* 5. Pulso do Período */}
      {showMonthlyPulse && data && data.monthlyPulse.length > 0 && (
        <MonthlyPulseCards data={data.monthlyPulse} />
      )}

      {/* 6. Ciclo de Venda (Ganhos × Perdidos × Diferença + Time-to-Loss compacto) */}
      <SalesCycleSection data={data} isLoading={isLoading} />
    </div>
  );
}
