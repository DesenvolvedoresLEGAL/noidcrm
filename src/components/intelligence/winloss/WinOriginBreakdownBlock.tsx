// Sprint WL-WINS-06 — Vitórias por Canal de Origem.
// Bloco determinístico para a aba Wins. Sem IA efêmera.
// Reaproveita dataset do useWinLossData (wins + losses já filtrados por escopo).
import { useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Crown, Zap, DollarSign, Target, Compass } from 'lucide-react';
import type { WinLossDataResult, WinLossDeal } from '@/hooks/useWinLossData';

interface Props {
  data: WinLossDataResult | undefined;
}

const fmtBRL = (v: number) =>
  new Intl.NumberFormat('pt-BR', {
    style: 'currency', currency: 'BRL',
    minimumFractionDigits: 0, maximumFractionDigits: 0,
  }).format(v);

export interface OriginRow {
  channel: string;
  won: number;
  totalOpps: number;
  revenue: number;
  avgTicket: number;
  avgCycle: number | null;
  winRate: number | null; // null when no opps in scope (shouldn't happen since won>=1)
  topDriver: string;
}

export function buildWinOriginBreakdown(data: WinLossDataResult | undefined): {
  rows: OriginRow[];
  totalWonRevenue: number;
  totalWins: number;
  winsWithoutOrigin: number;
} {
  if (!data) {
    return { rows: [], totalWonRevenue: 0, totalWins: 0, winsWithoutOrigin: 0 };
  }

  const resolveChannel = (d: WinLossDeal): string | null => {
    const opp: any = d.opportunity || {};
    const raw =
      opp.origem ||
      opp.fonte ||
      opp.lead_source ||
      opp.acquisition_channel ||
      opp.origin_name ||
      opp.source ||
      null;
    if (!raw || typeof raw !== 'string') return null;
    const trimmed = raw.trim();
    return trimmed.length > 0 ? trimmed : null;
  };

  // Normaliza (case-insensitive) mas preserva primeiro casing visto
  const map = new Map<string, {
    display: string;
    won: number;
    totalOpps: number;
    revenue: number;
    cycleSum: number;
    cycleCount: number;
    reasons: Map<string, number>;
  }>();

  let totalWins = 0;
  let winsWithoutOrigin = 0;
  let totalWonRevenue = 0;

  for (const w of data.wins) {
    totalWins++;
    totalWonRevenue += Number(w.final_value) || 0;
    const ch = resolveChannel(w);
    if (!ch) { winsWithoutOrigin++; continue; }
    const key = ch.toLowerCase();
    const entry = map.get(key) || {
      display: ch, won: 0, totalOpps: 0, revenue: 0,
      cycleSum: 0, cycleCount: 0, reasons: new Map<string, number>(),
    };
    entry.won++;
    entry.totalOpps++;
    entry.revenue += Number(w.final_value) || 0;
    if (w.sales_cycle_days > 0) { entry.cycleSum += w.sales_cycle_days; entry.cycleCount++; }
    const reason = w.win_reason_name
      || (w.acceptor_name && !w.win_reason_id ? 'Sem motivo selecionado' : 'Não informado');
    entry.reasons.set(reason, (entry.reasons.get(reason) || 0) + 1);
    map.set(key, entry);
  }

  // Losses para Win Rate por canal (somente para canais já vistos OU presentes em losses)
  for (const l of data.losses) {
    const ch = resolveChannel(l);
    if (!ch) continue;
    const key = ch.toLowerCase();
    const entry = map.get(key);
    if (!entry) continue; // só consideramos canais que apareceram em wins (foco do bloco)
    entry.totalOpps++;
  }

  const rows: OriginRow[] = [...map.values()].map(e => ({
    channel: e.display,
    won: e.won,
    totalOpps: e.totalOpps,
    revenue: e.revenue,
    avgTicket: e.won > 0 ? Math.round(e.revenue / e.won) : 0,
    avgCycle: e.cycleCount > 0 ? Math.round(e.cycleSum / e.cycleCount) : null,
    winRate: e.totalOpps > 0 ? Math.round((e.won / e.totalOpps) * 100) : null,
    topDriver: topReason(e.reasons),
  }));

  rows.sort((a, b) => b.revenue - a.revenue || b.won - a.won);

  return { rows, totalWonRevenue, totalWins, winsWithoutOrigin };
}

