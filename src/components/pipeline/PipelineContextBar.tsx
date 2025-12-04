import { Badge } from '@/components/ui/badge';
import { Pipeline } from '@/services/crm/types';
import { cn } from '@/lib/utils';

interface PipelineContextBarProps {
  pipeline: Pipeline;
  totalOpportunities: number;
  totalValue: number;
  totalMRR: number;
  stageDistribution: { stageId: string; count: number; value: number }[];
}

export function PipelineContextBar({
  pipeline,
  totalOpportunities,
  totalValue,
  totalMRR,
  stageDistribution,
}: PipelineContextBarProps) {
  const formatCurrency = (value: number) => {
    if (value >= 1000000) {
      return `R$ ${(value / 1000000).toFixed(1)}M`;
    }
    if (value >= 1000) {
      return `R$ ${(value / 1000).toFixed(0)}K`;
    }
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
      minimumFractionDigits: 0,
    }).format(value);
  };

  // Calculate funnel conversion percentages
  const stagePercentages = stageDistribution.map((stage) => ({
    ...stage,
    percentage: totalValue > 0 ? (stage.value / totalValue) * 100 : 0,
  }));

  return (
    <div className="px-4 py-2 bg-muted/30 border-b">
      <div className="flex items-center justify-between gap-4">
        {/* Pipeline Name & KPIs */}
        <div className="flex items-center gap-4">
          <h2 className="text-lg font-semibold text-foreground">
            {pipeline.name}
          </h2>
          
          <div className="flex items-center gap-2">
            <Badge variant="secondary" className="bg-primary/10 text-primary font-bold px-3">
              {totalOpportunities} deals
            </Badge>
            <Badge variant="secondary" className="bg-emerald-500/10 text-emerald-600 font-bold px-3">
              Avulso: {formatCurrency(totalValue)}
            </Badge>
            {totalMRR > 0 && (
              <Badge variant="secondary" className="bg-violet-500/10 text-violet-600 font-bold px-3">
                MRR: {formatCurrency(totalMRR)}
              </Badge>
            )}
          </div>
        </div>

        {/* Mini Funnel Progress Bar */}
        <div className="hidden lg:flex items-center gap-2 flex-1 max-w-md">
          <span className="text-xs text-muted-foreground whitespace-nowrap">Funil:</span>
          <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden flex">
            {stagePercentages.map((stage, index) => (
              <div
                key={stage.stageId}
                className={cn(
                  "h-full transition-all duration-300",
                  index === 0 && "rounded-l-full",
                  index === stagePercentages.length - 1 && "rounded-r-full",
                  // Gradient colors for each stage
                  index === 0 && "bg-blue-400",
                  index === 1 && "bg-cyan-400",
                  index === 2 && "bg-teal-400",
                  index === 3 && "bg-green-400",
                  index === 4 && "bg-emerald-400",
                  index >= 5 && "bg-primary"
                )}
                style={{ width: `${Math.max(stage.percentage, 2)}%` }}
                title={`${pipeline.stages.find(s => s.id === stage.stageId)?.name}: ${stage.count} deals`}
              />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
