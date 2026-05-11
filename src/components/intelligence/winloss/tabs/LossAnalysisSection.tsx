import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Skeleton } from '@/components/ui/skeleton';
import { BarChart3, Users, Target, MessageSquare, TrendingUp, TrendingDown, Minus } from 'lucide-react';
import { LOSS_CATEGORY_LABELS } from '@/utils/category-labels';
import { aggregateLossesByCategory } from '@/lib/winloss/diagnosis';
import type { WinLossDataResult, DateRange } from '@/hooks/useWinLossData';

interface Props {
  data: WinLossDataResult | undefined;
  isLoading: boolean;
  lostLabel: string;
  dateRange?: DateRange;
}

const fmtBRL = (v: number) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(v);

export function LossAnalysisSection({ data, isLoading, dateRange }: Props) {
  // Pré-calcula valor perdido por categoria canônica para enriquecer "Top Motivos de Perda".
  const lostValueByCategory = new Map<string, number>();
  if (data?.losses) {
    for (const l of data.losses) {
      const cat = (l.reason as any)?.category || 'other';
      lostValueByCategory.set(cat, (lostValueByCategory.get(cat) || 0) + (Number(l.final_value) || 0));
    }
  }

  const categoryAggregates = data ? aggregateLossesByCategory(data.losses, dateRange) : [];

  return (
    <div className="space-y-4">
      <h2 className="text-lg font-semibold flex items-center gap-2">
        <BarChart3 className="h-5 w-5 text-red-500" />
        Análise de Perdas
      </h2>
      <div className="grid lg:grid-cols-3 gap-4">
        {/* Top Motivos de Perda — enriquecido com valor perdido */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-sm">
              <BarChart3 className="h-4 w-4 text-red-500" />
              Top Motivos de Perda
            </CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? <LoadingSkeleton /> : data?.lossReasonsByMacro && data.lossReasonsByMacro.length > 0 ? (
              <div className="space-y-3">
                {data.lossReasonsByMacro.map((macro, i) => {
                  const total = data.lossReasonsByMacro.reduce((s, r) => s + r.count, 0);
                  const pct = total > 0 ? Math.round((macro.count / total) * 100) : 0;
                  const macroLabel = LOSS_CATEGORY_LABELS[macro.category] || macro.category;
                  const lostVal = lostValueByCategory.get(macro.category) || 0;
                  return (
                    <div key={i} className="space-y-1.5">
                      <div className="flex items-center justify-between text-xs">
                        <span className="font-semibold">{macroLabel}</span>
                        <span className="text-muted-foreground">{pct}% ({macro.count})</span>
                      </div>
                      <Progress value={pct} className="h-1.5 [&>div]:bg-red-500" />
                      <p className="text-[11px] text-muted-foreground">
                        {macro.count} deals · {pct}% · <span className="font-medium text-red-500">{fmtBRL(lostVal)} perdidos</span>
                      </p>
                      {macro.specifics.length > 0 && (
                        <div className="pl-2 mt-1 space-y-0.5">
                          {macro.specifics.map((s, j) => (
                            <div key={j} className="flex items-center justify-between text-[11px] text-muted-foreground">
                              <span className="truncate">↳ {s.name}</span>
                              <span className="ml-2">({s.count})</span>
                            </div>
                          ))}
                        </div>
                      )}
                      {macro.competitors && macro.competitors.length > 0 && (
                        <div className="flex flex-wrap gap-1 pl-2 pt-1">
                          {macro.competitors.map((c, k) => (
                            <Badge key={k} variant="outline" className="text-[10px] h-4 border-orange-500/30 text-orange-600">
                              {c}
                            </Badge>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            ) : <EmptyState text="Nenhum dado de perda" />}
          </CardContent>
        </Card>

        {/* Concorrentes */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-sm">
              <Users className="h-4 w-4 text-orange-500" />
              Perdas por Concorrente
            </CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? <LoadingSkeleton /> : data?.competitors && data.competitors.length > 0 ? (
              <div className="space-y-2">
                {data.competitors.map((item, i) => (
                  <div key={i} className="flex items-center justify-between p-2 rounded-lg bg-muted/50">
                    <span className="font-medium text-xs">{item.competitor}</span>
                    <Badge variant="secondary" className="bg-orange-500/10 text-orange-600 text-xs">{item.count}</Badge>
                  </div>
                ))}
              </div>
            ) : <EmptyState text="Nenhum concorrente" />}
          </CardContent>
        </Card>

        {/* Por que estamos perdendo (substitui "Fatores de Perda") */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-sm">
              <Target className="h-4 w-4 text-red-500" />
              Por que estamos perdendo
            </CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? <LoadingSkeleton /> : categoryAggregates.length > 0 ? (
              <div className="space-y-2.5">
                {categoryAggregates.map((cat) => (
                  <div key={cat.category} className="p-2 rounded-lg border bg-muted/30 space-y-1">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-xs font-semibold truncate">{cat.label}</span>
                      <div className="flex items-center gap-1.5 shrink-0">
                        <span className="text-[10px] text-muted-foreground">{cat.pct}%</span>
                        <Badge variant="secondary" className="text-[10px] h-5">{cat.count}</Badge>
                      </div>
                    </div>
                    <div className="flex items-center justify-between text-[11px]">
                      <span className="text-red-500 font-medium">{fmtBRL(cat.lostValue)} perdidos</span>
                      <TrendBadge trendPp={cat.trendPp} />
                    </div>
                    <p className="text-[11px] text-muted-foreground italic leading-snug">
                      → {cat.recommendation}
                    </p>
                  </div>
                ))}
              </div>
            ) : <EmptyState text="Nenhum motivo classificado" />}
          </CardContent>
        </Card>
      </div>

      {/* Loss feedbacks */}
      {data?.lossFeedbacks && data.lossFeedbacks.length > 0 && (
        <Card className="border-rose-500/20">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-sm">
              <MessageSquare className="h-4 w-4 text-rose-500" />
              Feedback das Recusas
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-2">
              {data.lossFeedbacks.map((item, i) => (
                <div key={i} className="p-2.5 rounded-lg bg-rose-500/5 border border-rose-500/10">
                  <p className="text-xs italic line-clamp-2">"{item.feedback}"</p>
                  <div className="flex items-center gap-1.5 mt-1.5 flex-wrap">
                    {item.lossReason && <Badge variant="outline" className="text-[10px] border-rose-500/30">{item.lossReason}</Badge>}
                    {item.competitor && <Badge variant="secondary" className="text-[10px] bg-orange-500/10 text-orange-600">→ {item.competitor}</Badge>}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function TrendBadge({ trendPp }: { trendPp: number | null }) {
  if (trendPp == null) return <span className="text-[10px] text-muted-foreground">tendência —</span>;
  if (trendPp === 0) {
    return (
      <span className="flex items-center gap-0.5 text-[10px] text-muted-foreground">
        <Minus className="h-3 w-3" /> estável
      </span>
    );
  }
  const up = trendPp > 0;
  return (
    <span className={`flex items-center gap-0.5 text-[10px] font-medium ${up ? 'text-red-500' : 'text-emerald-500'}`}>
      {up ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
      {up ? '+' : ''}{trendPp}pp vs. anterior
    </span>
  );
}

function LoadingSkeleton() {
  return <div className="space-y-3">{[1, 2, 3].map(i => <Skeleton key={i} className="h-8 w-full" />)}</div>;
}
function EmptyState({ text }: { text: string }) {
  return <div className="text-center py-4 text-muted-foreground"><p className="text-xs">{text}</p></div>;
}
