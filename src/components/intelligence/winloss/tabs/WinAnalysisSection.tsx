import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Skeleton } from '@/components/ui/skeleton';
import { Trophy, Award, Quote } from 'lucide-react';
import type { WinLossDataResult } from '@/hooks/useWinLossData';

interface Props {
  data: WinLossDataResult | undefined;
  isLoading: boolean;
}

export function WinAnalysisSection({ data, isLoading }: Props) {
  return (
    <div className="space-y-4">
      <h2 className="text-lg font-semibold flex items-center gap-2">
        <Trophy className="h-5 w-5 text-emerald-500" />
        Análise de Ganhos
      </h2>
      <div className="grid lg:grid-cols-3 gap-4">
        {/* Win Reasons */}
        <Card className="border-emerald-500/20">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-sm">
              <Trophy className="h-4 w-4 text-emerald-500" />
              Top Motivos de Ganho
            </CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? <Skel /> : data?.winReasons && data.winReasons.length > 0 ? (
              <div className="space-y-2.5">
                {data.winReasons.map((item, i) => {
                  const total = data.winReasons.reduce((s, r) => s + r.count, 0);
                  const pct = Math.round((item.count / total) * 100);
                  return (
                    <div key={i} className="space-y-1">
                      <div className="flex items-center justify-between text-sm">
                        <span className="font-medium truncate text-xs">{item.reason}</span>
                        <span className="text-muted-foreground text-xs">{pct}% ({item.count})</span>
                      </div>
                      <Progress value={pct} className="h-1.5 [&>div]:bg-emerald-500" />
                    </div>
                  );
                })}
              </div>
            ) : <Empty />}
          </CardContent>
        </Card>

        {/* Differentiators */}
        <Card className="border-amber-500/20">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-sm">
              <Award className="h-4 w-4 text-amber-500" />
              Diferenciais Decisivos
            </CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? <Skel /> : data?.differentiators && data.differentiators.length > 0 ? (
              <div className="flex flex-wrap gap-1.5">
                {data.differentiators.map((item, i) => (
                  <Badge key={i} variant="outline" className="px-2.5 py-1 text-xs border-amber-500/30 bg-amber-500/5">
                    {item.differentiator}
                    <span className="ml-1 text-[10px] text-muted-foreground">({item.count})</span>
                  </Badge>
                ))}
              </div>
            ) : <Empty />}
          </CardContent>
        </Card>

        {/* Customer Feedback */}
        <Card className="border-blue-500/20">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-sm">
              <Quote className="h-4 w-4 text-blue-500" />
              Feedback dos Clientes
            </CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? <Skel /> : data?.customerFeedbacks && data.customerFeedbacks.length > 0 ? (
              <div className="space-y-2 max-h-[200px] overflow-y-auto">
                {data.customerFeedbacks.map((item, i) => (
                  <div key={i} className="p-2.5 rounded-lg bg-blue-500/5 border border-blue-500/10">
                    <p className="text-xs italic line-clamp-2">"{item.feedback}"</p>
                    <p className="text-[10px] text-muted-foreground mt-1">— {item.acceptorName}</p>
                  </div>
                ))}
              </div>
            ) : <Empty />}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function Skel() { return <div className="space-y-3">{[1, 2, 3].map(i => <Skeleton key={i} className="h-8 w-full" />)}</div>; }
function Empty() { return <div className="text-center py-4 text-muted-foreground"><p className="text-xs">Nenhum dado registrado</p></div>; }
