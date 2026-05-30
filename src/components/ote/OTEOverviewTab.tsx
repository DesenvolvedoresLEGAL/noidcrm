import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { OTEMonthlyResult } from '@/hooks/useOTEData';
import { useSalesConfig } from '@/hooks/useSalesConfig';
import type { OTESalesRecord } from '@/hooks/useOTESalesRecords';
import { aggregateEligible } from './oteEligibility';
import { FLAG_LABELS } from '@/lib/results/resultsMode';
import { useClosedRevenueSummary, useRevenueBySeller } from '@/hooks/revenue/useRevenueSsot';
import { useCurrentOrganization } from '@/hooks/useCurrentOrganization';
import {
  DollarSign,
  TrendingUp,
  Users,
  Flag,
  AlertTriangle,
  Users2,
  UserCheck,
  Wallet,
  Ban,
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
  const { organization } = useCurrentOrganization();

  const flagBlueThreshold = config?.flag_blue_threshold ?? 70;
  const flagYellowMinThreshold = config?.flag_yellow_min_threshold ?? 50;
  const flagYellowMaxThreshold = config?.flag_yellow_max_threshold ?? 69.99;

  // SSoT oficial — mesma fonte do Relatório Vendas Realizadas (commercial_won_revenue_view).
  const [py, pm] = (period || '').split('-').map(Number);
  const periodStart = py && pm ? new Date(Date.UTC(py, pm - 1, 1)).toISOString() : undefined;
  const periodEnd = py && pm ? new Date(Date.UTC(py, pm, 1) - 1).toISOString() : undefined;
  const ssotParams = {
    surface: 'ote-overview',
    organizationId: organization?.id,
    start: periodStart,
    end: periodEnd,
  };
  const { data: ssotSummary, isError: ssotError } = useClosedRevenueSummary(ssotParams as any);
  const { data: ssotBySeller = [] } = useRevenueBySeller(ssotParams as any);
  const ssotBySellerMap = new Map(ssotBySeller.map((g) => [g.key, g.total]));

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
  const avgRevenueAchievement = revenueResults.length > 0
    ? revenueResults.reduce((sum, r) => sum + r.achievement_percentage, 0) / revenueResults.length
    : 0;

  // Reconciliação OTE:
  //   Comissão elegível comercial = Receita Válida do Relatório (SSoT oficial)
  //   Itens fora da meta = Comissão elegível comercial − Receita elegível OTE (item a item)
  const revenueResultIds = new Set(revenueResults.map((r) => r.id));
  const revenueRecords = records.filter((r) => revenueResultIds.has(r.ote_result_id));
  const { eligibleTotal: oteEligible } = aggregateEligible(revenueRecords);
  const ssotAvailable = !!ssotSummary && !ssotError;
  const commercialEligible = ssotAvailable ? Number(ssotSummary!.eligible || ssotSummary!.total || 0) : 0;
  const itemsOutOfGoal = Math.max(0, commercialEligible - oteEligible);

  // Eligible per seller (para a coluna "Receita elegível OTE" da tabela Closers).
  const eligiblePerSeller = new Map<string, number>();
  for (const r of revenueResults) {
    const recs = records.filter((rec) => rec.ote_result_id === r.id);
    eligiblePerSeller.set(r.id, aggregateEligible(recs).eligibleTotal);
  }

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
    )} title={flagColor === 'blue' ? FLAG_LABELS.blue : flagColor === 'yellow' ? FLAG_LABELS.yellow : flagColor === 'red' ? FLAG_LABELS.red : undefined}>
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

  // Validação de reconciliação OTE.
  const reconciliationDelta = commercialEligible - itemsOutOfGoal - oteEligible;
  const hasReconciliationIssue = Math.abs(reconciliationDelta) > 0.01 || oteEligible > commercialEligible + 0.01;

  return (
    <div className="space-y-6">
      {/* KPI Cards (modo OTE) */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Total a pagar</p>
                <p className="text-2xl font-bold text-primary">{formatCurrency(totalToPay)}</p>
                <p className="text-xs text-muted-foreground">Variável final do período</p>
              </div>
              <Wallet className="h-8 w-8 text-primary/20" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Comissão elegível comercial</p>
                <p className="text-2xl font-bold">{formatCurrency(commercialEligible)}</p>
                <p className="text-xs text-muted-foreground">Fonte: Vendas Realizadas</p>
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
                <p className="text-2xl font-bold">{formatCurrency(oteEligible)}</p>
                <p className="text-xs text-muted-foreground">Após excluir itens fora da meta</p>
              </div>
              <TrendingUp className="h-8 w-8 text-muted-foreground/20" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Itens fora da meta</p>
                <p className="text-2xl font-bold">{formatCurrency(itemsOutOfGoal)}</p>
                <p className="text-xs text-muted-foreground">Produtos, serviços, logística e taxas</p>
              </div>
              <Ban className="h-8 w-8 text-muted-foreground/20" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Vendedores no cálculo</p>
                <div className="flex items-baseline gap-2">
                  <p className="text-2xl font-bold">{individualResults.length}</p>
                  <span className="text-sm text-muted-foreground">vendedores</span>
                </div>
                <p className="text-xs text-muted-foreground">Closers, pré-vendas e funções configuradas</p>
              </div>
              <Users className="h-8 w-8 text-muted-foreground/20" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Faixa de reconciliação OTE */}
      <Card className={cn(hasReconciliationIssue && 'border-destructive/40 bg-destructive/5')}>
        <CardContent className="py-3 text-sm flex flex-wrap items-center gap-2">
          <span className="font-medium">Reconciliação OTE:</span>
          <span>{formatCurrency(commercialEligible)}</span>
          <span className="text-muted-foreground">(comercial)</span>
          <span>−</span>
          <span>{formatCurrency(itemsOutOfGoal)}</span>
          <span className="text-muted-foreground">(fora da meta)</span>
          <span>=</span>
          <span className="font-semibold">{formatCurrency(oteEligible)}</span>
          <span className="text-muted-foreground">(elegível OTE)</span>
          {hasReconciliationIssue && (
            <span className="ml-2 inline-flex items-center gap-1 text-destructive">
              <AlertTriangle className="h-4 w-4" />
              Divergência detectada — recalcule o período ou revise itens sem regra de meta.
            </span>
          )}
        </CardContent>
      </Card>

      {/* Flag Summary com labels executivos */}
      <div className="grid grid-cols-3 gap-4">
        <Card className="border-l-4 border-l-blue-500">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">{FLAG_LABELS.blue}</p>
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
                <p className="text-sm text-muted-foreground">{FLAG_LABELS.yellow}</p>
                <p className="text-3xl font-bold text-yellow-500">{yellowFlags}</p>
                <p className="text-xs text-muted-foreground">{flagYellowMinThreshold}% – {flagYellowMaxThreshold}% da meta</p>
              </div>
              <Flag className="h-10 w-10 text-yellow-500/30" />
            </div>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-red-500">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">{FLAG_LABELS.red}</p>
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
              <span className="ml-auto text-xs font-normal text-muted-foreground">
                Média % Meta: {avgRevenueAchievement.toFixed(1)}%
              </span>
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
                    <th className="text-right py-3 px-2 hidden lg:table-cell">Comissão elegível comercial</th>
                    <th className="text-right py-3 px-2">Receita elegível OTE</th>
                    <th className="text-right py-3 px-2">% Meta</th>
                    <th className="text-center py-3 px-2">Mult.</th>
                    <th className="text-right py-3 px-2">Base</th>
                    <th className="text-center py-3 px-2">Flag</th>
                    <th className="text-right py-3 px-2">Acelerador</th>
                    <th className="text-right py-3 px-2 font-semibold">Variável Final</th>
                  </tr>
                </thead>
                <tbody>
                  {revenueResults.map((result) => {
                    const eligible = eligiblePerSeller.get(result.id) ?? 0;
                    return (
                      <tr key={result.id} className="border-b hover:bg-muted/50">
                        <td className="py-3 px-2 font-medium" title={`Comissão elegível comercial: ${formatCurrency(result.total_sales)}`}>
                          {result.profile?.full_name || result.level_name_snapshot || result.user_id.slice(0, 8) + '...'}
                        </td>
                        <td className="py-3 px-2">{result.level_name_snapshot || '-'}</td>
                        <td className="py-3 px-2 text-right">{formatCurrency(result.goal_amount)}</td>
                        <td className="py-3 px-2 text-right hidden lg:table-cell text-muted-foreground">{formatCurrency(result.total_sales)}</td>
                        <td className="py-3 px-2 text-right">{formatCurrency(eligible)}</td>
                        <td className="py-3 px-2 text-right">{result.achievement_percentage.toFixed(1)}%</td>
                        <td className="py-3 px-2 text-center">{result.ote_multiplier}x</td>
                        <td className="py-3 px-2 text-right">{formatCurrency(result.base_variable)}</td>
                        <td className="py-3 px-2 text-center">{renderFlagBadge(result.flag_color)}</td>
                        <td className="py-3 px-2 text-right">{renderAdjustment(result.final_adjustment_percentage)}</td>
                        <td className="py-3 px-2 text-right font-semibold text-primary">
                          {formatCurrency(result.final_variable_amount)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
                <tfoot>
                  <tr className="bg-muted/30 font-semibold">
                    <td colSpan={3} className="py-3 px-2">SUBTOTAL CLOSERS</td>
                    <td className="py-3 px-2 text-right hidden lg:table-cell">{formatCurrency(commercialEligible)}</td>
                    <td className="py-3 px-2 text-right">{formatCurrency(oteEligible)}</td>
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
