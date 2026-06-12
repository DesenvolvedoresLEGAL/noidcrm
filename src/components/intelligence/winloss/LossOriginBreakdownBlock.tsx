// Sprint WL-LOSSES-06 — Perdas por Canal de Origem.
// Bloco determinístico para a aba Losses. Sem IA efêmera.
// Reaproveita dataset do useWinLossData (losses + wins já filtrados por escopo).
// Accountability vem de loss_reasons.loss_accountability (oficial, banco).
import { useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Compass, AlertOctagon, TrendingDown, DollarSign, Target } from 'lucide-react';
import type { WinLossDataResult, WinLossDeal } from '@/hooks/useWinLossData';
import type { LossAccountability } from '@/lib/winloss/diagnosis';

const ACCOUNTABILITY_LABELS: Record<LossAccountability, string> = {
  commercial: 'Comercial',
  client: 'Cliente',
  operations: 'Operacional',
  market: 'Mercado',
  unknown: 'Não classificado',
};

interface Props {
  data: WinLossDataResult | undefined;
}

const fmtBRL = (v: number) =>
  new Intl.NumberFormat('pt-BR', {
    style: 'currency', currency: 'BRL',
    minimumFractionDigits: 0, maximumFractionDigits: 0,
  }).format(v);

export interface LossOriginRow {
  channel: string;
  lost: number;
  totalOpps: number;
  lostValue: number;
  avgTicket: number;
  avgCycle: number | null;
  lossRate: number | null;
  topReason: string;
  topCategory: string;
  topAccountability: LossAccountability;
}

