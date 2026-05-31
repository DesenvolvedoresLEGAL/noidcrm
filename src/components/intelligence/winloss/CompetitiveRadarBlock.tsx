import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Swords } from 'lucide-react';
import type { LossSemanticAggregates } from '@/hooks/useLossSemantic';

interface Props {
  semantic: LossSemanticAggregates | undefined;
}

const fmtBRL = (v: number) =>
  new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(v);

export function CompetitiveRadarBlock({ semantic }: Props) {
  const rows = (semantic?.competitorsAi || []).slice(0, 6);
  if (!semantic || rows.length === 0) return null;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Swords className="h-4 w-4 text-orange-500" />
          Radar Competitivo
        </CardTitle>
        <CardDescription>
          Concorrentes detectados (humano + IA), valor perdido e motivo dominante
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-2">
          {rows.map((r) => (
            <div
              key={r.competitor}
              className="flex items-center justify-between gap-3 p-3 rounded-md border bg-muted/30"
            >
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-semibold text-sm truncate">{r.competitor}</span>
                  <Badge variant="outline" className="text-[10px]">
                    {r.count} {r.count === 1 ? 'deal' : 'deals'}
                  </Badge>
                  {r.avgConfidence >= 70 && (
                    <Badge variant="outline" className="text-[10px] border-emerald-500/30 text-emerald-600">
                      Confiança {r.avgConfidence}%
                    </Badge>
                  )}
                </div>
                {r.dominantReason && (
                  <p className="text-xs text-muted-foreground mt-0.5 truncate">
                    Motivo dominante: <span className="font-medium">{r.dominantReason}</span>
                  </p>
                )}
              </div>
              <div className="text-right shrink-0">
                <div className="text-sm font-bold text-destructive">{fmtBRL(r.lostValue)}</div>
                <div className="text-[10px] text-muted-foreground uppercase tracking-wider">perdido</div>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
