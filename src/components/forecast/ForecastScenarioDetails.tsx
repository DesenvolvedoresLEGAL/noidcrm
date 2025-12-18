import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { formatCurrencyFull } from '@/lib/i18n';
import { ForecastOpportunity } from '@/hooks/useForecastData';
import { cn } from '@/lib/utils';

interface ForecastScenarioDetailsProps {
  isOpen: boolean;
  onClose: () => void;
  scenarioName: string;
  scenarioLabel: string;
  scenarioColor: string;
  dealIds: string[];
  opportunities: ForecastOpportunity[];
  closedRevenue: number;
}

export function ForecastScenarioDetails({
  isOpen,
  onClose,
  scenarioName,
  scenarioLabel,
  scenarioColor,
  dealIds,
  opportunities,
  closedRevenue,
}: ForecastScenarioDetailsProps) {
  const includedDeals = opportunities.filter(o => dealIds.includes(o.id));
  
  // Calcular totais
  const totalValue = includedDeals.reduce((sum, d) => sum + d.valor_previsto, 0);
  const weightedValue = includedDeals.reduce((sum, d) => sum + (d.valor_previsto * d.prob / 100), 0);

  const getFormulaDescription = () => {
    switch (scenarioName) {
      case 'pessimistic':
        return {
          title: 'Fórmula: Receita Fechada + Deals ≥80% probabilidade',
          description: 'Inclui apenas deals com alta confiança de fechamento. Representa o valor mínimo esperado.',
        };
      case 'realistic':
        return {
          title: 'Fórmula: Receita Fechada + Pipeline Ponderado',
          description: 'Σ (Valor × Probabilidade/100). Cada deal contribui proporcionalmente à sua probabilidade.',
        };
      case 'optimistic':
        return {
          title: 'Fórmula: Receita Fechada + (Pipeline Ponderado × 1.2)',
          description: 'Cenário onde conversões são 20% melhores que o esperado. Inclui deals ≥30% prob.',
        };
      case 'best_case':
        return {
          title: 'Fórmula: Receita Fechada + Todo Pipeline',
          description: 'Se todos os deals do pipeline fecharem. Máximo possível.',
        };
      default:
        return { title: '', description: '' };
    }
  };

  const formula = getFormulaDescription();

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[80vh]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <div className={cn('w-3 h-3 rounded-full', scenarioColor)} />
            Cenário {scenarioLabel}
            <Badge variant="secondary" className="ml-2">
              {dealIds.length} deals
            </Badge>
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Fórmula explicativa */}
          <div className="p-4 bg-muted/50 rounded-lg border">
            <p className="font-medium text-sm">{formula.title}</p>
            <p className="text-xs text-muted-foreground mt-1">{formula.description}</p>
          </div>

          {/* Breakdown do cálculo */}
          <div className="grid grid-cols-3 gap-4">
            <div className="p-3 border rounded-lg text-center">
              <p className="text-xs text-muted-foreground">Receita Fechada</p>
              <p className="font-bold text-lg">{formatCurrencyFull(closedRevenue)}</p>
            </div>
            <div className="p-3 border rounded-lg text-center">
              <p className="text-xs text-muted-foreground">
                {scenarioName === 'realistic' ? 'Pipeline Ponderado' : 
                 scenarioName === 'optimistic' ? 'Ponderado × 1.2' :
                 scenarioName === 'pessimistic' ? 'Deals ≥80%' : 'Todo Pipeline'}
              </p>
              <p className="font-bold text-lg">
                {formatCurrencyFull(
                  scenarioName === 'realistic' ? weightedValue :
                  scenarioName === 'optimistic' ? weightedValue * 1.2 :
                  totalValue
                )}
              </p>
            </div>
            <div className="p-3 border rounded-lg text-center bg-primary/5">
              <p className="text-xs text-muted-foreground">Total Cenário</p>
              <p className={cn('font-bold text-lg', scenarioColor.replace('bg-', 'text-'))}>
                {formatCurrencyFull(
                  closedRevenue + (
                    scenarioName === 'realistic' ? weightedValue :
                    scenarioName === 'optimistic' ? weightedValue * 1.2 :
                    totalValue
                  )
                )}
              </p>
            </div>
          </div>

          {/* Lista de deals */}
          <div>
            <p className="text-sm font-medium mb-2">Deals incluídos neste cenário:</p>
            <ScrollArea className="h-[300px] border rounded-lg">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Deal</TableHead>
                    <TableHead>Conta</TableHead>
                    <TableHead>Etapa</TableHead>
                    <TableHead className="text-right">Valor</TableHead>
                    <TableHead className="text-right">Prob.</TableHead>
                    <TableHead className="text-right">Contribuição</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {includedDeals.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                        Nenhum deal neste cenário
                      </TableCell>
                    </TableRow>
                  ) : (
                    includedDeals.map(deal => (
                      <TableRow key={deal.id}>
                        <TableCell className="font-medium max-w-[200px] truncate">
                          {deal.title}
                        </TableCell>
                        <TableCell className="max-w-[150px] truncate">
                          {deal.account_name}
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className="text-xs">
                            {deal.stage_name}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right tabular-nums">
                          {formatCurrencyFull(deal.valor_previsto)}
                        </TableCell>
                        <TableCell className="text-right">
                          <Badge 
                            variant={deal.prob >= 70 ? 'default' : deal.prob >= 40 ? 'secondary' : 'outline'}
                            className="text-xs"
                          >
                            {deal.prob}%
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right tabular-nums font-medium">
                          {scenarioName === 'realistic' || scenarioName === 'optimistic'
                            ? formatCurrencyFull(deal.valor_previsto * deal.prob / 100)
                            : formatCurrencyFull(deal.valor_previsto)
                          }
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </ScrollArea>
          </div>

          {/* Nota de transparência */}
          <p className="text-[10px] text-muted-foreground text-center">
            💡 Probabilidades vazias usam a probabilidade padrão do estágio. 
            Atualize as probabilidades dos deals para previsões mais precisas.
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
}
