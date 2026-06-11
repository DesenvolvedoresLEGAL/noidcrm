import { Skull } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { Progress } from '@/components/ui/progress';
import { RevenueSectionCard } from '../RevenueSectionCard';
import type { DeathStage } from '@/hooks/revenue-command/useRevenueBottlenecks';

function fmtBRL(v: number) {
  return `R$ ${Math.round(v).toLocaleString('pt-BR')}`;
}

export function DealDeathMap({
  stages,
  loading,
}: {
  stages: DeathStage[];
  loading?: boolean;
}) {
  return (
    <RevenueSectionCard
      title="Onde os negócios morrem"
      description="Etapas em que oportunidades param de avançar (fonte: Win/Loss)."
      icon={Skull}
    >
      {loading ? (
        <div className="space-y-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-10 w-full" />
          ))}
        </div>
      ) : stages.length === 0 ? (
        <p className="py-6 text-center text-sm text-muted-foreground">
          Sem perdas registradas no período.
        </p>
      ) : (
        <ul className="space-y-3">
          {stages.map((s) => (
            <li key={s.stageId} className="space-y-1.5">
              <div className="flex items-center justify-between text-sm">
                <span className="font-medium">{s.stageName}</span>
                <span className="text-muted-foreground">
                  {s.count} · {s.pct.toFixed(0)}%
                  {s.lostValue > 0 && (
                    <span className="ml-2 text-xs">{fmtBRL(s.lostValue)}</span>
                  )}
                </span>
              </div>
              <Progress value={s.pct} className="h-1.5" />
            </li>
          ))}
        </ul>
      )}
    </RevenueSectionCard>
  );
}
