/**
 * SPRINT OTE 1.6 — Visão Geral unificada (cockpit OTE).
 *
 * Esta tela consolida o que antes era dividido entre "Visão Geral" e
 * "Por Vendedor". A composição segue a ordem oficial da sprint:
 *
 *   1) Cards financeiros de comprovação (Total a pagar, Comissão elegível
 *      comercial, Receita elegível OTE, Itens fora da meta, Vendedores no
 *      cálculo).
 *   2) Campeonato Comercial + Pódio do mês + Filtros + Ranking expansível
 *      (delegado ao OTESellerDetailTab, que já implementa pódio, filtros,
 *      ordenação e drill-down por vendedor — SPRINT OTE 1.5).
 *   3) Total geral a pagar como resumo financeiro final.
 *
 * NÃO altera nenhum cálculo OTE/comissão/elegibilidade/qualificação.
 * Apenas reorganiza a UI e remove tabelas antigas e bloco de reconciliação.
 */
import { Card, CardContent } from '@/components/ui/card';
import { OTEMonthlyResult } from '@/hooks/useOTEData';
import type { OTESalesRecord } from '@/hooks/useOTESalesRecords';
import { aggregateEligible } from './oteEligibility';
import {
  useOfficialEligibleRevenueSummary,
} from '@/hooks/revenue/useRevenueSsot';
import { useCurrentOrganization } from '@/hooks/useCurrentOrganization';
import {
  DollarSign,
  TrendingUp,
  Users,
  AlertTriangle,
  Wallet,
  Ban,
} from 'lucide-react';
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

  // SSoT oficial — mesma fonte do Relatório Vendas Realizadas
  // (commercial_won_revenue_view). Não recalcular aqui.
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

  const individualResults = results.filter((r) => !r.is_team_target);
  const revenueResults = individualResults.filter(isRevenueRole);

  // KPIs financeiros (mesma lógica anterior, intacta).
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

  return (
    <div className="space-y-6">
      {/* ===== Bloco 1: Cards financeiros de comprovação ===== */}
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

        <Card className={cn(!ssotAvailable && 'border-destructive/40 bg-destructive/5')}>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Comissão elegível comercial</p>
                <p className="text-2xl font-bold">
                  {ssotAvailable ? formatCurrency(commercialEligible) : '—'}
                </p>
                <p
                  className={cn(
                    'text-xs',
                    ssotAvailable ? 'text-muted-foreground' : 'text-destructive',
                  )}
                >
                  {ssotAvailable
                    ? 'Fonte: Vendas Realizadas'
                    : 'Não foi possível carregar a base comercial oficial.'}
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
                <p className="text-2xl font-bold">{formatCurrency(oteEligible)}</p>
                <p className="text-xs text-muted-foreground">
                  Após excluir itens fora da meta
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
                <p className="text-sm text-muted-foreground">Itens fora da meta</p>
                <p className="text-2xl font-bold">{formatCurrency(itemsOutOfGoal)}</p>
                <p className="text-xs text-muted-foreground">
                  Produtos, serviços, logística e taxas
                </p>
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
                <p className="text-xs text-muted-foreground">
                  Closers, pré-vendas e funções configuradas
                </p>
              </div>
              <Users className="h-8 w-8 text-muted-foreground/20" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* ===== Bloco 2: Campeonato Comercial + Pódio + Ranking expansível =====
          Toda a experiência premium da antiga aba "Por Vendedor" é renderizada
          aqui, sem duplicar lógica nem cálculos (SPRINT OTE 1.5). */}
      <OTESellerDetailTab
        results={results}
        isLoading={false}
        isOTEMode={isOTEMode}
        period={period}
      />

      {/* ===== Bloco 3: Total geral a pagar ===== */}
      <Card className="border-primary/30 bg-gradient-to-br from-primary/5 via-background to-background">
        <CardContent className="flex flex-col gap-2 py-5 md:flex-row md:items-center md:justify-between">
          <div className="flex items-center gap-3">
            <div className="rounded-lg bg-primary/10 p-2.5">
              <Wallet className="h-6 w-6 text-primary" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Resumo financeiro final</p>
              <h3 className="text-base font-semibold">Total geral a pagar</h3>
            </div>
          </div>
          <p className="text-3xl font-bold text-primary tabular-nums">
            {formatCurrency(totalToPay)}
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
