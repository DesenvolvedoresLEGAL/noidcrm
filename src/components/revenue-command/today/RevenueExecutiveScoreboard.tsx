import {
  Banknote,
  Target,
  Percent,
  TrendingUp,
  Layers,
  Ban,
  Trophy,
  UserCheck,
} from 'lucide-react';
import { RevenueCommandMetricCard } from './RevenueCommandMetricCard';
import { formatCurrency, formatPct, formatNumber } from '@/lib/reports/formatReportNumbers';
import type { TodayScoreboard } from '@/hooks/revenue-command/useRevenueTodayCommand';

interface Props {
  scoreboard: TodayScoreboard;
  loading?: boolean;
}

export function RevenueExecutiveScoreboard({ scoreboard, loading }: Props) {
  const att = scoreboard.goalAttainmentPct;
  const attTone: 'positive' | 'warning' | 'critical' | 'default' =
    att === null
      ? 'default'
      : att >= 100
        ? 'positive'
        : att >= 70
          ? 'default'
          : att >= 40
            ? 'warning'
            : 'critical';

  return (
    <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
      <RevenueCommandMetricCard
        label="Receita Válida"
        value={formatCurrency(scoreboard.validRevenue)}
        helper="Vendas válidas no período"
        source="Resultados"
        icon={Banknote}
        loading={loading}
      />
      <RevenueCommandMetricCard
        label="Meta do Mês"
        value={formatCurrency(scoreboard.monthlyGoal)}
        helper={scoreboard.monthlyGoal > 0 ? 'Meta oficial OTE/Sales' : 'Meta não configurada'}
        source="Forecast"
        icon={Target}
        loading={loading}
        empty={scoreboard.monthlyGoal === 0}
      />
      <RevenueCommandMetricCard
        label="% da Meta"
        value={formatPct(att, 1)}
        helper={att !== null ? 'Atingimento do mês' : 'Sem meta'}
        icon={Percent}
        loading={loading}
        empty={att === null}
        tone={attTone}
      />
      <RevenueCommandMetricCard
        label="Forecast Realista"
        value={formatCurrency(scoreboard.forecastRealistic ?? 0)}
        helper="Cenário oficial do Forecast"
        source="Forecast"
        icon={TrendingUp}
        loading={loading}
        empty={scoreboard.forecastRealistic === null}
      />
      <RevenueCommandMetricCard
        label="Pipeline Ativo"
        value={formatCurrency(scoreboard.activePipeline ?? 0)}
        helper="Oportunidades em aberto"
        source="Forecast"
        icon={Layers}
        loading={loading}
        empty={scoreboard.activePipeline === null}
      />
      <RevenueCommandMetricCard
        label="Receita Cancelada"
        value={formatCurrency(scoreboard.cancelledRevenue)}
        helper={`${scoreboard.cancelledCount} cancelamento(s)`}
        source="Auditoria"
        icon={Ban}
        loading={loading}
        tone={scoreboard.cancelledRevenue > 0 ? 'warning' : 'default'}
      />
      <RevenueCommandMetricCard
        label="Win Rate"
        value={formatPct(scoreboard.winRate, 1)}
        helper="won / (won + lost) no período"
        source="Forecast"
        icon={Trophy}
        loading={loading}
        empty={scoreboard.winRate === null}
      />
      <RevenueCommandMetricCard
        label="SQLs Qualificados"
        value={formatNumber(scoreboard.qualifiedSqls ?? 0)}
        helper="Leads qualificados no período"
        source="Qualidade Qualif."
        icon={UserCheck}
        loading={loading}
        empty={scoreboard.qualifiedSqls === null}
      />
    </div>
  );
}
