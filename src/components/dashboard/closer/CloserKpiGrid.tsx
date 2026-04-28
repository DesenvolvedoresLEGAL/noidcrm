import { Card, CardContent } from '@/components/ui/card';
import { cn } from '@/lib/utils';

interface KpiCardProps {
  title: string;
  value: string;
  subtitle?: string;
  unavailable?: boolean;
  unavailableReason?: string;
  variant?: 'default' | 'attention' | 'critical';
}

function formatBRL(v: number | null | undefined) {
  if (v == null || isNaN(v)) return 'R$ 0';
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 }).format(v);
}
function formatNum(v: number | null | undefined) {
  return v == null || isNaN(v) ? '0' : new Intl.NumberFormat('pt-BR').format(v);
}
function formatPct(v: number | null | undefined) {
  return v == null || isNaN(v) ? '—' : `${v.toFixed(1)}%`;
}

function KpiCard({ title, value, subtitle, unavailable, unavailableReason, variant = 'default' }: KpiCardProps) {
  return (
    <Card className={cn(
      variant === 'attention' && 'border-amber-500/50',
      variant === 'critical' && 'border-destructive/50',
    )}>
      <CardContent className="p-4 space-y-1">
        <p className="text-xs uppercase tracking-wide text-muted-foreground">{title}</p>
        {unavailable ? (
          <>
            <p className="text-base font-medium text-muted-foreground">Não disponível</p>
            <p className="text-xs text-muted-foreground">{unavailableReason ?? 'Fonte de dados não encontrada'}</p>
          </>
        ) : (
          <>
            <p className="text-2xl font-semibold">{value}</p>
            {subtitle && <p className="text-xs text-muted-foreground">{subtitle}</p>}
          </>
        )}
      </CardContent>
    </Card>
  );
}

export function CloserKpiGrid({
  kpis,
  availability,
}: {
  kpis: import('@/types/dashboard/closer').CloserDashboardKpis;
  availability: Record<string, string>;
}) {
  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
      <KpiCard
        title="Pipeline aberto"
        value={formatBRL(kpis.open_pipeline_value)}
        subtitle={`${formatNum(kpis.open_pipeline_count)} oportunidades abertas`}
      />
      <KpiCard
        title="Propostas na mesa"
        value={formatBRL(kpis.proposals_open_value)}
        subtitle={`${formatNum(kpis.proposals_open_count)} propostas abertas`}
      />
      <KpiCard
        title="Propostas visualizadas"
        value={formatNum(kpis.proposals_viewed_count)}
        subtitle="No período selecionado"
      />
      <KpiCard
        title="Follow ups atrasados"
        value={formatNum(kpis.overdue_followups_count)}
        subtitle="Precisam de ação hoje"
        variant={kpis.overdue_followups_count > 0 ? 'attention' : 'default'}
      />
      <KpiCard
        title="Deals em risco"
        value={formatNum(kpis.risk_deals_count)}
        subtitle="Oportunidades com sinais de perda"
        variant={kpis.risk_deals_count > 0 ? 'attention' : 'default'}
      />
      <KpiCard
        title="Meta mensal"
        value={kpis.goal_attainment_percent != null ? formatPct(kpis.goal_attainment_percent) : '—'}
        subtitle={
          kpis.monthly_goal_value != null
            ? `${formatBRL(kpis.monthly_revenue_value)} de ${formatBRL(kpis.monthly_goal_value)}`
            : 'Meta não configurada'
        }
        unavailable={availability.goals === 'unavailable'}
        unavailableReason="Meta não configurada para este usuário"
      />
      <KpiCard
        title="Taxa de fechamento"
        value={formatPct(kpis.win_rate_percent)}
        subtitle={`${formatNum(kpis.won_count)} ganhos · ${formatNum(kpis.lost_count)} perdidos`}
      />
      <KpiCard
        title="Ticket médio"
        value={kpis.average_ticket_value != null ? formatBRL(kpis.average_ticket_value) : '—'}
        subtitle="Baseado em vendas ganhas no período"
      />
    </div>
  );
}
