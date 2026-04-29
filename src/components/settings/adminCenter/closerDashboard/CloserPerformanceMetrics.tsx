import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import type { CloserPerformanceSummary } from '@/services/crm/closerDashboardObservability';

interface Props {
  perf?: CloserPerformanceSummary;
}

function fmt(ms: number | null) {
  return ms == null ? '—' : `${ms} ms`;
}

export function CloserPerformanceMetrics({ perf }: Props) {
  if (!perf) return null;
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Performance em fases</CardTitle>
        <CardDescription>Tempos médios por etapa do carregamento (7d).</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3 text-sm">
          <div><span className="text-muted-foreground">Gate:</span> {fmt(perf.avgGateMs)}</div>
          <div><span className="text-muted-foreground">Shell:</span> {fmt(perf.avgShellMs)}</div>
          <div><span className="text-muted-foreground">Closer data:</span> {fmt(perf.avgCloserDataMs)}</div>
          <div><span className="text-muted-foreground">Pace:</span> {fmt(perf.avgPaceMs)}</div>
          <div><span className="text-muted-foreground">Total interativo:</span> {fmt(perf.avgTotalInteractiveMs)}</div>
          <div><span className="text-muted-foreground">Máximo:</span> {fmt(perf.maxTotalInteractiveMs)}</div>
        </div>
        <div className="mt-3 flex gap-3 text-xs text-muted-foreground">
          <span>good: {perf.goodCount}</span>
          <span>attention: {perf.attentionCount}</span>
          <span>slow: {perf.slowCount}</span>
        </div>
      </CardContent>
    </Card>
  );
}
