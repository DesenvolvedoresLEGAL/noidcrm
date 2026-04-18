/**
 * Sprint 2.7 — Estado de loading padrão.
 */
import { Skeleton } from '@/components/ui/skeleton';

export function ReportLoadingState({ cardCount = 4 }: { cardCount?: number }) {
  return (
    <div className="space-y-4">
      <Skeleton className="h-10 w-full" />
      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        {Array.from({ length: cardCount }).map((_, i) => (
          <Skeleton key={i} className="h-28" />
        ))}
      </div>
      <Skeleton className="h-72" />
    </div>
  );
}
