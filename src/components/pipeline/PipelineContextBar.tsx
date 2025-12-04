import { Badge } from '@/components/ui/badge';
import { Pipeline } from '@/services/crm/types';

interface PipelineContextBarProps {
  pipeline: Pipeline;
  totalOpportunities: number;
  totalValue: number;
  totalMRR: number;
}

export function PipelineContextBar({
  pipeline,
  totalOpportunities,
  totalValue,
  totalMRR,
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

  return (
    <div className="px-4 py-2 bg-muted/30 border-b">
      <div className="flex items-center gap-4">
        {/* Pipeline Name */}
        <h2 className="text-lg font-semibold text-foreground">
          {pipeline.name}
        </h2>
        
        {/* KPIs */}
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
    </div>
  );
}
