import { Stage } from '@/services/crm/types';
import { cn } from '@/lib/utils';

interface StageHeaderBarProps {
  stages: Stage[];
  opportunitiesByStage: Record<string, any[]>;
  totalOpportunities: number;
  totalValue: number;
}

export function StageHeaderBar({
  stages,
  opportunitiesByStage,
  totalOpportunities,
  totalValue,
}: StageHeaderBarProps) {
  const formatCurrency = (value: number) => {
    if (value >= 1000000) {
      return `${(value / 1000000).toFixed(1)}M`;
    }
    if (value >= 1000) {
      return `${(value / 1000).toFixed(0)}K`;
    }
    return new Intl.NumberFormat('pt-BR', {
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value);
  };

  return (
    <div className="flex bg-muted/50 border-b sticky top-0 z-10">
      {stages.map((stage, index) => {
        const stageOpps = opportunitiesByStage[stage.id] || [];
        const stageValue = stageOpps.reduce((sum, opp) => sum + (opp.valor_previsto || 0), 0);
        const percentage = totalOpportunities > 0
          ? ((stageOpps.length / totalOpportunities) * 100).toFixed(0)
          : '0';
        const valuePercentage = totalValue > 0
          ? ((stageValue / totalValue) * 100).toFixed(0)
          : '0';

        return (
          <div
            key={stage.id}
            className={cn(
              "flex-1 px-3 py-2 min-w-[180px] border-r last:border-r-0",
              "transition-colors"
            )}
          >
            <div className="flex items-center justify-between mb-1">
              <span className="font-semibold text-sm text-foreground truncate">
                {stage.name}
              </span>
              <div className="flex items-center gap-1.5">
                <span className="text-xs font-bold bg-primary/10 text-primary px-1.5 py-0.5 rounded">
                  {stageOpps.length}
                </span>
              </div>
            </div>
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span className="font-medium text-primary">
                R$ {formatCurrency(stageValue)}
              </span>
              <span className="opacity-70">{percentage}%</span>
            </div>
            {/* Progress bar */}
            <div className="mt-1.5 h-1 bg-muted rounded-full overflow-hidden">
              <div
                className="h-full bg-primary/60 rounded-full transition-all duration-300"
                style={{ width: `${valuePercentage}%` }}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}
