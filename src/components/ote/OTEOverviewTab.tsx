import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { OTEMonthlyResult } from '@/hooks/useOTEData';
import { useSalesConfig } from '@/hooks/useSalesConfig';
import type { OTESalesRecord } from '@/hooks/useOTESalesRecords';
import { aggregateEligible } from './oteEligibility';
import { 
  DollarSign, 
  Target, 
  TrendingUp, 
  Users, 
  Flag, 
  Zap,
  AlertTriangle,
  Users2,
  UserCheck,
  Wallet
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface OTEOverviewTabProps {
  results: OTEMonthlyResult[];
  records?: OTESalesRecord[];
  isLoading: boolean;
  period: string;
  isOTEMode?: boolean;
}

export function OTEOverviewTab({ results, records = [], isLoading, period, isOTEMode = true }: OTEOverviewTabProps) {
  const { config } = useSalesConfig();
  
  const flagBlueThreshold = config?.flag_blue_threshold ?? 100;
  const flagYellowMinThreshold = config?.flag_yellow_min_threshold ?? 70;
  const flagYellowMaxThreshold = config?.flag_yellow_max_threshold ?? 99.99;

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    }).format(value);
  };

  // Separate by type
  const teamResults = results.filter(r => r.is_team_target);
  const individualResults = results.filter(r => !r.is_team_target);
  
  // Further split individuals by goal_type
  const revenueResults = individualResults.filter(r => (r.goal_type || 'revenue') === 'revenue');
  const leadsResults = individualResults.filter(r => r.goal_type === 'leads');

  // KPIs
  const totalToPay = results.reduce((sum, r) => sum + r.final_variable_amount, 0);
  const totalRevenueGoal = revenueResults.reduce((sum, r) => sum + r.goal_amount, 0);
  const avgRevenueAchievement = revenueResults.length > 0 
    ? revenueResults.reduce((sum, r) => sum + r.achievement_percentage, 0) / revenueResults.length 
    : 0;

  // Reconciliação Vendas Realizadas ⇄ OTE.
  // - Receita válida comercial = soma dos sale_value (commercial_won_revenue_view),
  //   restrita aos vendedores de revenue (closers individuais).
  // - Receita elegível OTE = soma após excluir itens/produtos não elegíveis.
  const revenueResultIds = new Set(revenueResults.map((r) => r.id));
  const revenueRecords = records.filter((r) => revenueResultIds.has(r.ote_result_id));
  const { ssotTotal: validCommercialRevenue, eligibleTotal: eligibleOTERevenue, nonEligibleTotal: itemsOutOfGoal } =
    aggregateEligible(revenueRecords);

  const blueFlags = results.filter(r => r.flag_color === 'blue').length;
  const yellowFlags = results.filter(r => r.flag_color === 'yellow').length;
  const redFlags = results.filter(r => r.flag_color === 'red').length;

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

  const renderFlagBadge = (flagColor?: string) => (
    <span className={cn(
      "inline-flex items-center justify-center w-6 h-6 rounded-full",
      flagColor === 'blue' && "bg-blue-500",
      flagColor === 'yellow' && "bg-yellow-500",
      flagColor === 'red' && "bg-red-500"
    )}>
      <Flag className="h-3 w-3 text-white" />
    </span>
  );

  const renderAdjustment = (value: number) => (
    <span className={cn(
      value > 0 && "text-green-600",
      value < 0 && "text-red-600"
    )}>
      {value > 0 ? '+' : ''}{value.toFixed(1)}%
    </span>
  );

  return (
    <div className="space-y-6">
      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Total a Pagar</p>
                <p className="text-2xl font-bold text-primary">{formatCurrency(totalToPay)}</p>
              </div>
              <Wallet className="h-8 w-8 text-primary/20" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Receita válida comercial</p>
                <p className="text-2xl font-bold">{formatCurrency(validCommercialRevenue)}</p>
                <p className="text-xs text-muted-foreground">
                  Fonte: Vendas Realizadas (exclui canceladas/perdidas)
                </p>
              </div>
              <DollarSign className="h-8 w-8 text-muted-foreground/20" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Receita elegível OTE</p>
                <p className="text-2xl font-bold">{formatCurrency(eligibleOTERevenue)}</p>
                <p className="text-xs text-muted-foreground">
                  {itemsOutOfGoal > 0.01
                    ? `Itens fora da meta: ${formatCurrency(itemsOutOfGoal)}`
                    : `Meta total: ${formatCurrency(totalRevenueGoal)}`}
                </p>
              </div>
              <TrendingUp className="h-8 w-8 text-muted-foreground/20" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Média % Meta (Closers)</p>
                <p className="text-2xl font-bold">{avgRevenueAchievement.toFixed(1)}%</p>
              </div>
              <Target className="h-8 w-8 text-muted-foreground/20" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Equipe</p>
                <div className="flex items-baseline gap-2">
                  <p className="text-2xl font-bold">{individualResults.length}</p>
                  <span className="text-sm text-muted-foreground">vendedores</span>
                </div>
                {teamResults.length > 0 && (
                  <p className="text-xs text-muted-foreground">{teamResults.length} gestor(es)</p>
                )}
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
                <p className="text-xs text-muted-foreground">≥ {flagBlueThreshold}% da meta</p>
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
                <p className="text-xs text-muted-foreground">{flagYellowMinThreshold}% - {flagYellowMaxThreshold}% da meta</p>
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
                <p className="text-xs text-muted-foreground">&lt; {flagYellowMinThreshold}% da meta</p>
              </div>
              <Flag className="h-10 w-10 text-red-500/30" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Closers / Revenue Table */}
      {revenueResults.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <DollarSign className="h-5 w-5" />
              Closers (Meta em R$)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b">
                    <th className="text-left py-3 px-2">Vendedor</th>
                    <th className="text-left py-3 px-2">Nível</th>
                    <th className="text-right py-3 px-2">Meta (R$)</th>
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
                  {revenueResults.map((result) => (
                    <tr key={result.id} className="border-b hover:bg-muted/50">
                      <td className="py-3 px-2 font-medium">
                        {result.profile?.full_name || result.level_name_snapshot || result.user_id.slice(0, 8) + '...'}
                      </td>
                      <td className="py-3 px-2">{result.level_name_snapshot || '-'}</td>
                      <td className="py-3 px-2 text-right">{formatCurrency(result.goal_amount)}</td>
                      <td className="py-3 px-2 text-right">{formatCurrency(result.total_sales)}</td>
                      <td className="py-3 px-2 text-right">{result.achievement_percentage.toFixed(1)}%</td>
                      <td className="py-3 px-2 text-center">{result.ote_multiplier}x</td>
                      <td className="py-3 px-2 text-right">{formatCurrency(result.base_variable)}</td>
                      <td className="py-3 px-2 text-center">{renderFlagBadge(result.flag_color)}</td>
                      <td className="py-3 px-2 text-right">{renderAdjustment(result.final_adjustment_percentage)}</td>
                      <td className="py-3 px-2 text-right font-semibold text-primary">
                        {formatCurrency(result.final_variable_amount)}
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="bg-muted/30 font-semibold">
                    <td colSpan={3} className="py-3 px-2">SUBTOTAL CLOSERS</td>
                    <td className="py-3 px-2 text-right">{formatCurrency(revenueResults.reduce((sum, r) => sum + r.total_sales, 0))}</td>
                    <td colSpan={5} className="py-3 px-2"></td>
                    <td className="py-3 px-2 text-right text-primary">
                      {formatCurrency(revenueResults.reduce((sum, r) => sum + r.final_variable_amount, 0))}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Pré-vendas / Leads Table */}
      {leadsResults.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <UserCheck className="h-5 w-5" />
              Pré-vendas (Meta em Leads Qualificados)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b">
                    <th className="text-left py-3 px-2">Vendedor</th>
                    <th className="text-left py-3 px-2">Nível</th>
                    <th className="text-right py-3 px-2">Meta (leads)</th>
                    <th className="text-right py-3 px-2">Leads Qualificados</th>
                    <th className="text-right py-3 px-2">% Meta</th>
                    <th className="text-center py-3 px-2">Mult.</th>
                    <th className="text-right py-3 px-2">Base</th>
                    <th className="text-center py-3 px-2">Flag</th>
                    <th className="text-right py-3 px-2">Acelerador</th>
                    <th className="text-right py-3 px-2 font-semibold">Variável Final</th>
                  </tr>
                </thead>
                <tbody>
                  {leadsResults.map((result) => (
                    <tr key={result.id} className="border-b hover:bg-muted/50">
                      <td className="py-3 px-2 font-medium">
                        {result.profile?.full_name || result.level_name_snapshot || result.user_id.slice(0, 8) + '...'}
                      </td>
                      <td className="py-3 px-2">{result.level_name_snapshot || '-'}</td>
                      <td className="py-3 px-2 text-right">{result.goal_amount}</td>
                      <td className="py-3 px-2 text-right">{result.total_sales}</td>
                      <td className="py-3 px-2 text-right">{result.achievement_percentage.toFixed(1)}%</td>
                      <td className="py-3 px-2 text-center">{result.ote_multiplier}x</td>
                      <td className="py-3 px-2 text-right">{formatCurrency(result.base_variable)}</td>
                      <td className="py-3 px-2 text-center">{renderFlagBadge(result.flag_color)}</td>
                      <td className="py-3 px-2 text-right">{renderAdjustment(result.final_adjustment_percentage)}</td>
                      <td className="py-3 px-2 text-right font-semibold text-primary">
                        {formatCurrency(result.final_variable_amount)}
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="bg-muted/30 font-semibold">
                    <td colSpan={3} className="py-3 px-2">SUBTOTAL PRÉ-VENDAS</td>
                    <td className="py-3 px-2 text-right">{leadsResults.reduce((sum, r) => sum + r.total_sales, 0)} leads</td>
                    <td colSpan={5} className="py-3 px-2"></td>
                    <td className="py-3 px-2 text-right text-primary">
                      {formatCurrency(leadsResults.reduce((sum, r) => sum + r.final_variable_amount, 0))}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Team Managers Table */}
      {teamResults.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users2 className="h-5 w-5" />
              Gestores de Time
              <span className="text-xs font-normal text-muted-foreground ml-2">
                (meta configurada em Metas)
              </span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b">
                    <th className="text-left py-3 px-2">Gestor</th>
                    <th className="text-left py-3 px-2">Nível</th>
                    <th className="text-center py-3 px-2">Time</th>
                    <th className="text-right py-3 px-2">Meta Time</th>
                    <th className="text-right py-3 px-2">Vendas Time</th>
                    <th className="text-right py-3 px-2">% Meta</th>
                    <th className="text-center py-3 px-2">Mult.</th>
                    <th className="text-center py-3 px-2">Flag</th>
                    <th className="text-right py-3 px-2">Acelerador</th>
                    <th className="text-right py-3 px-2 font-semibold">Variável Final</th>
                  </tr>
                </thead>
                <tbody>
                  {teamResults.map((result) => (
                    <tr key={result.id} className="border-b hover:bg-muted/50">
                      <td className="py-3 px-2 font-medium">
                        {result.profile?.full_name || result.level_name_snapshot || result.user_id.slice(0, 8) + '...'}
                      </td>
                      <td className="py-3 px-2">{result.level_name_snapshot || '-'}</td>
                      <td className="py-3 px-2 text-center">
                        <span className="inline-flex items-center justify-center px-2 py-0.5 text-xs bg-primary/10 text-primary rounded-full">
                          <Users2 className="h-3 w-3 mr-1" />
                          {result.team_member_count || '?'}
                        </span>
                      </td>
                      <td className="py-3 px-2 text-right">{formatCurrency(result.goal_amount)}</td>
                      <td className="py-3 px-2 text-right">{formatCurrency(result.total_sales)}</td>
                      <td className="py-3 px-2 text-right">{result.achievement_percentage.toFixed(1)}%</td>
                      <td className="py-3 px-2 text-center">{result.ote_multiplier}x</td>
                      <td className="py-3 px-2 text-center">{renderFlagBadge(result.flag_color)}</td>
                      <td className="py-3 px-2 text-right">{renderAdjustment(result.final_adjustment_percentage)}</td>
                      <td className="py-3 px-2 text-right font-semibold text-primary">
                        {formatCurrency(result.final_variable_amount)}
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="bg-muted/30 font-semibold">
                    <td colSpan={4} className="py-3 px-2">SUBTOTAL GESTORES</td>
                    <td className="py-3 px-2 text-right">
                      {formatCurrency(teamResults.reduce((sum, r) => sum + r.total_sales, 0))}
                    </td>
                    <td colSpan={4} className="py-3 px-2"></td>
                    <td className="py-3 px-2 text-right text-primary">
                      {formatCurrency(teamResults.reduce((sum, r) => sum + r.final_variable_amount, 0))}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Grand Total */}
      <Card className="bg-primary/5 border-primary/20">
        <CardContent className="py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <DollarSign className="h-6 w-6 text-primary" />
              <span className="text-lg font-semibold">TOTAL GERAL A PAGAR</span>
            </div>
            <span className="text-2xl font-bold text-primary">{formatCurrency(totalToPay)}</span>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