function topReason(m: Map<string, number>): string {
  const top = [...m.entries()].sort((a, b) => b[1] - a[1])[0];
  if (!top) return 'Não informado';
  return top[0];
}

export function WinOriginBreakdownBlock({ data }: Props) {
  const { rows, totalWonRevenue, totalWins, winsWithoutOrigin } = useMemo(
    () => buildWinOriginBreakdown(data),
    [data],
  );

  const missingRatio = totalWins > 0 ? Math.round((winsWithoutOrigin / totalWins) * 100) : 0;

  // Estado vazio
  if (rows.length === 0) {
    return (
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-1.5">
            <Compass className="h-4 w-4" /> Vitórias por Canal de Origem
          </CardTitle>
          <CardDescription className="text-xs">
            Canais de aquisição que mais geram negócios ganhos no período.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="rounded-md border border-dashed bg-muted/30 p-4 text-sm">
            <p className="font-medium">Sem origem suficiente nas vitórias do período.</p>
            <p className="text-xs text-muted-foreground mt-1">
              Preencha o canal de origem nas oportunidades para entender quais canais realmente geram receita.
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  // KPIs
  const champion = rows[0]; // já ordenado por receita
  const championPct = totalWonRevenue > 0
    ? Math.round((champion.revenue / totalWonRevenue) * 100)
    : 0;

  const eligibleCycle = rows.filter(r => r.won >= 2 && r.avgCycle != null);
  const fastest = eligibleCycle.length > 0
    ? [...eligibleCycle].sort((a, b) => (a.avgCycle! - b.avgCycle!))[0]
    : null;

  const eligibleTicket = rows.filter(r => r.won >= 2);
  const bestTicket = eligibleTicket.length > 0
    ? [...eligibleTicket].sort((a, b) => b.avgTicket - a.avgTicket)[0]
    : null;

  const eligibleWinRate = rows.filter(r => r.totalOpps >= 3 && r.winRate != null);
  const bestWinRate = eligibleWinRate.length > 0
    ? [...eligibleWinRate].sort((a, b) => (b.winRate! - a.winRate!))[0]
    : null;

  // Insight determinístico
  let insight: string;
  if (!bestWinRate) {
    insight = 'Volume insuficiente para identificar um canal vencedor com confiança.';
  } else if (bestWinRate.channel.toLowerCase() === champion.channel.toLowerCase()) {
    insight = 'O canal que mais gera receita também apresenta a melhor taxa de conversão. Priorize expansão desse canal.';
  } else {
    insight = 'O canal que mais gera receita não é o que melhor converte. Compare volume, ticket e ciclo antes de realocar esforço comercial.';
  }

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm flex items-center gap-1.5">
          <Compass className="h-4 w-4" /> Vitórias por Canal de Origem
        </CardTitle>
        <CardDescription className="text-xs">
          Canais de aquisição que mais geram negócios ganhos no período.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Mini KPIs */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-2">
          <MiniKpi
            icon={Crown}
            label="Canal Campeão"
            primary={champion.channel}
            secondary={`${fmtBRL(champion.revenue)} · ${champion.won} ${champion.won === 1 ? 'ganho' : 'ganhos'} · ${championPct}% da receita`}
            accent
          />
          <MiniKpi
            icon={Zap}
            label="Canal Mais Rápido"
            primary={fastest?.channel}
            secondary={fastest ? `${fastest.avgCycle}d · ${fastest.won} ${fastest.won === 1 ? 'ganho' : 'ganhos'}` : undefined}
          />
          <MiniKpi
            icon={DollarSign}
            label="Melhor Ticket Médio"
            primary={bestTicket?.channel}
            secondary={bestTicket ? `${fmtBRL(bestTicket.avgTicket)} · ${bestTicket.won} ${bestTicket.won === 1 ? 'ganho' : 'ganhos'}` : undefined}
          />
          <MiniKpi
            icon={Target}
            label="Melhor Win Rate"
            primary={bestWinRate?.channel}
            secondary={bestWinRate ? `${bestWinRate.winRate}% · ${bestWinRate.won}/${bestWinRate.totalOpps}` : undefined}
          />
        </div>

        {/* Insight determinístico */}
        <p className="text-xs italic text-muted-foreground border-l-2 border-emerald-500/40 pl-3">
          {insight}
        </p>

        {/* Tabela */}
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-[11px] uppercase tracking-wider text-muted-foreground border-b">
                <th className="text-left font-medium py-2 pr-3">Canal</th>
                <th className="text-right font-medium py-2 px-2">Ganhos</th>
                <th className="text-right font-medium py-2 px-2">Receita</th>
                <th className="text-right font-medium py-2 px-2">Ticket médio</th>
                <th className="text-right font-medium py-2 px-2">Ciclo médio</th>
                <th className="text-right font-medium py-2 px-2">Win Rate</th>
                <th className="text-left font-medium py-2 pl-3">Principal driver</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.channel} className="border-b border-border/40 last:border-0">
                  <td className="py-2 pr-3 truncate max-w-[220px]">{r.channel}</td>
                  <td className="py-2 px-2 text-right tabular-nums">{r.won}</td>
                  <td className="py-2 px-2 text-right tabular-nums text-emerald-700 dark:text-emerald-400 font-medium">
                    {fmtBRL(r.revenue)}
                  </td>
                  <td className="py-2 px-2 text-right tabular-nums text-muted-foreground">
                    {fmtBRL(r.avgTicket)}
                  </td>
                  <td className="py-2 px-2 text-right tabular-nums text-muted-foreground">
                    {r.avgCycle != null ? `${r.avgCycle}d` : '—'}
                  </td>
                  <td className="py-2 px-2 text-right tabular-nums text-muted-foreground">
                    {r.winRate != null && r.totalOpps >= 3 ? `${r.winRate}%` : (
                      <span title="Volume insuficiente">—</span>
                    )}
                  </td>
                  <td className="py-2 pl-3 text-xs text-muted-foreground truncate max-w-[200px]">
                    {r.topDriver}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {missingRatio > 30 && (
          <p className="text-[11px] text-muted-foreground italic">
            {missingRatio}% das vitórias do período estão sem canal de origem. Isso reduz a precisão da análise.
          </p>
        )}
      </CardContent>
    </Card>
  );
}

interface MiniKpiProps {
  icon: any;
  label: string;
  primary?: string;
  secondary?: string;
  accent?: boolean;
}
function MiniKpi({ icon: Icon, label, primary, secondary, accent }: MiniKpiProps) {
  const empty = !primary;
  return (
    <div className={`rounded-lg border p-3 ${accent && !empty ? 'border-emerald-500/30 bg-emerald-500/5' : 'bg-card'}`}>
      <div className="flex items-center gap-1.5 text-[11px] uppercase tracking-wider text-muted-foreground">
        <Icon className="h-3.5 w-3.5" />
        {label}
      </div>
      {empty ? (
        <>
          <p className="mt-1 text-sm font-semibold">—</p>
          <p className="text-[11px] text-muted-foreground mt-0.5">Volume insuficiente</p>
        </>
      ) : (
        <>
          <p className={`mt-1 text-sm font-semibold truncate ${accent ? 'text-emerald-700 dark:text-emerald-400' : ''}`}>
            {primary}
          </p>
          {secondary && (
            <p className="text-[11px] text-muted-foreground mt-0.5 truncate">{secondary}</p>
          )}
        </>
      )}
    </div>
  );
}
