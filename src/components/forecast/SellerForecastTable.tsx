import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Progress } from '@/components/ui/progress';
import { SellerForecast } from '@/hooks/useForecastData';
import { Users, TrendingUp, TrendingDown } from 'lucide-react';
import { cn } from '@/lib/utils';
import { formatCurrencyFull } from '@/lib/i18n';

interface SellerForecastTableProps {
  sellers: SellerForecast[];
}


function getInitials(name: string): string {
  return name
    .split(' ')
    .map(n => n[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();
}

export function SellerForecastTable({ sellers }: SellerForecastTableProps) {
  if (sellers.length === 0) {
    return (
      <Card className="border-border">
        <CardHeader>
          <CardTitle className="text-base font-semibold flex items-center gap-2">
            <Users className="h-4 w-4 text-muted-foreground" />
            Forecast por Vendedor
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground text-center py-8">
            Nenhum vendedor com atividade no período
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-border">
      <CardHeader className="pb-3">
        <CardTitle className="text-base font-semibold flex items-center gap-2">
          <Users className="h-4 w-4 text-muted-foreground" />
          Forecast por Vendedor
        </CardTitle>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Vendedor</TableHead>
              <TableHead className="text-right">Meta</TableHead>
              <TableHead className="text-right">Fechado</TableHead>
              <TableHead className="w-[120px]">% Meta</TableHead>
              <TableHead className="text-right">Commit</TableHead>
              <TableHead className="text-right">Best Case</TableHead>
              <TableHead className="text-right">Gap</TableHead>
              <TableHead className="text-right">Deals</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {sellers.map((seller) => (
              <TableRow key={seller.userId}>
                <TableCell>
                  <div className="flex items-center gap-2">
                    <Avatar className="h-8 w-8">
                      <AvatarImage src={seller.avatar || undefined} />
                      <AvatarFallback className="text-xs">
                        {getInitials(seller.name)}
                      </AvatarFallback>
                    </Avatar>
                    <span className="font-medium text-sm">{seller.name}</span>
                  </div>
                </TableCell>
                <TableCell className="text-right text-sm text-muted-foreground">
                  {seller.goal > 0 ? formatCurrencyFull(seller.goal) : '-'}
                </TableCell>
                <TableCell className="text-right font-semibold text-sm">
                  {formatCurrencyFull(seller.closed)}
                </TableCell>
                <TableCell>
                  <div className="flex items-center gap-2">
                    <Progress 
                      value={Math.min(seller.closedPercentage, 100)} 
                      className="h-2 flex-1"
                    />
                    <span className={cn(
                      'text-xs font-medium w-10 text-right',
                      seller.closedPercentage >= 100 ? 'text-green-500' :
                      seller.closedPercentage >= 70 ? 'text-yellow-500' : 'text-red-500'
                    )}>
                      {seller.closedPercentage.toFixed(0)}%
                    </span>
                  </div>
                </TableCell>
                <TableCell className="text-right text-sm">
                  {formatCurrencyFull(seller.commit)}
                </TableCell>
                <TableCell className="text-right text-sm">
                  {formatCurrencyFull(seller.bestCase)}
                </TableCell>
                <TableCell className="text-right">
                  <span className={cn(
                    'text-sm font-medium flex items-center justify-end gap-1',
                    seller.gap <= 0 ? 'text-green-500' : 'text-red-500'
                  )}>
                    {seller.gap <= 0 ? (
                      <TrendingUp className="h-3 w-3" />
                    ) : (
                      <TrendingDown className="h-3 w-3" />
                    )}
                    {formatCurrencyFull(Math.abs(seller.gap))}
                  </span>
                </TableCell>
                <TableCell className="text-right text-sm text-muted-foreground">
                  {seller.dealCount}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
