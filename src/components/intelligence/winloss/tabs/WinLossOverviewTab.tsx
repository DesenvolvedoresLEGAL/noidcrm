import { LossAnalysisSection } from './LossAnalysisSection';
import { WinAnalysisSection } from './WinAnalysisSection';
import { SalesCycleSection } from './SalesCycleSection';
import { MonthlyPulseCards } from '../MonthlyPulseCards';
import { SmartAlertsCard } from '@/components/intelligence/SmartAlertsCard';
import { LossReasonsByCategoryChart } from '@/components/intelligence/LossReasonsByCategoryChart';
import { LossReasonsTrendChart } from '@/components/intelligence/LossReasonsTrendChart';
import { Sparkles } from 'lucide-react';
import type { WinLossDataResult } from '@/hooks/useWinLossData';

interface Props {
  data: WinLossDataResult | undefined;
  isLoading: boolean;
  organizationId: string;
  pipelineContext: 'qualification' | 'sales' | 'onboarding';
  terminology: { lostPlural: string };
}

export function WinLossOverviewTab({ data, isLoading, organizationId, pipelineContext, terminology }: Props) {
  return (
    <div className="space-y-6">
      {/* Monthly Pulse */}
      {data && data.monthlyPulse.length > 1 && (
        <MonthlyPulseCards data={data.monthlyPulse} />
      )}

      {/* Loss Analysis */}
      <LossAnalysisSection data={data} isLoading={isLoading} lostLabel={terminology.lostPlural} />

      {/* Win Analysis */}
      <WinAnalysisSection data={data} isLoading={isLoading} />

      {/* Sales Cycle */}
      <SalesCycleSection data={data} isLoading={isLoading} />

      {/* Advanced Analysis */}
      <div className="space-y-4">
        <h2 className="text-lg font-semibold flex items-center gap-2">
          <Sparkles className="h-5 w-5 text-purple-500" />
          Análise Avançada
        </h2>
        <div className="grid lg:grid-cols-2 gap-4">
          <SmartAlertsCard
            losses={data?.losses || []}
            lossReasons={data?.lossReasons || []}
            isLoading={isLoading}
            contextLabel={terminology.lostPlural}
          />
          <LossReasonsByCategoryChart
            organizationId={organizationId}
            pipelineContext={pipelineContext}
          />
        </div>
        <LossReasonsTrendChart losses={data?.losses || []} isLoading={isLoading} />
      </div>
    </div>
  );
}
