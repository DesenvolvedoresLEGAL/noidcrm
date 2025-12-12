import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { OTEMonthlyResult } from '@/hooks/useOTEData';
import { 
  DollarSign, 
  Target, 
  TrendingUp, 
  Users, 
  Flag, 
  Zap,
  AlertTriangle,
  Users2
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

interface OTEOverviewTabProps {
  results: OTEMonthlyResult[];
  isLoading: boolean;
  period: string;
}

export function OTEOverviewTab({ results, isLoading, period }: OTEOverviewTabProps) {
  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    }).format(value);
  };

  // Calculate KPIs
  const totalToPay = results.reduce((sum, r) => sum + r.final_variable_amount, 0);
  const totalSales = results.reduce((sum, r) => sum + r.total_sales, 0);
  const totalGoal = results.reduce((sum, r) => sum + r.goal_amount, 0);
  const avgAchievement = results.length > 0 
    ? results.reduce((sum, r) => sum + r.achievement_percentage, 0) / results.length 
    : 0;

  const blueFlags = results.filter(r => r.flag_color === 'blue').length;
  const yellowFlags = results.filter(r => r.flag_color === 'yellow').length;
  const redFlags = results.filter(r => r.flag_color === 'red').length;

  const avgAccelerator = results.length > 0
    ? results.reduce((sum, r) => sum + r.total_accelerator_percentage, 0) / results.length
    : 0;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full" />
      </div>
    );
  }

  if (results.length === 0) {
    return (
      <Card>
        <CardContent className="py-12 text-center">
          <AlertTriangle className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
          <h3 className="text-lg font-semibold">Nenhum resultado encontrado</h3>
          <p className="text-muted-foreground mt-2">
            Clique em "Calcular" para gerar o relatório OTE do período selecionado.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Total a Pagar</p>
                <p className="text-2xl font-bold text-primary">{formatCurrency(totalToPay)}</p>
              </div>
              <DollarSign className="h-8 w-8 text-primary/20" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Vendas Totais</p>
                <p className="text-2xl font-bold">{formatCurrency(totalSales)}</p>
                <p className="text-xs text-muted-foreground">Meta: {formatCurrency(totalGoal)}</p>
              </div>
              <TrendingUp className="h-8 w-8 text-muted-foreground/20" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Média % Meta</p>
                <p className="text-2xl font-bold">{avgAchievement.toFixed(1)}%</p>
              </div>
              <Target className="h-8 w-8 text-muted-foreground/20" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Vendedores</p>
                <p className="text-2xl font-bold">{results.length}</p>
              </div>
              <Users className="h-8 w-8 text-muted-foreground/20" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Flag Summary */}
      <div className="grid grid-cols-3 gap-4">
        <Card className="border-l-4 border-l-blue-500">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Blue Flag</p>
                <p className="text-3xl font-bold text-blue-500">{blueFlags}</p>
                <p className="text-xs text-muted-foreground">≥ 100% da meta</p>
              </div>
              <Flag className="h-10 w-10 text-blue-500/30" />
            </div>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-yellow-500">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Yellow Flag</p>
                <p className="text-3xl font-bold text-yellow-500">{yellowFlags}</p>
                <p className="text-xs text-muted-foreground">70% - 99% da meta</p>
              </div>
              <Flag className="h-10 w-10 text-yellow-500/30" />
            </div>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-red-500">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Red Flag</p>
                <p className="text-3xl font-bold text-red-500">{redFlags}</p>
                <p className="text-xs text-muted-foreground">&lt; 70% da meta</p>
              </div>
              <Flag className="h-10 w-10 text-red-500/30" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Results Table */}
      <Card>
        <CardHeader>
          <CardTitle>Resultados do Período</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b">
                  <th className="text-left py-3 px-2">Vendedor</th>
                  <th className="text-left py-3 px-2">Nível</th>
                  <th className="text-right py-3 px-2">Meta</th>
                  <th className="text-right py-3 px-2">Vendas</th>
                  <th className="text-right py-3 px-2">% Meta</th>
                  <th className="text-center py-3 px-2">Mult.</th>
                  <th className="text-right py-3 px-2">Base</th>
                  <th className="text-center py-3 px-2">Flag</th>
                  <th className="text-right py-3 px-2">Acelerador</th>
                  <th className="text-right py-3 px-2 font-semibold">Variável Final</th>
                </tr>
              </thead>
              <tbody>
                {results.map((result) => (
                  <tr key={result.id} className="border-b hover:bg-muted/50">
                    <td className="py-3 px-2 font-medium">
                      <div className="flex items-center gap-2">
                        {result.profile?.full_name || result.level_name_snapshot || result.user_id.slice(0, 8) + '...'}
                        {result.is_team_target && (
                          <TooltipProvider>
                            <Tooltip>
                              <TooltipTrigger>
                                <span className="inline-flex items-center justify-center px-1.5 py-0.5 text-xs bg-primary/10 text-primary rounded-full">
                                  <Users2 className="h-3 w-3 mr-1" />
                                  {result.team_member_count || '?'}
                                </span>
                              </TooltipTrigger>
                              <TooltipContent>
                                <p>Meta de time: {result.team_member_count || '?'} vendedores</p>
                              </TooltipContent>
                            </Tooltip>
                          </TooltipProvider>
                        )}
                      </div>
                    </td>
                    <td className="py-3 px-2">{result.level_name_snapshot || '-'}</td>
                    <td className="py-3 px-2 text-right">{formatCurrency(result.goal_amount)}</td>
                    <td className="py-3 px-2 text-right">{formatCurrency(result.total_sales)}</td>
                    <td className="py-3 px-2 text-right">{result.achievement_percentage.toFixed(1)}%</td>
                    <td className="py-3 px-2 text-center">{result.ote_multiplier}x</td>
                    <td className="py-3 px-2 text-right">{formatCurrency(result.base_variable)}</td>
                    <td className="py-3 px-2 text-center">
                      <span className={cn(
                        "inline-flex items-center justify-center w-6 h-6 rounded-full",
                        result.flag_color === 'blue' && "bg-blue-500",
                        result.flag_color === 'yellow' && "bg-yellow-500",
                        result.flag_color === 'red' && "bg-red-500"
                      )}>
                        <Flag className="h-3 w-3 text-white" />
                      </span>
                    </td>
                    <td className="py-3 px-2 text-right">
                      <span className={cn(
                        result.final_adjustment_percentage > 0 && "text-green-600",
                        result.final_adjustment_percentage < 0 && "text-red-600"
                      )}>
                        {result.final_adjustment_percentage > 0 ? '+' : ''}
                        {result.final_adjustment_percentage.toFixed(1)}%
                      </span>
                    </td>
                    <td className="py-3 px-2 text-right font-semibold text-primary">
                      {formatCurrency(result.final_variable_amount)}
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="bg-muted/30 font-semibold">
                  <td colSpan={3} className="py-3 px-2">TOTAL</td>
                  <td className="py-3 px-2 text-right">{formatCurrency(totalSales)}</td>
                  <td colSpan={5} className="py-3 px-2"></td>
                  <td className="py-3 px-2 text-right text-primary">{formatCurrency(totalToPay)}</td>
                </tr>
              </tfoot>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
