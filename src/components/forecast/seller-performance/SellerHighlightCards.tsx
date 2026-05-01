import { Card, CardContent } from '@/components/ui/card';
import { TrendingUp, AlertTriangle, ShieldAlert, Sparkles } from 'lucide-react';
import { formatCurrencyFull } from '@/lib/i18n';
import type { ForecastSellerPerformance } from '@/types/forecast-seller';

interface Props {
  sellers: ForecastSellerPerformance[];
}

function pickMax<T>(items: T[], score: (s: T) => number | null | undefined): T | null {
  let best: T | null = null;
  let bestScore = -Infinity;
  for (const it of items) {
    const v = score(it);
    if (v == null) continue;
    if (v > bestScore) {
      best = it;
      bestScore = v;
    }
  }
  return best;
}

interface Highlight {
  icon: React.ReactNode;
  label: string;
  seller: string | null;
  value: string;
  emptyText?: string;
  tone: string;
}

function Tile({ h }: { h: Highlight }) {
  return (
    <Card className="border-border">
      <CardContent className="p-4 space-y-2">
        <div className="flex items-center gap-2 text-xs text-muted-foreground uppercase tracking-wide">
          <span className={h.tone}>{h.icon}</span>
          {h.label}
        </div>
        {h.seller ? (
          <>
            <p className="text-sm font-medium truncate">{h.seller}</p>
            <p className="text-lg font-semibold tabular-nums">{h.value}</p>
          </>
        ) : (
          <p className="text-sm text-muted-foreground py-2">{h.emptyText ?? 'Sem dados'}</p>
        )}
      </CardContent>
    </Card>
  );
}

export function SellerHighlightCards({ sellers }: Props) {
  const topRealistic = pickMax(sellers, (s) => s.scenario_realistic);
  const topGap = pickMax(
    sellers.filter((s) => s.has_goal && (s.gap_to_goal ?? 0) > 0),
    (s) => s.gap_to_goal
  );
  const anyGoal = sellers.some((s) => s.has_goal);
  const topRisk = pickMax(sellers, (s) => s.risk_amount);
  const topHygiene = pickMax(
    sellers,
    (s) => s.forecast_confidence * 1000 + s.nrhs_avg
  );

  const tiles: Highlight[] = [
    {
      icon: <TrendingUp className="h-4 w-4" />,
      label: 'Maior Forecast Realista',
      seller: topRealistic?.seller_name ?? null,
      value: topRealistic ? formatCurrencyFull(topRealistic.scenario_realistic) : '—',
      tone: 'text-emerald-500',
    },
    {
      icon: <AlertTriangle className="h-4 w-4" />,
      label: 'Maior Gap',
      seller: anyGoal ? topGap?.seller_name ?? null : null,
      value: topGap?.gap_to_goal != null ? formatCurrencyFull(topGap.gap_to_goal) : '—',
      emptyText: anyGoal ? 'Todos atingiram a meta' : 'Metas não configuradas',
      tone: 'text-amber-500',
    },
    {
      icon: <ShieldAlert className="h-4 w-4" />,
      label: 'Maior Risco',
      seller: topRisk?.seller_name ?? null,
      value: topRisk
        ? `${formatCurrencyFull(topRisk.risk_amount)} · ${topRisk.risk_deals_count} deal${topRisk.risk_deals_count === 1 ? '' : 's'}`
        : '—',
      tone: 'text-rose-500',
    },
    {
      icon: <Sparkles className="h-4 w-4" />,
      label: 'Melhor Higiene',
      seller: topHygiene?.seller_name ?? null,
      value: topHygiene
        ? `Confiança ${Math.round(topHygiene.forecast_confidence)} · NRHS ${Math.round(topHygiene.nrhs_avg)}`
        : '—',
      tone: 'text-sky-500',
    },
  ];

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
      {tiles.map((t, i) => (
        <Tile key={i} h={t} />
      ))}
    </div>
  );
}
