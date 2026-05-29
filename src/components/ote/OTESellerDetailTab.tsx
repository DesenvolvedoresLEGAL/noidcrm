import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { OTEMonthlyResult } from '@/hooks/useOTEData';
import { useOTESalesRecords } from '@/hooks/useOTESalesRecords';
import { OTESellerSalesDrilldown } from './OTESellerSalesDrilldown';
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
import { Button } from '@/components/ui/button';

interface OTESellerDetailTabProps {
  results: OTEMonthlyResult[];
  isLoading: boolean;
  isOTEMode?: boolean;
}

export function OTESellerDetailTab({ results, isLoading, isOTEMode = true }: OTESellerDetailTabProps) {
  const [expandedSeller, setExpandedSeller] = useState<string | null>(null);
  const resultIds = results.map((r) => r.id);
  const { data: allRecords = [], isLoading: recordsLoading } = useOTESalesRecords(resultIds);


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
      {results.map((result) => (
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
                      <p className="font-semibold">{result.achievement_percentage.toFixed(1)}%</p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm text-muted-foreground">Variável Final</p>
                      <p className="font-bold text-primary">{formatCurrency(result.final_variable_amount)}</p>
                    </div>
                    <span className={cn(
                      "inline-flex items-center justify-center w-8 h-8 rounded-full",
                      result.flag_color === 'blue' && "bg-blue-500",
                      result.flag_color === 'yellow' && "bg-yellow-500",
                      result.flag_color === 'red' && "bg-red-500"
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
                          <span>{result.achievement_percentage.toFixed(1)}%</span>
                        </div>
                        <Progress 
                          value={Math.min(result.achievement_percentage, 100)} 
                          className="h-2"
                        />
                      </div>
                      {(() => {
                        const sellerRecords = allRecords.filter((r) => r.ote_result_id === result.id);
                        const ssotTotal = sellerRecords.reduce((s, r) => s + Number(r.sale_value || 0), 0);
                        const eligibleTotal = Number(result.total_sales || 0);
                        const showSplit = result.goal_type !== 'leads' && Math.abs(ssotTotal - eligibleTotal) > 0.01;
                        return (
                          <>
                            <div className="grid grid-cols-2 gap-4 text-sm">
                              <div>
                                <p className="text-muted-foreground">Meta</p>
                                <p className="font-semibold">{formatGoalValue(result.goal_amount, result.goal_type)}</p>
                              </div>
                              <div>
                                <p className="text-muted-foreground">
                                  {result.goal_type === 'leads' ? 'Leads Qualificados' : 'Elegível p/ meta'}
                                </p>
                                <p className="font-semibold">{formatGoalValue(eligibleTotal, result.goal_type)}</p>
                              </div>
                            </div>
                            {showSplit && (
                              <div className="rounded-md bg-muted/40 border border-dashed px-3 py-2 text-xs space-y-1">
                                <div className="flex justify-between">
                                  <span className="text-muted-foreground">Receita total (SSoT)</span>
                                  <span className="font-medium">{formatCurrency(ssotTotal)}</span>
                                </div>
                                <div className="flex justify-between">
                                  <span className="text-muted-foreground">Fora da meta</span>
                                  <span className="font-medium">{formatCurrency(ssotTotal - eligibleTotal)}</span>
                                </div>
                                <p className="text-[11px] text-muted-foreground pt-1">
                                  Itens com "Conta para comissão" desligada em Produtos geram receita,
                                  mas não somam na meta. Veja o detalhamento abaixo.
                                </p>
                              </div>
                            )}
                          </>
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

                {/* Drill-down: detalhe transparente das vendas / leads qualificados */}
                <div className="mt-6 pt-4 border-t">
                  <OTESellerSalesDrilldown
                    records={allRecords.filter((r) => r.ote_result_id === result.id)}
                    kind={result.goal_type === 'leads' ? 'qualified_lead' : 'sale'}
                    loading={recordsLoading}
                  />
                </div>


                {/* Status */}
                <div className="mt-6 pt-4 border-t flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className={cn(
                      "px-2 py-1 rounded text-xs font-medium",
                      result.status === 'pending' && "bg-yellow-100 text-yellow-800",
                      result.status === 'approved' && "bg-green-100 text-green-800",
                      result.status === 'paid' && "bg-blue-100 text-blue-800",
                      result.status === 'disputed' && "bg-red-100 text-red-800"
                    )}>
                      {result.status === 'pending' && 'Pendente'}
                      {result.status === 'approved' && 'Aprovado'}
                      {result.status === 'paid' && 'Pago'}
                      {result.status === 'disputed' && 'Contestado'}
                    </span>
                    {result.flag_reason && (
                      <span className="text-sm text-muted-foreground">{result.flag_reason}</span>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Calculado em {new Date(result.calculated_at).toLocaleString('pt-BR')}
                  </p>
                </div>
              </CardContent>
            </CollapsibleContent>
          </Collapsible>
        </Card>
      ))}
    </div>
  );
}
