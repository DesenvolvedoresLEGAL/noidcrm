import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Skeleton } from '@/components/ui/skeleton';
import { Swords } from 'lucide-react';
import type { WinLossDataResult } from '@/hooks/useWinLossData';

interface Props {
  data: WinLossDataResult | undefined;
  isLoading: boolean;
  organizationId: string;
  pipelineContext: 'qualification' | 'sales' | 'onboarding';
}

const formatCurrency = (value: number) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(value);

export function WinLossCompetitiveTab({ data, isLoading, organizationId, pipelineContext }: Props) {
  const stats = data?.competitorStats || [];

  if (isLoading) {
    return <div className="space-y-4">{[1, 2, 3].map(i => <Skeleton key={i} className="h-24 w-full" />)}</div>;
  }

  if (stats.length === 0) {
    return (
      <Card className="border-dashed">
        <CardContent className="py-12 text-center">
          <Swords className="h-12 w-12 mx-auto mb-4 text-muted-foreground opacity-30" />
          <h3 className="text-lg font-medium mb-2">Sem dados competitivos</h3>
          <p className="text-sm text-muted-foreground">Registre concorrentes ao marcar deals como perdidos para gerar este relatório.</p>
        </CardContent>
      </Card>
    );
  }

  const totalLosses = stats.reduce((s, c) => s + c.lossCount, 0);

  return (
    <div className="space-y-4">
      {/* Battlecard Index */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Swords className="h-5 w-5 text-orange-500" />
            Competitive Battlecard Index
          </CardTitle>
          <CardDescription>Win rate e volume de perdas por concorrente</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {/* Header */}
            <div className="grid grid-cols-12 gap-2 text-xs text-muted-foreground font-medium px-2">
              <span className="col-span-3">Concorrente</span>
              <span className="col-span-2 text-center">Perdidos</span>
              <span className="col-span-2 text-center">Valor Perdido</span>
              <span className="col-span-2 text-center">Wins contra</span>
              <span className="col-span-3 text-center">Win Rate</span>
            </div>

            {stats.map((comp) => {
              const lossPct = totalLosses > 0 ? Math.round((comp.lossCount / totalLosses) * 100) : 0;
              return (
                <div key={comp.competitor} className="grid grid-cols-12 gap-2 items-center p-2.5 rounded-lg border hover:bg-muted/50 transition-colors">
                  <div className="col-span-3">
                    <p className="font-medium text-sm truncate">{comp.competitor}</p>
                    <p className="text-[10px] text-muted-foreground">{lossPct}% das perdas</p>
                  </div>
                  <div className="col-span-2 text-center">
                    <Badge variant="secondary" className="bg-red-500/10 text-red-600">{comp.lossCount}</Badge>
                  </div>
                  <div className="col-span-2 text-center text-sm text-red-500 font-medium">
                    {formatCurrency(comp.lostValue)}
                  </div>
                  <div className="col-span-2 text-center">
                    <Badge variant="secondary" className="bg-emerald-500/10 text-emerald-600">{comp.winCount}</Badge>
                  </div>
                  <div className="col-span-3">
                    <div className="flex items-center gap-2">
                      <Progress
                        value={comp.winRate}
                        className={`h-2 flex-1 ${comp.winRate >= 50 ? '[&>div]:bg-emerald-500' : comp.winRate >= 25 ? '[&>div]:bg-yellow-500' : '[&>div]:bg-red-500'}`}
                      />
                      <span className={`text-xs font-bold w-10 text-right ${comp.winRate >= 50 ? 'text-emerald-500' : comp.winRate >= 25 ? 'text-yellow-500' : 'text-red-500'}`}>
                        {comp.winRate}%
                      </span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Seller vs Client Chart */}
      <div>
        {organizationId && (
          <SellerVsClientWrapper organizationId={organizationId} pipelineContext={pipelineContext} />
        )}
      </div>
    </div>
  );
}

// Lazy wrapper to avoid circular import
import { SellerVsClientReasonsChart } from '@/components/intelligence/SellerVsClientReasonsChart';
function SellerVsClientWrapper({ organizationId, pipelineContext }: { organizationId: string; pipelineContext: string }) {
  return <SellerVsClientReasonsChart organizationId={organizationId} pipelineContext={pipelineContext as any} />;
}
