/**
 * PATCH OTE 1.6.1 — Refinamento premium da Visão Geral.
 *
 * Ordem oficial:
 *   1) Resumo financeiro do OTE (bloco único horizontal com 4 métricas).
 *   2) Campeonato Comercial + Pódio + Filtros + Ranking expansível
 *      (delegado ao OTESellerDetailTab).
 *
 * Removido nesta revisão:
 *   - Card separado "Vendedores no cálculo" (passa a viver como
 *     "Participantes" dentro do Campeonato Comercial).
 *   - Card separado "Total a pagar" duplicado (mantido apenas no resumo
 *     financeiro).
 *   - Rodapé "Total geral a pagar" (redundante com o bloco financeiro).
 *
 * NÃO altera nenhum cálculo OTE/comissão/elegibilidade.
 */
import { Card, CardContent } from '@/components/ui/card';
import { OTEMonthlyResult } from '@/hooks/useOTEData';
import type { OTESalesRecord } from '@/hooks/useOTESalesRecords';
import { aggregateEligible } from './oteEligibility';
import { useOfficialEligibleRevenueSummary } from '@/hooks/revenue/useRevenueSsot';
import { useCurrentOrganization } from '@/hooks/useCurrentOrganization';
import { AlertTriangle, Wallet } from 'lucide-react';
import { cn } from '@/lib/utils';
import { OTESellerDetailTab } from './OTESellerDetailTab';

interface OTEOverviewTabProps {
  results: OTEMonthlyResult[];
  records?: OTESalesRecord[];
  isLoading: boolean;
  period: string;
  isOTEMode?: boolean;
}

const REVENUE_LEVEL_RE = /closer|executor|rainmaker|dealmaker|strategic/i;

function isRevenueRole(r: OTEMonthlyResult) {
  const level = `${r.level_name_snapshot ?? ''} ${(r.ote_level as any)?.level_code ?? ''}`;
  return (
    (r.goal_type || 'revenue') === 'revenue' &&
    !r.is_team_target &&
    REVENUE_LEVEL_RE.test(level)
  );
}

const formatCurrency = (value: number) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value || 0);

export function OTEOverviewTab({
  results,
  records = [],
  isLoading,
  period,
  isOTEMode = true,
}: OTEOverviewTabProps) {
  const { organization } = useCurrentOrganization();

  const [py, pm] = (period || '').split('-').map(Number);
  const periodStart =
    py && pm ? new Date(Date.UTC(py, pm - 1, 1)).toISOString() : undefined;
  const periodEnd =
    py && pm ? new Date(Date.UTC(py, pm, 1) - 1).toISOString() : undefined;
  const ssotParams = {
    surface: 'ote-overview',
    organizationId: organization?.id,
    start: periodStart,
    end: periodEnd,
  } as const;
  const { data: ssotSummary, isError: ssotError } =
    useOfficialEligibleRevenueSummary(ssotParams as any);

  const revenueResults = results.filter((r) => !r.is_team_target).filter(isRevenueRole);

  const totalToPay = results.reduce(
    (sum, r) => sum + Number(r.final_variable_amount || 0),
    0,
  );
  const revenueResultIds = new Set(revenueResults.map((r) => r.id));
  const revenueRecords = records.filter((r) => revenueResultIds.has(r.ote_result_id));
  const { eligibleTotal: oteEligible } = aggregateEligible(revenueRecords);
  const ssotAvailable = !!ssotSummary && !ssotError;
  const commercialEligible = ssotAvailable ? Number(ssotSummary!.eligible || 0) : 0;
  const itemsOutOfGoal = Math.max(0, commercialEligible - oteEligible);

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
        <CardContent className="py-16 text-center">
          <AlertTriangle className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
          <h3 className="text-lg font-semibold">
            Nenhum resultado calculado para este período
          </h3>
          <p className="text-muted-foreground mt-2 text-sm">
            Calcule o período para gerar ranking, metas, vendas, qualificações e variável final.
          </p>
        </CardContent>
      </Card>
    );
  }

  const financialMetrics: Array<{
    label: string;
    value: string;
    hint: string;
    emphasize?: boolean;
    warn?: boolean;
  }> = [
    {
      label: 'Comissão elegível comercial',
      value: ssotAvailable ? formatCurrency(commercialEligible) : '—',
      hint: ssotAvailable
        ? 'Fonte: Vendas Realizadas'
        : 'Não foi possível carregar a base comercial oficial.',
      warn: !ssotAvailable,
    },
    {
      label: 'Receita elegível OTE',
      value: formatCurrency(oteEligible),
      hint: 'Após excluir itens fora da meta',
    },
    {
      label: 'Itens fora da meta',
      value: formatCurrency(itemsOutOfGoal),
      hint: 'Produtos, serviços, logística e taxas',
    },
    {
      label: 'Total a pagar',
      value: formatCurrency(totalToPay),
      hint: 'Variável final do período',
      emphasize: true,
    },
  ];

  return (
    <div className="space-y-6">
      {/* ===== Bloco 1: Resumo financeiro do OTE (card único) ===== */}
      <Card className="overflow-hidden border-primary/20 bg-gradient-to-br from-primary/5 via-background to-background">
        <CardContent className="p-5">
          <div className="mb-4 flex items-center gap-3">
            <div className="rounded-lg bg-primary/10 p-2.5">
              <Wallet className="h-5 w-5 text-primary" />
            </div>
            <div>
              <h2 className="text-base font-semibold leading-tight">Resumo financeiro do OTE</h2>
              <p className="text-xs text-muted-foreground">
                A Receita elegível OTE é calculada após excluir itens configurados fora da meta.
              </p>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4 md:grid-cols-4 md:gap-6">
            {financialMetrics.map((m) => (
              <div
                key={m.label}
                className={cn(
                  'rounded-lg border bg-background/40 p-4',
                  m.emphasize && 'border-primary/40 bg-primary/5',
                )}
              >
                <p className="text-[11px] uppercase tracking-wide text-muted-foreground">
                  {m.label}
                </p>
                <p
                  className={cn(
                    'mt-1 text-2xl font-bold tabular-nums',
                    m.emphasize && 'text-primary',
                  )}
                >
                  {m.value}
                </p>
                <p
                  className={cn(
                    'mt-1 text-[11px]',
                    m.warn ? 'text-destructive' : 'text-muted-foreground',
                  )}
                >
                  {m.hint}
                </p>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* ===== Bloco 2: Campeonato Comercial + Pódio + Ranking expansível ===== */}
      <OTESellerDetailTab
        results={results}
        isLoading={false}
        isOTEMode={isOTEMode}
        period={period}
      />
    </div>
  );
}
