import { AlertTriangle, ShieldCheck } from 'lucide-react';
import { RevenueSectionCard } from '../RevenueSectionCard';
import { Skeleton } from '@/components/ui/skeleton';
import { RevenueCommandAlertCard } from './RevenueCommandAlertCard';
import type { TodayAlert } from '@/hooks/revenue-command/useRevenueTodayCommand';

interface Props {
  alerts: TodayAlert[];
  loading?: boolean;
}

export function RevenueOperationAlerts({ alerts, loading }: Props) {
  return (
    <RevenueSectionCard
      title="Alertas da operação"
      description="Sinais que merecem atenção agora."
      icon={AlertTriangle}
    >
      {loading ? (
        <div className="space-y-2">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-20 w-full" />
          ))}
        </div>
      ) : alerts.length === 0 ? (
        <div className="flex flex-col items-center gap-2 py-8 text-center">
          <ShieldCheck className="h-6 w-6 text-emerald-500" />
          <p className="text-sm font-medium">Nenhum alerta no momento</p>
          <p className="text-xs text-muted-foreground">
            Operação dentro dos limites monitorados.
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {alerts.map((a) => (
            <RevenueCommandAlertCard key={a.id} alert={a} />
          ))}
        </div>
      )}
    </RevenueSectionCard>
  );
}
