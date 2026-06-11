import { ArrowRight, FileX, FilesIcon, XCircle, FileWarning } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import type { FunnelLeak } from '@/hooks/revenue-command/useRevenueBottlenecks';

const ICONS: Record<FunnelLeak['id'], React.ComponentType<{ className?: string }>> = {
  sqls_without_proposal: FileX,
  open_proposals: FilesIcon,
  lost_proposals: FileWarning,
  cancelled_sales: XCircle,
};

function fmtBRL(v: number) {
  return `R$ ${Math.round(v).toLocaleString('pt-BR')}`;
}

export function FunnelLeakageCards({
  leaks,
  loading,
}: {
  leaks: FunnelLeak[];
  loading?: boolean;
}) {
  if (loading) {
    return (
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Card key={i}>
            <CardContent className="space-y-3 p-4">
              <Skeleton className="h-4 w-32" />
              <Skeleton className="h-8 w-24" />
              <Skeleton className="h-3 w-40" />
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  return (
    <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
      {leaks.map((leak) => {
        const Icon = ICONS[leak.id];
        return (
          <Card key={leak.id} className="border-l-4 border-l-amber-500/50">
            <CardContent className="space-y-2 p-4">
              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <span className="flex items-center gap-1.5">
                  <Icon className="h-3.5 w-3.5" />
                  {leak.label}
                </span>
                <span className="text-[10px] uppercase tracking-wide opacity-70">
                  {leak.source}
                </span>
              </div>
              <div className="flex items-baseline gap-2">
                <span className="text-2xl font-semibold leading-tight">
                  {leak.available ? leak.count.toLocaleString('pt-BR') : '—'}
                </span>
                {leak.value != null && leak.value > 0 && (
                  <span className="text-xs text-muted-foreground">
                    · {fmtBRL(leak.value)}
                  </span>
                )}
              </div>
              {leak.helper && (
                <p className="text-xs text-muted-foreground">{leak.helper}</p>
              )}
              <Link
                to={leak.cta.to}
                className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline"
              >
                {leak.cta.label}
                <ArrowRight className="h-3 w-3" />
              </Link>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
