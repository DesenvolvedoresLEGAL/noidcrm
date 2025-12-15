import { Stage } from '@/services/crm/types';
import { cn } from '@/lib/utils';
import { formatCurrencyFull } from '@/lib/i18n';

interface StageColumnHeaderProps {
  stage: Stage;
  opportunityCount: number;
  totalValue: number;
  pipelineTotalValue: number;
}

export function StageColumnHeader({
  stage,
  opportunityCount,
  totalValue,
  pipelineTotalValue,
}: StageColumnHeaderProps) {

  const percentage = pipelineTotalValue > 0
    ? ((totalValue / pipelineTotalValue) * 100).toFixed(0)
    : '0';

  return (
    <div className="px-2 py-2 bg-muted/50 border-b sticky top-0 z-10">
      <div className="flex items-center justify-between mb-1">
        <span className="font-semibold text-sm text-foreground truncate flex-1">
          {stage.name}
        </span>
        <span className="text-xs font-bold bg-primary/10 text-primary px-2 py-0.5 rounded ml-2">
          {opportunityCount}
        </span>
      </div>
      <div className="flex items-center justify-between text-xs text-muted-foreground">
        <span className="font-medium text-primary">
          {formatCurrencyFull(totalValue)}
        </span>
        <span className="opacity-70">{percentage}%</span>
      </div>
      {/* Mini progress bar */}
      <div className="mt-1.5 h-1 bg-muted rounded-full overflow-hidden">
        <div
          className="h-full bg-primary/60 rounded-full transition-all duration-300"
          style={{ width: `${percentage}%` }}
        />
      </div>
    </div>
  );
}
