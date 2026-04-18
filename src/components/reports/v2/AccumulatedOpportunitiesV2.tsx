/**
 * Sprint 2.8 — Tela V2: Oportunidades Acumuladas (série temporal).
 */
import { useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { CalendarDays, TrendingUp, Wallet, Activity } from 'lucide-react';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import { useTeamVisibility } from '@/hooks/useTeamVisibility';
import { useReportFiltersContext } from '@/contexts/ReportFiltersContext';
import { useReportAccumulatedV2 } from '@/hooks/useReportAccumulatedV2';
import { buildReportV2RequestFromFilters } from '@/lib/reports/buildReportV2Request';
import { mapAccumulatedV2 } from '@/lib/reports/mappers/mapAccumulatedV2';
import { formatCurrency, formatNumber, formatDateBR } from '@/lib/reports/formatReportNumbers';
import { ReportMetaBar } from './shared/ReportMetaBar';
import { ReportWarningsPanel } from './shared/ReportWarningsPanel';
import { ReportLoadingState } from './shared/ReportLoadingState';
import { ReportErrorState } from './shared/ReportErrorState';
import { ReportEmptyState } from './shared/ReportEmptyState';
import {
  LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Legend,
} from 'recharts';

function KpiCard({ icon: Icon, label, value }: { icon: React.ComponentType<{ className?: string }>; label: string; value: string }) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-xs font-medium text-muted-foreground">{label}</CardTitle>
        <Icon className="h-4 w-4 text-primary" />
      </CardHeader>
      <CardContent><div className="text-2xl font-bold">{value}</div></CardContent>
    </Card>
  );
}

export function AccumulatedOpportunitiesV2() {
  const { organization } = useCurrentUser();
  const { filters, effectiveDates } = useReportFiltersContext();
  const teamVisibility = useTeamVisibility();

  const request = useMemo(() => {
    if (!organization?.id || teamVisibility.loading) return undefined;
    return buildReportV2RequestFromFilters({
      organizationId: organization.id,
      filters, effectiveDates,
      teamVisibility: { enabled: !teamVisibility.canViewAll, visibleUserIds: teamVisibility.visibleUserIds },
      options: { limit: 1000 },
    });
  }, [organization?.id, filters, effectiveDates, teamVisibility]);

  const { data, meta, error, isLoading, refetch } = useReportAccumulatedV2({
    organizationId: organization?.id, request,
  });

  if (isLoading || teamVisibility.loading) return <ReportLoadingState cardCount={4} />;
  if (error) return <ReportErrorState message={(error as Error).message} onRetry={() => refetch()} />;

  const view = mapAccumulatedV2(data);
  if (view.series.length === 0) return <ReportEmptyState icon={CalendarDays} title="Sem criação de oportunidades no período" description="Ajuste o recorte temporal para visualizar a série." />;

  const chartData = view.series.map((p) => ({
    day: formatDateBR(p.day),
    Criadas: p.createdCount,
    Acumulado: p.cumulativeCount,
  }));

  return (
    <div className="space-y-4">
      <ReportMetaBar meta={meta} reportLabel="Oportunidades Acumuladas" />
      <ReportWarningsPanel confidence={meta?.confidence} />
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <KpiCard icon={Activity} label="Total criadas no período" value={formatNumber(view.cards.totalCreated)} />
        <KpiCard icon={Wallet} label="Valor criado no período" value={formatCurrency(view.cards.totalValue)} />
        <KpiCard icon={TrendingUp} label="Média diária (qtd)" value={formatNumber(Math.round(view.cards.avgDailyCount))} />
        <KpiCard icon={TrendingUp} label="Média diária (valor)" value={formatCurrency(view.cards.avgDailyValue)} />
      </div>
      <Card>
        <CardHeader><CardTitle className="text-base">Criação por dia (com acumulado)</CardTitle></CardHeader>
        <CardContent>
          <div className="h-72 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
                <XAxis dataKey="day" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip />
                <Legend />
                <Line type="monotone" dataKey="Criadas" stroke="hsl(var(--primary))" strokeWidth={2} dot={false} />
                <Line type="monotone" dataKey="Acumulado" stroke="hsl(var(--muted-foreground))" strokeWidth={2} strokeDasharray="4 2" dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
