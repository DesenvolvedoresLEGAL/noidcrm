import { ListChecks } from 'lucide-react';
import { RevenueSectionCard } from '../RevenueSectionCard';
import { Skeleton } from '@/components/ui/skeleton';
import { RevenueCommandActionCard } from './RevenueCommandActionCard';
import type { TodayAction } from '@/hooks/revenue-command/useRevenueTodayCommand';

interface Props {
  actions: TodayAction[];
  loading?: boolean;
}

export function RevenueNextActions({ actions, loading }: Props) {
  return (
    <RevenueSectionCard
      title="Próximas ações"
      description="Ações priorizadas a partir dos alertas atuais."
      icon={ListChecks}
    >
      {loading ? (
        <div className="grid gap-2 md:grid-cols-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-20 w-full" />
          ))}
        </div>
      ) : actions.length === 0 ? (
        <p className="py-6 text-center text-sm text-muted-foreground">
          Nenhuma ação prioritária no momento.
        </p>
      ) : (
        <div className="grid gap-2 md:grid-cols-2">
          {actions.map((a) => (
            <RevenueCommandActionCard key={a.id} action={a} />
          ))}
        </div>
      )}
    </RevenueSectionCard>
  );
}