function resolveChannel(d: WinLossDeal): string | null {
  const opp: any = d.opportunity || {};
  const raw =
    opp.origem ||
    opp.origin ||
    opp.fonte ||
    opp.lead_source ||
    opp.acquisition_channel ||
    opp.origin_name ||
    opp.source ||
    null;
  if (!raw || typeof raw !== 'string') return null;
  const trimmed = raw.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function topKey<T extends string>(m: Map<T, number>): T | undefined {
  const top = [...m.entries()].sort((a, b) => b[1] - a[1])[0];
  return top?.[0];
}

export function buildLossOriginBreakdown(data: WinLossDataResult | undefined): {
  rows: LossOriginRow[];
  totalLostValue: number;
  totalLosses: number;
  lossesWithoutOrigin: number;
} {
  if (!data) {
    return { rows: [], totalLostValue: 0, totalLosses: 0, lossesWithoutOrigin: 0 };
  }

  const map = new Map<string, {
    display: string;
    lost: number;
    totalOpps: number;
    lostValue: number;
    cycleSum: number;
    cycleCount: number;
    reasons: Map<string, number>;
    categories: Map<string, number>;
    accountabilities: Map<LossAccountability, number>;
  }>();

  let totalLosses = 0;
  let lossesWithoutOrigin = 0;
  let totalLostValue = 0;

  for (const l of data.losses) {
    totalLosses++;
    totalLostValue += Number(l.final_value) || 0;
    const ch = resolveChannel(l);
    if (!ch) { lossesWithoutOrigin++; continue; }
    const key = ch.toLowerCase();
    const entry = map.get(key) || {
      display: ch, lost: 0, totalOpps: 0, lostValue: 0,
      cycleSum: 0, cycleCount: 0,
      reasons: new Map<string, number>(),
      categories: new Map<string, number>(),
      accountabilities: new Map<LossAccountability, number>(),
    };
    entry.lost++;
    entry.totalOpps++;
    entry.lostValue += Number(l.final_value) || 0;
    if (l.sales_cycle_days > 0) { entry.cycleSum += l.sales_cycle_days; entry.cycleCount++; }
    const reasonObj: any = l.reason || {};
    const reasonName = reasonObj.name || 'Não informado';
    const category = reasonObj.category || 'other';
    const accountability: LossAccountability = (reasonObj.loss_accountability as LossAccountability) || 'unknown';
    entry.reasons.set(reasonName, (entry.reasons.get(reasonName) || 0) + 1);
    entry.categories.set(category, (entry.categories.get(category) || 0) + 1);
    entry.accountabilities.set(accountability, (entry.accountabilities.get(accountability) || 0) + 1);
    map.set(key, entry);
  }

  // Wins do mesmo canal para cálculo de Loss Rate
  for (const w of data.wins) {
    const ch = resolveChannel(w);
    if (!ch) continue;
    const key = ch.toLowerCase();
    const entry = map.get(key);
    if (!entry) continue;
    entry.totalOpps++;
  }

  const rows: LossOriginRow[] = [...map.values()].map(e => ({
    channel: e.display,
    lost: e.lost,
    totalOpps: e.totalOpps,
    lostValue: e.lostValue,
    avgTicket: e.lost > 0 ? Math.round(e.lostValue / e.lost) : 0,
    avgCycle: e.cycleCount > 0 ? Math.round(e.cycleSum / e.cycleCount) : null,
    lossRate: e.totalOpps > 0 ? Math.round((e.lost / e.totalOpps) * 100) : null,
    topReason: topKey(e.reasons) || 'Não informado',
    topCategory: topKey(e.categories) || 'other',
    topAccountability: topKey(e.accountabilities) || 'unknown',
  }));

  rows.sort((a, b) => b.lostValue - a.lostValue || b.lost - a.lost);

  return { rows, totalLostValue, totalLosses, lossesWithoutOrigin };
}

export function LossOriginBreakdownBlock({ data }: Props) {
  const { rows, totalLostValue, totalLosses, lossesWithoutOrigin } = useMemo(
    () => buildLossOriginBreakdown(data),
    [data],
  );

  const missingRatio = totalLosses > 0 ? Math.round((lossesWithoutOrigin / totalLosses) * 100) : 0;

  if (rows.length === 0) {
    return (
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-1.5">
            <Compass className="h-4 w-4" /> Perdas por Canal de Origem
          </CardTitle>
          <CardDescription className="text-xs">
            Canais de aquisição que mais concentram negócios perdidos no período.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="rounded-md border border-dashed bg-muted/30 p-4 text-sm">
            <p className="font-medium">Sem origem suficiente nas perdas do período.</p>
            <p className="text-xs text-muted-foreground mt-1">
              Preencha o canal de origem nas oportunidades para entender quais canais geram mais perdas e vazamento de receita.
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  // KPIs
  const biggestLoss = rows[0]; // ordenado por valor perdido
  const biggestPct = totalLostValue > 0
    ? Math.round((biggestLoss.lostValue / totalLostValue) * 100)
    : 0;

  const mostLosses = [...rows].sort((a, b) => b.lost - a.lost || b.lostValue - a.lostValue)[0];

  const eligibleTicket = rows.filter(r => r.lost >= 2);
  const biggestTicket = eligibleTicket.length > 0
    ? [...eligibleTicket].sort((a, b) => b.avgTicket - a.avgTicket)[0]
    : null;

  const eligibleLossRate = rows.filter(r => r.totalOpps >= 3 && r.lossRate != null);
  const worstLossRate = eligibleLossRate.length > 0
    ? [...eligibleLossRate].sort((a, b) => (b.lossRate! - a.lossRate!))[0]
    : null;

  // Insight determinístico
  let insight: string;
  if (worstLossRate && worstLossRate.channel.toLowerCase() === biggestLoss.channel.toLowerCase()) {
    insight = 'O canal que mais concentra valor perdido também apresenta a maior taxa de perda. Revise imediatamente qualificação, promessa comercial e expectativa gerada nesse canal.';
  } else if (worstLossRate) {
    insight = 'O canal que mais gera valor perdido não é necessariamente o que mais perde proporcionalmente. Compare volume, ticket e qualidade antes de cortar investimento.';
  } else {
    insight = 'Volume insuficiente em outros canais para comparar taxa de perda — analise apenas valor perdido por enquanto.';
  }

  // Accountability insight (canal dominante = biggestLoss)
  let accountabilityInsight: string | null = null;
  switch (biggestLoss.topAccountability) {
    case 'commercial':
      accountabilityInsight = 'As perdas deste canal estão mais ligadas a processo comercial. Revise cadência, SLA e abordagem do time.';
      break;
    case 'market':
      accountabilityInsight = 'As perdas deste canal estão mais ligadas a mercado/concorrência. Reforce diferenciais, battlecards e posicionamento.';
      break;
    case 'client':
      accountabilityInsight = 'As perdas deste canal estão mais ligadas ao cliente. Revise qualificação, budget e fit.';
      break;
    case 'operations':
      accountabilityInsight = 'As perdas deste canal estão mais ligadas a operação/entrega. Revise capacidade, prazos e expectativas geradas.';
      break;
    default:
      accountabilityInsight = null;
  }

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm flex items-center gap-1.5">
          <Compass className="h-4 w-4" /> Perdas por Canal de Origem
        </CardTitle>
        <CardDescription className="text-xs">
          Canais de aquisição que mais concentram negócios perdidos no período.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Mini KPIs */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-2">
          <MiniKpi
            icon={AlertOctagon}
            label="Canal com Maior Perda"
            primary={biggestLoss.channel}
            secondary={`${fmtBRL(biggestLoss.lostValue)} · ${biggestLoss.lost} ${biggestLoss.lost === 1 ? 'perda' : 'perdas'} · ${biggestPct}% do valor perdido`}
            accent
          />
          <MiniKpi
            icon={TrendingDown}
            label="Canal com Mais Perdas"
            primary={mostLosses.channel}
            secondary={`${mostLosses.lost} ${mostLosses.lost === 1 ? 'perda' : 'perdas'} · ${fmtBRL(mostLosses.lostValue)}`}
          />
          <MiniKpi
            icon={DollarSign}
            label="Maior Ticket Perdido"
            primary={biggestTicket?.channel}
            secondary={biggestTicket ? `${fmtBRL(biggestTicket.avgTicket)} · ${biggestTicket.lost} ${biggestTicket.lost === 1 ? 'perda' : 'perdas'}` : undefined}
          />
          <MiniKpi
            icon={Target}
            label="Maior Taxa de Perda"
            primary={worstLossRate?.channel}
            secondary={worstLossRate ? `${worstLossRate.lossRate}% · ${worstLossRate.lost}/${worstLossRate.totalOpps}` : undefined}
          />
        </div>

        {/* Insights determinísticos */}
        <div className="space-y-1.5">
          <p className="text-xs italic text-muted-foreground border-l-2 border-rose-500/40 pl-3">
            {insight}
          </p>
          {accountabilityInsight && (
            <p className="text-xs italic text-muted-foreground border-l-2 border-rose-500/40 pl-3">
              {accountabilityInsight}
            </p>
          )}
        </div>

        {/* Tabela */}
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-[11px] uppercase tracking-wider text-muted-foreground border-b">
                <th className="text-left font-medium py-2 pr-3">Canal</th>
                <th className="text-right font-medium py-2 px-2">Perdas</th>
                <th className="text-right font-medium py-2 px-2">Valor perdido</th>
                <th className="text-right font-medium py-2 px-2">Ticket médio</th>
                <th className="text-right font-medium py-2 px-2">Ciclo médio</th>
                <th className="text-left font-medium py-2 px-3">Principal motivo</th>
                <th className="text-left font-medium py-2 pl-3">Accountability</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.channel} className="border-b border-border/40 last:border-0">
                  <td className="py-2 pr-3 truncate max-w-[220px]">{r.channel}</td>
                  <td className="py-2 px-2 text-right tabular-nums">{r.lost}</td>
                  <td className="py-2 px-2 text-right tabular-nums text-rose-700 dark:text-rose-400 font-medium">
                    {fmtBRL(r.lostValue)}
                  </td>
                  <td className="py-2 px-2 text-right tabular-nums text-muted-foreground">
                    {fmtBRL(r.avgTicket)}
                  </td>
                  <td className="py-2 px-2 text-right tabular-nums text-muted-foreground">
                    {r.avgCycle != null ? `${r.avgCycle}d` : '—'}
                  </td>
                  <td className="py-2 px-3 text-xs text-muted-foreground truncate max-w-[200px]">
                    {r.topReason}
                  </td>
                  <td className="py-2 pl-3 text-xs text-muted-foreground truncate max-w-[140px]">
                    {ACCOUNTABILITY_LABELS[r.topAccountability]}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {missingRatio > 30 && (
          <p className="text-[11px] text-muted-foreground italic">
            {missingRatio}% das perdas do período estão sem canal de origem. Isso reduz a precisão da análise.
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
    <div className={`rounded-lg border p-3 ${accent && !empty ? 'border-rose-500/30 bg-rose-500/5' : 'bg-card'}`}>
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
          <p className={`mt-1 text-sm font-semibold truncate ${accent ? 'text-rose-700 dark:text-rose-400' : ''}`}>
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
