import { Activity } from 'lucide-react';
import { RevenueSectionCard } from '../RevenueSectionCard';
import { Skeleton } from '@/components/ui/skeleton';
import { formatCurrency, formatNumber } from '@/lib/reports/formatReportNumbers';
import type { TodayChange } from '@/hooks/revenue-command/useRevenueTodayCommand';

interface Props {
  changes: TodayChange[];
  loading?: boolean;
}

function formatValue(c: TodayChange): string {
  if (!c.available) return 'Disponível na próxima sprint';
  if (typeof c.value === 'number') {
    return c.key === 'revenue_7d' ? formatCurrency(c.value) : formatNumber(c.value);
  }
  return String(c.value);
}

export function RevenueWhatChanged({ changes, loading }: Props) {
  return (
    <RevenueSectionCard
      title="O que mudou"
      description="Movimentações relevantes no recorte atual."
      icon={Activity}
    >
      {loading ? (
        <div className="space-y-2">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-10 w-full" />
          ))}
        </div>
      ) : (
        <ul className="divide-y">
          {changes.map((c) => (
            <li key={c.key} className="flex items-center justify-between py-2.5">
              <div className="space-y-0.5">
                <p className="text-sm font-medium">{c.label}</p>
                {c.helper && (
                  <p className="text-xs text-muted-foreground">{c.helper}</p>
                )}
              </div>
              <span
                className={
                  c.available
                    ? 'text-sm font-semibold tabular-nums'
                    : 'text-xs italic text-muted-foreground'
                }
              >
                {formatValue(c)}
              </span>
            </li>
          ))}
        </ul>
      )}
    </RevenueSectionCard>
  );
}
