// NRHS By Owner - Análise por vendedor

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Skeleton } from '@/components/ui/skeleton';
import { AlertTriangle, TrendingUp, TrendingDown, Minus, Info } from 'lucide-react';
import { NRHSOwnerStats } from '@/services/crm/nrhs-analytics';

interface NRHSByOwnerProps {
  ownerStats: NRHSOwnerStats[];
  isLoading: boolean;
  onFilterOwner: (ownerId: string) => void;
}

export function NRHSByOwner({ ownerStats, isLoading, onFilterOwner }: NRHSByOwnerProps) {
  const formatCurrency = (value: number) => {
    if (value >= 1000000) {
      return `R$ ${(value / 1000000).toFixed(1)}M`;
    }
    if (value >= 1000) {
      return `R$ ${(value / 1000).toFixed(0)}K`;
    }
    return `R$ ${value.toFixed(0)}`;
  };

  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map(n => n[0])
      .slice(0, 2)
      .join('')
      .toUpperCase();
  };

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <Skeleton className="h-6 w-64" />
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {[1, 2, 3, 4].map(i => (
              <Skeleton key={i} className="h-14 w-full" />
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  if (ownerStats.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-base font-medium">
            Higiene Comercial por Responsável
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground text-center py-8">
            Nenhum dado disponível
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-4">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base font-medium flex items-center gap-2">
            Higiene Comercial por Responsável
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger>
                  <Info className="h-4 w-4 text-muted-foreground" />
                </TooltipTrigger>
                <TooltipContent className="max-w-xs">
                  <p className="text-sm">
                    NRHS não mede performance comercial, mede disciplina operacional. 
                    Um NRHS baixo indica dados incompletos, não falta de vendas.
                  </p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </CardTitle>
          <Badge variant="outline" className="text-xs">
            Ranking por NRHS
          </Badge>
        </div>
      </CardHeader>
      <CardContent>
        <div className="border rounded-lg overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/50">
                <TableHead className="font-medium w-[50px]">#</TableHead>
                <TableHead className="font-medium">Owner</TableHead>
                <TableHead className="font-medium text-center">Deals</TableHead>
                <TableHead className="font-medium text-center">NRHS Médio</TableHead>
                <TableHead className="font-medium text-center">% Saudáveis</TableHead>
                <TableHead className="font-medium text-center">% Insalubres</TableHead>
                <TableHead className="font-medium text-center">Evolução 7d</TableHead>
                <TableHead className="font-medium text-right">Valor em Risco</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {ownerStats.map((owner, index) => {
                const hasAlert = owner.averageNRHS < 70;
                
                return (
                  <TableRow 
                    key={owner.userId} 
                    className="hover:bg-muted/30 cursor-pointer"
                    onClick={() => onFilterOwner(owner.userId)}
                  >
                    <TableCell className="text-muted-foreground font-medium">
                      {index + 1}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <Avatar className="h-8 w-8">
                          <AvatarImage src={owner.avatarUrl || undefined} />
                          <AvatarFallback className="text-xs">
                            {getInitials(owner.userName)}
                          </AvatarFallback>
                        </Avatar>
                        <span className="font-medium">{owner.userName}</span>
                        {hasAlert && (
                          <TooltipProvider>
                            <Tooltip>
                              <TooltipTrigger>
                                <AlertTriangle className="h-4 w-4 text-orange-500" />
                              </TooltipTrigger>
                              <TooltipContent>
                                <p>NRHS médio abaixo de 70</p>
                              </TooltipContent>
                            </Tooltip>
                          </TooltipProvider>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="text-center">
                      <Badge variant="secondary">{owner.dealCount}</Badge>
                    </TableCell>
                    <TableCell className="text-center">
                      <span 
                        className={`font-bold ${
                          owner.averageNRHS >= 75 
                            ? 'text-emerald-600' 
                            : owner.averageNRHS >= 60 
                              ? 'text-yellow-600' 
                              : 'text-red-600'
                        }`}
                      >
                        {owner.averageNRHS}
                      </span>
                    </TableCell>
                    <TableCell className="text-center">
                      <span className="text-emerald-600">{owner.healthyPercent}%</span>
                    </TableCell>
                    <TableCell className="text-center">
                      <span className={owner.insalubriousPercent > 20 ? 'text-red-600' : 'text-muted-foreground'}>
                        {owner.insalubriousPercent}%
                      </span>
                    </TableCell>
                    <TableCell className="text-center">
                      {owner.evolution7d !== null ? (
                        <div className="flex items-center justify-center gap-1">
                          {owner.evolution7d > 0 ? (
                            <>
                              <TrendingUp className="h-4 w-4 text-emerald-500" />
                              <span className="text-emerald-600 text-sm">+{owner.evolution7d}</span>
                            </>
                          ) : owner.evolution7d < 0 ? (
                            <>
                              <TrendingDown className="h-4 w-4 text-red-500" />
                              <span className="text-red-600 text-sm">{owner.evolution7d}</span>
                            </>
                          ) : (
                            <>
                              <Minus className="h-4 w-4 text-muted-foreground" />
                              <span className="text-muted-foreground text-sm">0</span>
                            </>
                          )}
                        </div>
                      ) : (
                        <span className="text-muted-foreground text-sm">—</span>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      {owner.valueAtRisk > 0 ? (
                        <span className="text-red-600 font-medium">
                          {formatCurrency(owner.valueAtRisk)}
                        </span>
                      ) : (
                        <span className="text-muted-foreground">R$ 0</span>
                      )}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
}
