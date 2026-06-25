import { Badge } from '@/components/ui/badge';
import {
  COVERAGE_CLASS_COLOR,
  COVERAGE_CLASS_LABELS,
  type CoverageClass,
} from '@/services/intelligence/coverage';
import { cn } from '@/lib/utils';

interface CoverageBadgeProps {
  score?: number | null;
  coverageClass?: CoverageClass | null;
  missing?: string[] | null;
  compact?: boolean;
}

export function CoverageBadge({
  score,
  coverageClass,
  missing,
  compact = false,
}: CoverageBadgeProps) {
  const normalizedClass: CoverageClass = coverageClass ?? 'new';
  const label = COVERAGE_CLASS_LABELS[normalizedClass];
  const scoreLabel = typeof score === 'number' ? `${Math.round(score)}%` : '—';
  const missingCount = missing?.length ?? 0;

  return (
    <div
      data-component="coverage-badge"
      className={cn('flex flex-col gap-1', compact && 'gap-0.5')}
    >
      <Badge
        variant="outline"
        className={cn('w-fit border', COVERAGE_CLASS_COLOR[normalizedClass])}
      >
        {compact ? scoreLabel : `${label} · ${scoreLabel}`}
      </Badge>
      {!compact && missingCount > 0 && (
        <span className="text-xs text-muted-foreground">
          {missingCount} item{missingCount === 1 ? '' : 's'} pendente{missingCount === 1 ? '' : 's'}
        </span>
      )}
    </div>
  );
}