import { Badge } from '@/components/ui/badge';
import { Pipeline } from '@/services/crm/types';
import { formatCurrencyFull } from '@/lib/i18n';

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
            Avulso: {formatCurrencyFull(totalValue)}
          </Badge>
          {totalMRR > 0 && (
            <Badge variant="secondary" className="bg-violet-500/10 text-violet-600 font-bold px-3">
              MRR: {formatCurrencyFull(totalMRR)}
            </Badge>
          )}
        </div>
      </div>
    </div>
  );
}
