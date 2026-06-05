import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { OTEMonthlyResult } from '@/hooks/useOTEData';
import { useOTESalesRecords } from '@/hooks/useOTESalesRecords';
import { OTESellerSalesDrilldown } from './OTESellerSalesDrilldown';
import { OTESellerQualifiedLeadsDrilldown } from './OTESellerQualifiedLeadsDrilldown';
import { useHistoricalQualifiers } from '@/hooks/results/useHistoricalQualifiers';
import { useCurrentOrganization } from '@/hooks/useCurrentOrganization';
import { aggregateEligible } from './oteEligibility';
import { computeOteAchievementPercentage, computeOteFlagColor } from './oteAchievement';
import { useSalesConfig } from '@/hooks/useSalesConfig';
import {
  User,
  Target,
  TrendingUp,
  Zap,
  Flag,
  ChevronDown,
  ChevronUp,
  Gamepad2,
  ClipboardCheck,
  Star
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Progress } from '@/components/ui/progress';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';

interface OTESellerDetailTabProps {
  results: OTEMonthlyResult[];
  isLoading: boolean;
  isOTEMode?: boolean;
  /** Período no formato YYYY-MM para resolver qualificações históricas. */
  period?: string;
}

export function OTESellerDetailTab({ results, isLoading, isOTEMode = true, period }: OTESellerDetailTabProps) {
  const [expandedSeller, setExpandedSeller] = useState<string | null>(null);
  const resultIds = results.map((r) => r.id);
  const { data: allRecords = [], isLoading: recordsLoading } = useOTESalesRecords(resultIds);
  const { organization } = useCurrentOrganization();
  const { config } = useSalesConfig();
  const flagBlueThreshold = config?.flag_blue_threshold ?? 70;
  const flagYellowMinThreshold = config?.flag_yellow_min_threshold ?? 50;

  // Fonte ÚNICA de leads qualificados (mesma do Visão Geral / Win-Loss):
  // opportunities won em pipeline qualification + atribuição histórica.
  const [py, pm] = (period || '').split('-').map(Number);
  const periodStart = py && pm ? new Date(Date.UTC(py, pm - 1, 1)).toISOString() : undefined;
  const periodEnd = py && pm ? new Date(Date.UTC(py, pm, 1) - 1).toISOString() : undefined;
  const { data: qualifiers = [] } = useHistoricalQualifiers({
    organizationId: organization?.id,
    start: periodStart,
    end: periodEnd,
  });
  const qualifierMap = new Map(qualifiers.map((q) => [q.qualifierUserId, q.qualifiedLeads]));



  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    }).format(value);
  };

  const formatGoalValue = (value: number, goalType?: 'revenue' | 'leads') =>
    goalType === 'leads' ? `${Math.round(Number(value) || 0)} leads` : formatCurrency(value);

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
        <CardContent className="py-12 text-center text-muted-foreground">
          Nenhum vendedor com OTE calculado neste período.
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {results.map((result) => {
        // PATCH OTE 1.4.1 — % Meta deriva da mesma base exibida (Receita elegível OTE
        // para closers, Leads qualificados para pré-vendas). Nunca usa
        // achievement_percentage bruto do backend.
        const sellerRecords = allRecords.filter((r) => r.ote_result_id === result.id);
        const { eligibleTotal: sellerEligible } = aggregateEligible(sellerRecords);
        const histLeadsForPct = qualifierMap.get(result.user_id);
        const qualifiedLeadsForPct = typeof histLeadsForPct === 'number'
          ? histLeadsForPct
          : Number(result.total_sales || 0);
        const pctMeta = computeOteAchievementPercentage({
          result,
          eligibleRevenue: sellerEligible,
          qualifiedLeads: qualifiedLeadsForPct,
        });
        const flagColor = result.is_team_target
          ? result.flag_color
          : computeOteFlagColor(pctMeta, flagBlueThreshold, flagYellowMinThreshold);
        return (
        <Card key={result.id}>
          <Collapsible
            open={expandedSeller === result.id}
            onOpenChange={() => setExpandedSeller(expandedSeller === result.id ? null : result.id)}
          >
            <CollapsibleTrigger asChild>
              <CardHeader className="cursor-pointer hover:bg-muted/50 transition-colors">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className="flex items-center justify-center w-10 h-10 rounded-full bg-primary/10">
                      <User className="h-5 w-5 text-primary" />
                    </div>
                    <div>
                      <CardTitle className="text-base">
                        {result.profile?.full_name || result.level_name_snapshot || 'Vendedor'}
                      </CardTitle>
                      <p className="text-sm text-muted-foreground">{result.level_name_snapshot || '-'}</p>
                    </div>
                  </div>

                  <div className="flex items-center gap-6">
                    <div className="text-right">
                      <p className="text-sm text-muted-foreground">% Meta</p>
                      <p className="font-semibold">{pctMeta.toFixed(1)}%</p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm text-muted-foreground">Variável Final</p>
                      <p className="font-bold text-primary">{formatCurrency(result.final_variable_amount)}</p>
                    </div>
                    <span className={cn(
                      "inline-flex items-center justify-center w-8 h-8 rounded-full",
                      flagColor === 'blue' && "bg-blue-500",
                      flagColor === 'yellow' && "bg-yellow-500",
                      flagColor === 'red' && "bg-red-500"
                    )}>
                      <Flag className="h-4 w-4 text-white" />
                    </span>
                    {expandedSeller === result.id ? (
                      <ChevronUp className="h-5 w-5 text-muted-foreground" />
                    ) : (
                      <ChevronDown className="h-5 w-5 text-muted-foreground" />
                    )}
                  </div>
                </div>
              </CardHeader>
            </CollapsibleTrigger>

            <CollapsibleContent>
              <CardContent className="pt-0 pb-6">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  {/* Vendas e Meta */}
                  <div className="space-y-4">
                    <h4 className="font-semibold flex items-center gap-2">
                      <Target className="h-4 w-4 text-primary" />
                      Vendas e Meta
                    </h4>
                    <div className="space-y-3">
                      <div>
                        <div className="flex justify-between text-sm mb-1">
                          <span>Progresso da Meta</span>
                          <span>{pctMeta.toFixed(1)}%</span>
                        </div>
                        <Progress
                          value={Math.min(pctMeta, 100)}
                          className="h-2"
                        />
                      </div>
                      {(() => {
                        const sellerRecords = allRecords.filter((r) => r.ote_result_id === result.id);
                        const { eligibleTotal } = aggregateEligible(sellerRecords);
                        const isLeads = result.goal_type === 'leads';
                        // Fonte única (mesma da Visão Geral): qualifierMap por user_id histórico.
                        const histLeads = qualifierMap.get(result.user_id);
                        const qualifiedLeads = typeof histLeads === 'number' ? histLeads : Number(result.total_sales || 0);
                        return (
                          <div className="grid grid-cols-2 gap-4 text-sm">
                            <div>
                              <p className="text-muted-foreground">Meta</p>
                              <p className="font-semibold">{formatGoalValue(result.goal_amount, result.goal_type)}</p>
                            </div>
                            <div>
                              <p className="text-muted-foreground">
                                {isLeads ? 'Leads Qualificados' : 'Receita elegível OTE'}
                              </p>
                              <p className="font-semibold">
                                {isLeads
                                  ? formatGoalValue(qualifiedLeads, 'leads')
                                  : formatCurrency(eligibleTotal)}
                              </p>
                            </div>
                          </div>
                        );
                      })()}
                    </div>
                  </div>

                  {/* Multiplicador OTE */}
                  <div className="space-y-4">
                    <h4 className="font-semibold flex items-center gap-2">
                      <TrendingUp className="h-4 w-4 text-primary" />
                      Cálculo OTE
                    </h4>
                    <div className="space-y-3 text-sm">
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Multiplicador</span>
                        <span className="font-semibold">{result.ote_multiplier}x</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Variável Base</span>
                        <span>{formatCurrency(result.base_variable)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Ajuste Final</span>
                        <span className={cn(
                          result.final_adjustment_percentage > 0 && "text-green-600",
                          result.final_adjustment_percentage < 0 && "text-red-600"
                        )}>
                          {result.final_adjustment_percentage > 0 ? '+' : ''}
                          {result.final_adjustment_percentage.toFixed(1)}%
                        </span>
                      </div>
                      <div className="flex justify-between border-t pt-2">
                        <span className="font-semibold">Variável Final</span>
                        <span className="font-bold text-primary">{formatCurrency(result.final_variable_amount)}</span>
                      </div>
                    </div>
                  </div>

                  {/* Aceleradores/Desaceleradores */}
                  <div className="space-y-4">
                    <h4 className="font-semibold flex items-center gap-2">
                      <Zap className="h-4 w-4 text-primary" />
                      Performance
                    </h4>
                    <div className="space-y-3 text-sm">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Gamepad2 className="h-4 w-4 text-muted-foreground" />
                          <span>Roleplay</span>
                        </div>
                        <div className="text-right">
                          <span className="text-muted-foreground mr-2">
                            {result.roleplay_score?.toFixed(1) || '-'}
                          </span>
                          <span className={cn(
                            result.roleplay_accelerator > 0 && "text-green-600",
                            result.roleplay_accelerator < 0 && "text-red-600"
                          )}>
                            {result.roleplay_accelerator > 0 ? '+' : ''}{result.roleplay_accelerator}%
                          </span>
                        </div>
                      </div>
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <ClipboardCheck className="h-4 w-4 text-muted-foreground" />
                          <span>CRM</span>
                        </div>
                        <div className="text-right">
                          <span className="text-muted-foreground mr-2">
                            {result.crm_completion_score?.toFixed(0) || '-'}%
                          </span>
                          <span className={cn(
                            result.crm_accelerator > 0 && "text-green-600",
                            result.crm_accelerator < 0 && "text-red-600"
                          )}>
                            {result.crm_accelerator > 0 ? '+' : ''}{result.crm_accelerator}%
                          </span>
                        </div>
                      </div>
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Star className="h-4 w-4 text-muted-foreground" />
                          <span>FitScore</span>
                        </div>
                        <div className="text-right">
                          <span className="text-muted-foreground mr-2">
                            {result.fitscore_avg?.toFixed(0) || '-'}
                          </span>
                          <span className={cn(
                            result.fitscore_accelerator > 0 && "text-green-600",
                            result.fitscore_accelerator < 0 && "text-red-600"
                          )}>
                            {result.fitscore_accelerator > 0 ? '+' : ''}{result.fitscore_accelerator}%
                          </span>
                        </div>
                      </div>
                      <div className="border-t pt-2 flex justify-between">
                        <span>Total Aceleradores</span>
                        <span className="text-green-600">+{result.total_accelerator_percentage}%</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Total Desaceleradores</span>
                        <span className="text-red-600">-{result.total_decelerator_percentage}%</span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Drill-down: detalhe transparente das vendas / leads qualificados.
                    Pré-vendas usa fonte ÚNICA (opportunities won + atribuição histórica). */}
                <div className="mt-6 pt-4 border-t">
                  {result.goal_type === 'leads' ? (
                    period ? (
                      <OTESellerQualifiedLeadsDrilldown
                        userId={result.user_id}
                        userName={result.profile?.full_name}
                        period={period}
                        expectedCount={qualifierMap.get(result.user_id) ?? Number(result.total_sales || 0)}
                      />
                    ) : (
                      <div className="text-sm text-muted-foreground py-4">
                        Período não informado para detalhar qualificações.
                      </div>
                    )
                  ) : (
                    <OTESellerSalesDrilldown
                      records={allRecords.filter((r) => r.ote_result_id === result.id)}
                      kind="sale"
                      loading={recordsLoading}
                    />
                  )}
                </div>



                {/* Rodapé: somente timestamp de cálculo. Status/flag removidos
                    do rodapé (apareciam soltos sem contexto). */}
                <div className="mt-6 pt-4 border-t flex items-center justify-end">
                  <p className="text-xs text-muted-foreground">
                    Calculado em {new Date(result.calculated_at).toLocaleString('pt-BR')}
                  </p>
                </div>
              </CardContent>
            </CollapsibleContent>
          </Collapsible>
        </Card>
        );
      })}
    </div>
  );
}
