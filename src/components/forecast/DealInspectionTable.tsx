import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { ForecastOpportunity } from '@/hooks/useForecastData';
import { Search, AlertTriangle, CheckCircle, Clock, XCircle, Shield, Ban } from 'lucide-react';
import { cn } from '@/lib/utils';
import { parseDateOnly, formatDateShortBR } from '@/lib/dateUtils';
import { formatCurrencyFull } from '@/lib/i18n';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

interface DealInspectionTableProps {
  opportunities: ForecastOpportunity[];
  filterCategory?: 'commit' | 'best_case' | 'pipeline' | 'all';
}

const riskColors = {
  low: 'bg-green-500/10 text-green-500 border-green-500/20',
  medium: 'bg-yellow-500/10 text-yellow-500 border-yellow-500/20',
  high: 'bg-orange-500/10 text-orange-500 border-orange-500/20',
  critical: 'bg-red-500/10 text-red-500 border-red-500/20',
};

const riskLabels = { low: 'Baixo', medium: 'Médio', high: 'Alto', critical: 'Crítico' };
const riskIcons = { low: CheckCircle, medium: Clock, high: AlertTriangle, critical: XCircle };

const categoryColors = {
  commit: 'bg-green-500/10 text-green-500 border-green-500/20',
  best_case: 'bg-blue-500/10 text-blue-500 border-blue-500/20',
  pipeline: 'bg-muted text-muted-foreground border-border',
  closed: 'bg-primary/10 text-primary border-primary/20',
};
const categoryLabels = { commit: 'Commit', best_case: 'Best Case', pipeline: 'Pipeline', closed: 'Fechado' };

const eligibilityColors = {
  full: 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20',
  partial: 'bg-amber-500/10 text-amber-500 border-amber-500/20',
  low_confidence: 'bg-orange-500/10 text-orange-500 border-orange-500/20',
  excluded: 'bg-red-500/10 text-red-500 border-red-500/20',
};
const eligibilityLabels = { full: 'Total', partial: 'Parcial', low_confidence: 'Baixa', excluded: 'Excluído' };

function getNRHSTierColor(score: number | null): string {
  if (score === null) return 'bg-muted text-muted-foreground';
  if (score >= 75) return 'bg-emerald-500/10 text-emerald-500';
  if (score >= 60) return 'bg-amber-500/10 text-amber-500';
  if (score >= 40) return 'bg-orange-500/10 text-orange-500';
  return 'bg-red-500/10 text-red-500';
}

export function DealInspectionTable({ opportunities, filterCategory = 'all' }: DealInspectionTableProps) {
  const filtered = filterCategory === 'all' ? opportunities : opportunities.filter(o => o.category === filterCategory);
  const sorted = [...filtered].sort((a, b) => b.valor_previsto - a.valor_previsto);

  if (sorted.length === 0) {
    return (
      <Card className="border-border">
        <CardHeader><CardTitle className="text-base font-semibold flex items-center gap-2"><Search className="h-4 w-4 text-muted-foreground" />Deal Inspection</CardTitle></CardHeader>
        <CardContent><p className="text-sm text-muted-foreground text-center py-8">Nenhuma oportunidade encontrada</p></CardContent>
      </Card>
    );
  }

  return (
    <TooltipProvider>
      <Card className="border-border">
        <CardHeader className="pb-3">
          <CardTitle className="text-base font-semibold flex items-center gap-2">
            <Search className="h-4 w-4 text-muted-foreground" />
            Deal Inspection
            <Badge variant="secondary" className="ml-2">{sorted.length} oportunidades</Badge>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="min-w-[180px]">Deal</TableHead>
                  <TableHead className="text-right">Valor</TableHead>
                  <TableHead className="text-center">Prob</TableHead>
                  <TableHead className="text-center">NRHS</TableHead>
                  <TableHead>Elegibilidade</TableHead>
                  <TableHead className="text-right">Valor Ajustado</TableHead>
                  <TableHead>Estágio</TableHead>
                  <TableHead>Vendedor</TableHead>
                  <TableHead>Close Date</TableHead>
                  <TableHead>Risco</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sorted.map((opp) => {
                  const RiskIcon = riskIcons[opp.risk_level];
                  const isExcluded = opp.forecast_eligibility === 'excluded';
                  return (
                    <TableRow key={opp.id} className={cn('group', isExcluded && 'opacity-50 bg-muted/20')}>
                      <TableCell>
                        <div className="space-y-1">
                          <p className="font-medium text-sm line-clamp-1">{opp.title}</p>
                          <p className="text-xs text-muted-foreground line-clamp-1">{opp.account_name}</p>
                        </div>
                      </TableCell>
                      <TableCell className="text-right font-semibold">{formatCurrencyFull(opp.valor_previsto)}</TableCell>
                      <TableCell className="text-center">
                        <span className={cn('font-medium', opp.prob >= 70 ? 'text-green-500' : opp.prob >= 50 ? 'text-yellow-500' : 'text-muted-foreground')}>{opp.prob}%</span>
                      </TableCell>
                      <TableCell className="text-center">
                        <Badge variant="outline" className={cn('text-xs', getNRHSTierColor(opp.nrhs_score))}>
                          <Shield className="h-3 w-3 mr-1" />
                          {opp.nrhs_score !== null ? `${opp.nrhs_score}` : 'N/A'}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Tooltip>
                          <TooltipTrigger>
                            <Badge variant="outline" className={cn('text-xs gap-1', eligibilityColors[opp.forecast_eligibility])}>
                              {isExcluded && <Ban className="h-3 w-3" />}
                              {eligibilityLabels[opp.forecast_eligibility]}
                            </Badge>
                          </TooltipTrigger>
                          <TooltipContent className="max-w-xs">
                            {isExcluded 
                              ? 'Excluído do forecast por NRHS < 40'
                              : `Este deal contribui com ${formatCurrencyFull(opp.forecast_adjusted_value)} ao forecast após ajuste por higiene operacional`
                            }
                          </TooltipContent>
                        </Tooltip>
                      </TableCell>
                      <TableCell className="text-right">
                        <span className={cn('font-medium', isExcluded ? 'text-muted-foreground line-through' : 'text-foreground')}>
                          {formatCurrencyFull(opp.forecast_adjusted_value)}
                        </span>
                      </TableCell>
                      <TableCell><Badge variant="outline" className="text-xs">{opp.stage_name}</Badge></TableCell>
                      <TableCell className="text-sm">{opp.owner_name}</TableCell>
                      <TableCell className="text-sm">
                        {opp.close_date_prevista ? (
                          <span className={cn(parseDateOnly(opp.close_date_prevista) < new Date() && 'text-red-500 font-medium')}>{formatDateShortBR(opp.close_date_prevista)}</span>
                        ) : <span className="text-muted-foreground">-</span>}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className={cn('text-xs gap-1', riskColors[opp.risk_level])}>
                          <RiskIcon className="h-3 w-3" />{riskLabels[opp.risk_level]}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </TooltipProvider>
  );
}
