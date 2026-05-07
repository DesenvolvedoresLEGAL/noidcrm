import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Skeleton } from '@/components/ui/skeleton';
import { BarChart3, Users, PieChart, DollarSign, Clock, Zap, Target, AlertTriangle, Info, Activity, MessageSquare } from 'lucide-react';
import { LOSS_CATEGORY_LABELS } from '@/utils/category-labels';
import type { WinLossDataResult } from '@/hooks/useWinLossData';

interface Props {
  data: WinLossDataResult | undefined;
  isLoading: boolean;
  lostLabel: string;
}

export function LossAnalysisSection({ data, isLoading, lostLabel }: Props) {
  const totalFactors = data ? Object.values(data.factors).reduce((s, v) => s + v, 0) : 0;

  return (
    <div className="space-y-4">
      <h2 className="text-lg font-semibold flex items-center gap-2">
        <BarChart3 className="h-5 w-5 text-red-500" />
        Análise de Perdas
      </h2>
      <div className="grid lg:grid-cols-3 gap-4">
        {/* Top Loss Reasons - Macro -> Specific */}
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
                  return (
                    <div key={i} className="space-y-1.5">
                      <div className="flex items-center justify-between text-xs">
                        <span className="font-semibold">{macroLabel}</span>
                        <span className="text-muted-foreground">{pct}% ({macro.count})</span>
                      </div>
                      <Progress value={pct} className="h-1.5 [&>div]:bg-red-500" />
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

        {/* Competitors */}
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

        {/* Factors */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-sm">
              <PieChart className="h-4 w-4 text-red-500" />
              Fatores de Perda
            </CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? <LoadingSkeleton /> : totalFactors > 0 ? (
              <div className="space-y-2">
                {Object.entries(data?.factors || {})
                  .filter(([, c]) => c > 0)
                  .sort(([, a], [, b]) => b - a)
                  .map(([key, count]) => {
                    const pct = Math.round((count / totalFactors) * 100);
                    const label = LOSS_CATEGORY_LABELS[key] || key;
                    const iconMap: Record<string, { icon: any; color: string }> = {
                      price: { icon: DollarSign, color: 'text-red-500' },
                      timing: { icon: Clock, color: 'text-yellow-500' },
                      feature: { icon: Zap, color: 'text-blue-500' },
                      relationship: { icon: Users, color: 'text-purple-500' },
                      competition: { icon: Target, color: 'text-orange-500' },
                      operational: { icon: Activity, color: 'text-slate-500' },
                      internal: { icon: AlertTriangle, color: 'text-red-400' },
                      other: { icon: Info, color: 'text-muted-foreground' },
                    };
                    const { icon: Icon, color } = iconMap[key] || { icon: Info, color: 'text-muted-foreground' };
                    return (
                      <div key={key} className="flex items-center justify-between p-1.5 rounded-lg bg-muted/50">
                        <div className="flex items-center gap-2">
                          <Icon className={`h-3.5 w-3.5 ${color}`} />
                          <span className="text-xs font-medium">{label}</span>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <span className="text-[10px] text-muted-foreground">{pct}%</span>
                          <Badge variant="secondary" className="text-[10px] h-5">{count}</Badge>
                        </div>
                      </div>
                    );
                  })}
              </div>
            ) : <EmptyState text="Nenhum fator" />}
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

function LoadingSkeleton() {
  return <div className="space-y-3">{[1, 2, 3].map(i => <Skeleton key={i} className="h-8 w-full" />)}</div>;
}
function EmptyState({ text }: { text: string }) {
  return <div className="text-center py-4 text-muted-foreground"><p className="text-xs">{text}</p></div>;
}
