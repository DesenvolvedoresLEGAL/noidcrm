import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Skeleton } from '@/components/ui/skeleton';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Users, Trophy } from 'lucide-react';
import type { WinLossDataResult } from '@/hooks/useWinLossData';

interface Props {
  data: WinLossDataResult | undefined;
  isLoading: boolean;
}

const formatCurrency = (value: number) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(value);

export function WinLossSellerTab({ data, isLoading }: Props) {
  const sellers = data?.sellerStats || [];

  if (isLoading) {
    return <div className="space-y-4">{[1, 2, 3].map(i => <Skeleton key={i} className="h-20 w-full" />)}</div>;
  }

  if (sellers.length === 0) {
    return (
      <Card className="border-dashed">
        <CardContent className="py-12 text-center">
          <Users className="h-12 w-12 mx-auto mb-4 text-muted-foreground opacity-30" />
          <h3 className="text-lg font-medium mb-2">Sem dados de vendedores</h3>
          <p className="text-sm text-muted-foreground">Atribua vendedores aos deals para gerar este ranking.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Trophy className="h-5 w-5 text-amber-500" />
          Performance Matrix por Vendedor
        </CardTitle>
        <CardDescription>Ranking de win rate, volume e ciclo médio — ideal para coaching</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-2">
          {/* Header */}
          <div className="grid grid-cols-12 gap-2 text-xs text-muted-foreground font-medium px-2 pb-1 border-b">
            <span className="col-span-3">Vendedor</span>
            <span className="col-span-1 text-center">Won</span>
            <span className="col-span-1 text-center">Lost</span>
            <span className="col-span-3 text-center">Win Rate</span>
            <span className="col-span-2 text-center">Ticket Médio</span>
            <span className="col-span-2 text-center">Ciclo (dias)</span>
          </div>

          {sellers.map((seller, idx) => {
            const getWinRateColor = (rate: number) => {
              if (rate >= 50) return 'text-emerald-500';
              if (rate >= 25) return 'text-yellow-500';
              return 'text-red-500';
            };
            const getProgressColor = (rate: number) => {
              if (rate >= 50) return '[&>div]:bg-emerald-500';
              if (rate >= 25) return '[&>div]:bg-yellow-500';
              return '[&>div]:bg-red-500';
            };

            return (
              <div key={seller.userId} className="grid grid-cols-12 gap-2 items-center p-2 rounded-lg hover:bg-muted/50 transition-colors">
                <div className="col-span-3 flex items-center gap-2 min-w-0">
                  <div className="flex items-center justify-center w-5 h-5 rounded-full bg-muted text-[10px] font-bold text-muted-foreground shrink-0">
                    {idx + 1}
                  </div>
                  <Avatar className="h-6 w-6 shrink-0">
                    <AvatarImage src={seller.avatarUrl} />
                    <AvatarFallback className="text-[10px]">{seller.name.charAt(0)}</AvatarFallback>
                  </Avatar>
                  <span className="text-sm font-medium truncate">{seller.name}</span>
                </div>
                <div className="col-span-1 text-center">
                  <Badge variant="secondary" className="bg-emerald-500/10 text-emerald-600 text-xs">{seller.won}</Badge>
                </div>
                <div className="col-span-1 text-center">
                  <Badge variant="secondary" className="bg-red-500/10 text-red-600 text-xs">{seller.lost}</Badge>
                </div>
                <div className="col-span-3">
                  <div className="flex items-center gap-2">
                    <Progress value={seller.winRate} className={`h-2 flex-1 ${getProgressColor(seller.winRate)}`} />
                    <span className={`text-xs font-bold w-10 text-right ${getWinRateColor(seller.winRate)}`}>
                      {seller.winRate}%
                    </span>
                  </div>
                </div>
                <div className="col-span-2 text-center text-xs font-medium">
                  {formatCurrency(seller.avgTicket)}
                </div>
                <div className="col-span-2 text-center text-xs text-muted-foreground">
                  {seller.avgCycle > 0 ? `${seller.avgCycle}d` : '—'}
                </div>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
