import { useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { EmptyState } from '@/components/EmptyState';
import { PerformanceMetricCard } from './PerformanceMetricCard';
import { useQualificationQualityV2 } from '@/hooks/reports/useQualificationQualityV2';
import {
  Users, UserCheck, Trophy, Percent, Clock, Sparkles,
  Activity, Award, TrendingUp, TrendingDown, Minus, AlertCircle,
} from 'lucide-react';

const fmtPct = (v: number) => `${(v || 0).toFixed(1)}%`;
const fmtDays = (v: number | null | undefined) => (v == null ? '—' : `${Math.round(v * 10) / 10}d`);

export function PerformanceOverviewTab() {
  const { data, isLoading } = useQualificationQualityV2({ includeDrilldown: true });

  const cockpit = useMemo(() => {
    if (!data) return null;
    const rows = data.rows ?? [];
    const drill = data.drilldown ?? [];
    const activePeople = new Set<string>();
    rows.forEach(r => r.sdr_user_id && activePeople.add(r.sdr_user_id));
    drill.forEach(d => d.closer_name && activePeople.add(`closer:${d.closer_name}`));

    const cycles = drill
      .map(d => d.days_qualification_to_close)
      .filter((v): v is number => typeof v === 'number' && v >= 0);
    const avgCycle = cycles.length ? cycles.reduce((a, b) => a + b, 0) / cycles.length : null;

    // Quality score: proxy = SQL→Proposta rate (transparente)
    const qualityScore = data.summary.sql_to_proposal_rate ?? 0;

    return {
      activePeople: activePeople.size,
      qualified: data.summary.qualified_count,
      won: data.summary.won_count,
      conversionRate: data.summary.sql_to_won_rate,
      avgCycle,
      qualityScore,
    };
  }, [data]);

  const pulse = useMemo(() => {
    if (!data) return [];
    const lines: { tone: 'positive' | 'neutral' | 'negative'; text: string }[] = [];
    const rows = [...(data.rows ?? [])].filter(r => !r.sdr_is_deleted);
    if (rows.length === 0) return [];

    const totalQual = data.summary.qualified_count;
    const totalWon = data.summary.won_count;
    lines.push({ tone: 'neutral', text: `Pré-vendas gerou ${totalQual} qualificação(ões) no período.` });
    lines.push({ tone: totalWon > 0 ? 'positive' : 'neutral', text: `Closers converteram ${totalWon} venda(s).` });

    const topSdr = [...rows].sort((a, b) => b.qualified_count - a.qualified_count)[0];
    if (topSdr && topSdr.qualified_count > 0) {
      lines.push({ tone: 'positive', text: `${topSdr.sdr_name} lidera em volume de qualificações (${topSdr.qualified_count}).` });
    }

    // Closer leader via drilldown
    const closerWins = new Map<string, number>();
    (data.drilldown ?? []).forEach(d => {
      if (d.status === 'won' && d.closer_name) {
        closerWins.set(d.closer_name, (closerWins.get(d.closer_name) ?? 0) + 1);
      }
    });
    const topCloser = [...closerWins.entries()].sort((a, b) => b[1] - a[1])[0];
    if (topCloser) {
      lines.push({ tone: 'positive', text: `${topCloser[0]} lidera em fechamento (${topCloser[1]} vendas).` });
    }

    // High post-qualification loss
    if (data.summary.post_qualification_loss_rate > 50) {
      lines.push({
        tone: 'negative',
        text: `Alta perda pós-qualificação: ${fmtPct(data.summary.post_qualification_loss_rate)} dos SQLs morreram sem virar venda.`,
      });
    }

    // Low SQL→Proposta
    if (totalQual > 0 && data.summary.sql_to_proposal_rate < 40) {
      lines.push({
        tone: 'negative',
        text: `Handoff com gargalo: apenas ${fmtPct(data.summary.sql_to_proposal_rate)} das qualificações viraram proposta.`,
      });
    }

    return lines;
  }, [data]);

  const ranking = useMemo(() => {
    if (!data) return [];
    const items: Array<{
      name: string; role: 'SDR' | 'Closer'; metric: string; metricValue: number; status: string;
    }> = [];

    (data.rows ?? [])
      .filter(r => !r.sdr_is_deleted && r.qualified_count > 0)
      .forEach(r => items.push({
        name: r.sdr_name,
        role: 'SDR',
        metric: 'Qualificações',
        metricValue: r.qualified_count,
        status: r.sql_to_won_rate >= 30 ? 'Alta performance' : r.sql_to_won_rate >= 15 ? 'Em evolução' : 'Abaixo do esperado',
      }));

    const closerStats = new Map<string, { wins: number; total: number }>();
    (data.drilldown ?? []).forEach(d => {
      if (!d.closer_name || d.closer_is_deleted) return;
      const cur = closerStats.get(d.closer_name) ?? { wins: 0, total: 0 };
      cur.total += 1;
      if (d.status === 'won') cur.wins += 1;
      closerStats.set(d.closer_name, cur);
    });
    closerStats.forEach((v, name) => {
      if (v.wins === 0) return;
      const rate = v.total ? (v.wins / v.total) * 100 : 0;
      items.push({
        name,
        role: 'Closer',
        metric: 'Vendas',
        metricValue: v.wins,
        status: rate >= 40 ? 'Alta performance' : rate >= 20 ? 'Em evolução' : 'Abaixo do esperado',
      });
    });

    return items.sort((a, b) => b.metricValue - a.metricValue).slice(0, 5);
  }, [data]);

  if (isLoading) {
    return (
      <div className="space-y-4">
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-24" />
          ))}
        </div>
        <Skeleton className="h-48" />
      </div>
    );
  }

  if (!cockpit || cockpit.qualified === 0 && cockpit.won === 0) {
    return (
      <EmptyState
        icon={Activity}
        title="Sem dados de desempenho no período"
        description="Nenhuma qualificação ou venda registrada para os filtros atuais. Selecione outro período ou revise os filtros."
      />
    );
  }

  return (
    <div className="space-y-6">
      {/* Cockpit cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        <PerformanceMetricCard icon={Users} label="Pessoas ativas" value={cockpit.activePeople} accent="indigo" />
        <PerformanceMetricCard icon={UserCheck} label="Leads qualificados" value={cockpit.qualified} accent="primary" />
        <PerformanceMetricCard icon={Trophy} label="Vendas realizadas" value={cockpit.won} accent="emerald" hint="Quantidade, não valor" />
        <PerformanceMetricCard icon={Percent} label="Conversão Qualif→Venda" value={fmtPct(cockpit.conversionRate)} accent="teal" />
        <PerformanceMetricCard icon={Clock} label="Ciclo médio" value={fmtDays(cockpit.avgCycle)} accent="amber" hint="Qualif → fechamento" />
        <PerformanceMetricCard icon={Sparkles} label="Qualidade média" value={fmtPct(cockpit.qualityScore)} accent="rose" hint="SQL → Proposta" />
      </div>

      {/* Pulso da operação + Ranking */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Activity className="h-4 w-4 text-indigo-600" />
              Pulso da operação
            </CardTitle>
          </CardHeader>
          <CardContent>
            {pulse.length === 0 ? (
              <p className="text-sm text-muted-foreground">Sem dados suficientes para gerar leitura do período.</p>
            ) : (
              <ul className="space-y-2">
                {pulse.map((p, i) => {
                  const Icon = p.tone === 'positive' ? TrendingUp : p.tone === 'negative' ? TrendingDown : Minus;
                  const color = p.tone === 'positive' ? 'text-emerald-600' : p.tone === 'negative' ? 'text-rose-600' : 'text-muted-foreground';
                  return (
                    <li key={i} className="flex items-start gap-2 text-sm">
                      <Icon className={`h-4 w-4 mt-0.5 shrink-0 ${color}`} />
                      <span>{p.text}</span>
                    </li>
                  );
                })}
              </ul>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Award className="h-4 w-4 text-amber-600" />
              Ranking do período
            </CardTitle>
          </CardHeader>
          <CardContent>
            {ranking.length === 0 ? (
              <p className="text-sm text-muted-foreground">Sem dados suficientes para ranking.</p>
            ) : (
              <ol className="space-y-2">
                {ranking.map((r, i) => (
                  <li key={`${r.role}-${r.name}-${i}`} className="flex items-center gap-3 p-2 rounded-lg hover:bg-muted/40">
                    <span className="h-7 w-7 rounded-full bg-muted flex items-center justify-center text-xs font-bold">
                      {i + 1}
                    </span>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{r.name}</p>
                      <p className="text-xs text-muted-foreground">{r.role} · {r.metric}: {r.metricValue}</p>
                    </div>
                    <Badge variant="outline" className={
                      r.status === 'Alta performance' ? 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20'
                      : r.status === 'Em evolução' ? 'bg-amber-500/10 text-amber-600 border-amber-500/20'
                      : 'bg-rose-500/10 text-rose-600 border-rose-500/20'
                    }>{r.status}</Badge>
                  </li>
                ))}
              </ol>
            )}
          </CardContent>
        </Card>
      </div>

      <Card className="border-dashed">
        <CardContent className="p-3 flex items-start gap-2 text-xs text-muted-foreground">
          <AlertCircle className="h-4 w-4 mt-0.5 text-muted-foreground shrink-0" />
          <span>
            Desempenho mede pessoas, produtividade e qualidade. Para receita válida, comissão e OTE consulte <strong>Objetivos → Resultados</strong>.
          </span>
        </CardContent>
      </Card>
    </div>
  );
}
