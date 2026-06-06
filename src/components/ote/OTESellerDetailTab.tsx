import { useMemo, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { OTEMonthlyResult, useOTEMultipliers } from '@/hooks/useOTEData';
import { useOTESalesRecords } from '@/hooks/useOTESalesRecords';
import { OTESellerSalesDrilldown } from './OTESellerSalesDrilldown';
import { OTESellerQualifiedLeadsDrilldown } from './OTESellerQualifiedLeadsDrilldown';
import { useHistoricalQualifiers } from '@/hooks/results/useHistoricalQualifiers';
import { useCurrentOrganization } from '@/hooks/useCurrentOrganization';
import { aggregateEligible } from './oteEligibility';
import {
  computeOteAchievementPercentage,
  computeOteFlagColor,
} from './oteAchievement';
import { useSalesConfig } from '@/hooks/useSalesConfig';
import {
  resolveOteMultiplierFromPercent,
  detectMultiplierMismatch,
} from '@/lib/ote/multiplier';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { AlertTriangle } from 'lucide-react';
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
  Star,
  Trophy,
  Medal,
  Crown,
  Award,
  Users as UsersIcon,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';

interface OTESellerDetailTabProps {
  results: OTEMonthlyResult[];
  isLoading: boolean;
  isOTEMode?: boolean;
  /** Período no formato YYYY-MM para resolver qualificações históricas. */
  period?: string;
}

type RankFilter =
  | 'all'
  | 'closers'
  | 'presales'
  | 'high'
  | 'low'
  | 'with_variable'
  | 'inactive_with_result';

type RankSort = 'pct' | 'variable' | 'revenue' | 'leads' | 'name';

interface RankRow {
  result: OTEMonthlyResult;
  pctMeta: number;
  flagColor: 'blue' | 'yellow' | 'red';
  eligibleTotal: number;
  qualifiedLeads: number;
  isLeads: boolean;
  isInactive: boolean;
  hasGoal: boolean;
  variableAmount: number;
  fullName: string;
  levelName: string;
  status: 'high' | 'mid' | 'low' | 'nogoal';
}

const formatCurrency = (value: number) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value || 0);

const formatGoalValue = (value: number, goalType?: 'revenue' | 'leads') =>
  goalType === 'leads' ? `${Math.round(Number(value) || 0)} leads` : formatCurrency(value);

function statusFromPct(pct: number, hasGoal: boolean): RankRow['status'] {
  if (!hasGoal) return 'nogoal';
  if (pct >= 70) return 'high';
  if (pct >= 50) return 'mid';
  return 'low';
}

function statusLabel(s: RankRow['status']): string {
  switch (s) {
    case 'high':
      return 'Alta performance';
    case 'mid':
      return 'Em recuperação';
    case 'low':
      return 'Abaixo do mínimo';
    case 'nogoal':
      return 'Sem meta configurada';
  }
}

function statusBadgeClasses(s: RankRow['status']): string {
  switch (s) {
    case 'high':
      return 'border-blue-500/40 bg-blue-500/10 text-blue-700 dark:text-blue-300';
    case 'mid':
      return 'border-yellow-500/40 bg-yellow-500/10 text-yellow-700 dark:text-yellow-300';
    case 'low':
      return 'border-red-500/40 bg-red-500/10 text-red-700 dark:text-red-300';
    case 'nogoal':
      return 'border-muted-foreground/30 bg-muted text-muted-foreground';
  }
}

function positionLabel(idx: number): string {
  if (idx === 0) return 'Líder';
  if (idx === 1) return 'Vice líder';
  if (idx === 2) return 'Top 3';
  return `#${idx + 1}`;
}

function PodiumIcon({ idx }: { idx: number }) {
  if (idx === 0) return <Crown className="h-5 w-5 text-amber-500" />;
  if (idx === 1) return <Trophy className="h-5 w-5 text-slate-400" />;
  if (idx === 2) return <Medal className="h-5 w-5 text-orange-500" />;
  return <Award className="h-5 w-5 text-muted-foreground" />;
}

/**
 * Barra de progresso premium com marcadores em 50% e 70% (cortes de premiação).
 * Renderiza badge "Acima de 100%" quando estoura a meta.
 */
function GoalProgressBar({
  pct,
  status,
}: {
  pct: number;
  status: RankRow['status'];
}) {
  const clamped = Math.min(Math.max(pct, 0), 100);
  const fillClass =
    status === 'high'
      ? 'bg-blue-500'
      : status === 'mid'
      ? 'bg-yellow-500'
      : status === 'low'
      ? 'bg-red-500'
      : 'bg-muted-foreground/40';
  return (
    <div className="space-y-1">
      <div className="relative h-2.5 w-full overflow-hidden rounded-full bg-secondary">
        <div
          className={cn('absolute left-0 top-0 h-full transition-all', fillClass)}
          style={{ width: `${clamped}%` }}
        />
        {/* Marcador 50% */}
        <div
          className="absolute top-0 h-full w-px bg-foreground/30"
          style={{ left: '50%' }}
          aria-hidden
        />
        {/* Marcador 70% (corte de premiação) */}
        <div
          className="absolute top-0 h-full w-px bg-foreground/60"
          style={{ left: '70%' }}
          aria-hidden
        />
      </div>
      <div className="flex justify-between text-[10px] text-muted-foreground">
        <span>0%</span>
        <span className="-translate-x-1/2" style={{ marginLeft: '50%' }}>
          50%
        </span>
        <span>
          {pct > 100 && (
            <Badge variant="secondary" className="ml-2 text-[10px]">
              Acima de 100%
            </Badge>
          )}
          100%
        </span>
      </div>
    </div>
  );
}

export function OTESellerDetailTab({
  results,
  isLoading,
  isOTEMode: _isOTEMode = true,
  period,
}: OTESellerDetailTabProps) {
  const [expandedSeller, setExpandedSeller] = useState<string | null>(null);
  const [filter, setFilter] = useState<RankFilter>('all');
  const [sortBy, setSortBy] = useState<RankSort>('pct');

  const resultIds = results.map((r) => r.id);
  const { data: allRecords = [], isLoading: recordsLoading } = useOTESalesRecords(resultIds);
  const { organization } = useCurrentOrganization();
  const { config } = useSalesConfig();
  const flagBlueThreshold = config?.flag_blue_threshold ?? 70;
  const flagYellowMinThreshold = config?.flag_yellow_min_threshold ?? 50;

  // Fonte ÚNICA de leads qualificados (mesma do Visão Geral / Win-Loss):
  // opportunities won em pipeline qualification + atribuição histórica.
  const [py, pm] = (period || '').split('-').map(Number);
  const periodStart =
    py && pm ? new Date(Date.UTC(py, pm - 1, 1)).toISOString() : undefined;
  const periodEnd =
    py && pm ? new Date(Date.UTC(py, pm, 1) - 1).toISOString() : undefined;
  const { data: qualifiers = [] } = useHistoricalQualifiers({
    organizationId: organization?.id,
    start: periodStart,
    end: periodEnd,
  });
  const qualifierMap = useMemo(
    () => new Map(qualifiers.map((q) => [q.qualifierUserId, q.qualifiedLeads])),
    [qualifiers],
  );

  /**
   * SPRINT OTE 1.5 — Ranking competitivo. Toda métrica é DERIVADA dos cálculos
   * já validados (PATCH OTE 1.4.1): receita_elegivel_ote para closers e
   * leads_qualificados (atribuição histórica) para pré-vendas. Esta sprint
   * NÃO altera nenhum cálculo — apenas reorganiza visualmente.
   */
  const rows: RankRow[] = useMemo(() => {
    return results
      .filter((r) => !r.is_team_target)
      .map((result) => {
        const sellerRecords = allRecords.filter((rec) => rec.ote_result_id === result.id);
        const { eligibleTotal } = aggregateEligible(sellerRecords);
        const histLeads = qualifierMap.get(result.user_id);
        const qualifiedLeads =
          typeof histLeads === 'number' ? histLeads : Number(result.total_sales || 0);
        const pctMeta = computeOteAchievementPercentage({
          result,
          eligibleRevenue: eligibleTotal,
          qualifiedLeads,
        });
        const flagColor = computeOteFlagColor(
          pctMeta,
          flagBlueThreshold,
          flagYellowMinThreshold,
        );
        const isLeads = result.goal_type === 'leads';
        const hasGoal = Number(result.goal_amount || 0) > 0;
        const profileAny = result.profile as { full_name?: string; is_active?: boolean } | undefined;
        const isInactive = profileAny?.is_active === false;
        return {
          result,
          pctMeta,
          flagColor,
          eligibleTotal,
          qualifiedLeads,
          isLeads,
          isInactive,
          hasGoal,
          variableAmount: Number(result.final_variable_amount || 0),
          fullName: result.profile?.full_name || result.level_name_snapshot || 'Vendedor',
          levelName: result.level_name_snapshot || '-',
          status: statusFromPct(pctMeta, hasGoal),
        };
      });
  }, [results, allRecords, qualifierMap, flagBlueThreshold, flagYellowMinThreshold]);

  // Ranking oficial: sempre por % Meta (maior para menor) para definir podium e posições.
  const ranking = useMemo(
    () => [...rows].sort((a, b) => b.pctMeta - a.pctMeta),
    [rows],
  );
  const positionMap = useMemo(() => {
    const map = new Map<string, number>();
    ranking.forEach((row, idx) => map.set(row.result.id, idx));
    return map;
  }, [ranking]);

  const filteredSorted = useMemo(() => {
    const filtered = ranking.filter((r) => {
      switch (filter) {
        case 'closers':
          return !r.isLeads;
        case 'presales':
          return r.isLeads;
        case 'high':
          return r.status === 'high';
        case 'low':
          return r.status === 'low';
        case 'with_variable':
          return r.variableAmount > 0;
        case 'inactive_with_result':
          return r.isInactive && (r.eligibleTotal > 0 || r.qualifiedLeads > 0);
        case 'all':
        default:
          return true;
      }
    });
    const sorted = [...filtered].sort((a, b) => {
      switch (sortBy) {
        case 'variable':
          return b.variableAmount - a.variableAmount;
        case 'revenue':
          return b.eligibleTotal - a.eligibleTotal;
        case 'leads':
          return b.qualifiedLeads - a.qualifiedLeads;
        case 'name':
          return a.fullName.localeCompare(b.fullName, 'pt-BR');
        case 'pct':
        default:
          return b.pctMeta - a.pctMeta;
      }
    });
    return sorted;
  }, [ranking, filter, sortBy]);

  // Resumo do Campeonato Comercial (somente leitura competitiva — sem
  // duplicar dinheiro com o bloco "Resumo financeiro do OTE").
  const summary = useMemo(() => {
    const highCount = ranking.filter((r) => r.status === 'high').length;
    const midCount = ranking.filter((r) => r.status === 'mid').length;
    const lowCount = ranking.filter((r) => r.status === 'low').length;
    const leader = ranking[0];
    return { highCount, midCount, lowCount, leader, total: ranking.length };
  }, [ranking]);

  const periodLabel = useMemo(() => {
    if (!period) return '—';
    const [yy, mm] = period.split('-').map(Number);
    if (!yy || !mm) return period;
    const months = [
      'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
      'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro',
    ];
    return `${months[mm - 1]} ${yy}`;
  }, [period]);

  const formatPct = (n: number) => n.toFixed(1).replace('.', ',');


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
        <CardContent className="flex flex-col items-center justify-center gap-3 py-16 text-center">
          <div className="rounded-full bg-muted p-4">
            <Trophy className="h-8 w-8 text-muted-foreground" />
          </div>
          <div>
            <h3 className="text-lg font-semibold">Nenhum resultado calculado para este período</h3>
            <p className="mt-1 text-sm text-muted-foreground">
              Calcule o período para gerar ranking, metas, vendas e qualificações.
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  const podium = ranking.slice(0, 3);

  return (
    <div className="space-y-6">
      {/* ===== Faixa compacta: Campeonato Comercial ===== */}
      <Card className="overflow-hidden border-primary/20 bg-gradient-to-br from-primary/5 via-background to-background">
        <CardContent className="p-4">
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div className="flex items-center gap-3">
              <div className="rounded-lg bg-primary/10 p-2">
                <Trophy className="h-5 w-5 text-primary" />
              </div>
              <div>
                <h2 className="text-sm font-semibold leading-tight">Campeonato Comercial</h2>
                <p className="text-xs text-muted-foreground">
                  Ranking do período por atingimento de meta
                </p>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
              <span className="text-foreground/80">{periodLabel}</span>
              <span aria-hidden>·</span>
              <span>
                <span className="font-semibold text-foreground">{summary.total}</span> participantes
              </span>
              {summary.leader && (
                <>
                  <span aria-hidden>·</span>
                  <span>
                    Líder parcial:{' '}
                    <span className="font-semibold text-foreground">
                      {summary.leader.fullName}
                    </span>
                    , {formatPct(summary.leader.pctMeta)}%
                  </span>
                </>
              )}
              {summary.highCount > 0 && (
                <>
                  <span aria-hidden>·</span>
                  <span>
                    <span className="font-semibold text-blue-600 dark:text-blue-400">
                      {summary.highCount}
                    </span>{' '}
                    em alta performance
                  </span>
                </>
              )}
              {summary.midCount > 0 && (
                <>
                  <span aria-hidden>·</span>
                  <span>
                    <span className="font-semibold text-yellow-600 dark:text-yellow-400">
                      {summary.midCount}
                    </span>{' '}
                    em zona de atenção
                  </span>
                </>
              )}
              {summary.lowCount > 0 && (
                <>
                  <span aria-hidden>·</span>
                  <span>
                    <span className="font-semibold text-red-600 dark:text-red-400">
                      {summary.lowCount}
                    </span>{' '}
                    abaixo do mínimo
                  </span>
                </>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* ===== Pódio do mês — somente com 4+ participantes ===== */}
      {ranking.length >= 4 && podium.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <Medal className="h-4 w-4 text-primary" />
            <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
              Pódio do mês
            </h3>
          </div>
          <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
            {podium.map((row, idx) => (
              <PodiumCard key={row.result.id} row={row} idx={idx} />
            ))}
          </div>
        </div>
      )}


      {/* ===== Filtros + Ordenação ===== */}
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div className="flex flex-wrap items-center gap-2">
          {(
            [
              ['all', 'Todos'],
              ['closers', 'Closers'],
              ['presales', 'Pré-vendas'],
              ['high', 'Alta performance'],
              ['low', 'Abaixo do mínimo'],
              ['with_variable', 'Com variável a pagar'],
              ['inactive_with_result', 'Inativos com resultado'],
            ] as [RankFilter, string][]
          ).map(([key, label]) => (
            <Button
              key={key}
              size="sm"
              variant={filter === key ? 'default' : 'outline'}
              onClick={() => setFilter(key)}
              className="h-8 rounded-full px-3 text-xs"
            >
              {label}
            </Button>
          ))}
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground">Ordenar por</span>
          <Select value={sortBy} onValueChange={(v) => setSortBy(v as RankSort)}>
            <SelectTrigger className="h-8 w-[180px] text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="pct">% Meta</SelectItem>
              <SelectItem value="variable">Variável final</SelectItem>
              <SelectItem value="revenue">Receita elegível OTE</SelectItem>
              <SelectItem value="leads">Leads qualificados</SelectItem>
              <SelectItem value="name">Nome</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* ===== Ranking em cards ===== */}
      {filteredSorted.length === 0 ? (
        <Card>
          <CardContent className="py-10 text-center text-sm text-muted-foreground">
            Nenhum vendedor corresponde aos filtros selecionados.
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {filteredSorted.map((row) => {
            const officialIdx = positionMap.get(row.result.id) ?? 0;
            const isLeader = officialIdx === 0;
            return (
              <Card
                key={row.result.id}
                className={cn(
                  'transition-shadow hover:shadow-md',
                  isLeader && 'border-amber-400/50 ring-1 ring-amber-400/30',
                )}
              >
                <Collapsible
                  open={expandedSeller === row.result.id}
                  onOpenChange={() =>
                    setExpandedSeller(
                      expandedSeller === row.result.id ? null : row.result.id,
                    )
                  }
                >
                  <CollapsibleTrigger asChild>
                    <CardHeader className="cursor-pointer transition-colors hover:bg-muted/40">
                      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                        {/* Esquerda: posição + identificação */}
                        <div className="flex items-center gap-4">
                          <div className="flex flex-col items-center justify-center">
                            <div
                              className={cn(
                                'flex h-12 w-12 items-center justify-center rounded-xl border text-base font-bold',
                                isLeader
                                  ? 'border-amber-400/60 bg-amber-500/10 text-amber-600 dark:text-amber-300'
                                  : officialIdx === 1
                                  ? 'border-slate-400/40 bg-slate-500/10 text-slate-600 dark:text-slate-300'
                                  : officialIdx === 2
                                  ? 'border-orange-400/40 bg-orange-500/10 text-orange-600 dark:text-orange-300'
                                  : 'border-border bg-muted text-muted-foreground',
                              )}
                            >
                              {officialIdx + 1}º
                            </div>
                          </div>
                          <div className="space-y-1">
                            <div className="flex flex-wrap items-center gap-2">
                              <CardTitle className="text-base">{row.fullName}</CardTitle>
                              {isLeader && (
                                <Badge className="border-amber-400/50 bg-amber-500/15 text-amber-700 hover:bg-amber-500/15 dark:text-amber-300">
                                  <Crown className="mr-1 h-3 w-3" /> Líder parcial do mês
                                </Badge>
                              )}
                              {row.isInactive && (
                                <Badge variant="outline" className="text-[10px]">
                                  Inativo
                                </Badge>
                              )}
                              <Badge variant="outline" className="text-[10px]">
                                {row.isLeads ? 'Meta em leads' : 'Meta em R$'}
                              </Badge>
                            </div>
                            <p className="text-xs text-muted-foreground">
                              {row.levelName} · {positionLabel(officialIdx)}
                            </p>
                          </div>

                        </div>

                        {/* Centro: % Meta grande + progresso */}
                        <div className="flex-1 lg:max-w-md">
                          <div className="mb-1 flex items-baseline justify-between">
                            <div>
                              <span className="text-2xl font-bold tracking-tight">
                                {row.pctMeta.toFixed(1)}%
                              </span>
                              <span className="ml-1 text-xs text-muted-foreground">da meta</span>
                            </div>
                            <span className="text-xs text-muted-foreground">
                              {row.isLeads
                                ? `${Math.round(row.qualifiedLeads)} de ${Math.round(Number(row.result.goal_amount || 0))} leads`
                                : `${formatCurrency(row.eligibleTotal)} de ${formatCurrency(Number(row.result.goal_amount || 0))}`}
                            </span>
                          </div>
                          <GoalProgressBar pct={row.pctMeta} status={row.status} />
                        </div>

                        {/* Direita: variável + flag + status */}
                        <div className="flex items-center gap-4">
                          <div className="text-right">
                            <p className="text-xs text-muted-foreground">Variável final</p>
                            <p className="text-base font-bold text-primary">
                              {formatCurrency(row.variableAmount)}
                            </p>
                          </div>
                          <Badge
                            variant="outline"
                            className={cn('whitespace-nowrap', statusBadgeClasses(row.status))}
                          >
                            <Flag className="mr-1 h-3 w-3" />
                            {statusLabel(row.status)}
                          </Badge>
                          {expandedSeller === row.result.id ? (
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
                      <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
                        {/* Resultado comercial / Qualificações e Meta */}
                        <div className="space-y-4">
                          <h4 className="flex items-center gap-2 font-semibold">
                            <Target className="h-4 w-4 text-primary" />
                            {row.isLeads ? 'Qualificações e Meta' : 'Resultado comercial'}
                          </h4>
                          <div className="space-y-3">
                            <div className="grid grid-cols-2 gap-4 text-sm">
                              <div>
                                <p className="text-muted-foreground">
                                  {row.isLeads ? 'Meta de leads' : 'Meta'}
                                </p>
                                <p className="font-semibold">
                                  {formatGoalValue(row.result.goal_amount, row.result.goal_type)}
                                </p>
                              </div>
                              <div>
                                <p className="text-muted-foreground">
                                  {row.isLeads ? 'Leads qualificados' : 'Receita elegível OTE'}
                                </p>
                                <p className="font-semibold">
                                  {row.isLeads
                                    ? `${Math.round(row.qualifiedLeads)} leads`
                                    : formatCurrency(row.eligibleTotal)}
                                </p>
                              </div>
                              {!row.isLeads && (
                                <div className="col-span-2">
                                  <p className="text-[11px] text-muted-foreground">
                                    Comissão elegível comercial:{' '}
                                    {formatCurrency(Number(row.result.total_sales || 0))}
                                  </p>
                                </div>
                              )}
                            </div>
                            <div>
                              <div className="mb-1 flex justify-between text-xs">
                                <span className="text-muted-foreground">Progresso da meta</span>
                                <span className="font-medium">{row.pctMeta.toFixed(1)}%</span>
                              </div>
                              <GoalProgressBar pct={row.pctMeta} status={row.status} />
                            </div>
                          </div>
                        </div>

                        {/* Cálculo OTE */}
                        <div className="space-y-4">
                          <h4 className="flex items-center gap-2 font-semibold">
                            <TrendingUp className="h-4 w-4 text-primary" />
                            Cálculo OTE
                          </h4>
                          <div className="space-y-3 text-sm">
                            <div className="flex justify-between">
                              <span className="text-muted-foreground">Multiplicador</span>
                              <span className="font-semibold">{row.result.ote_multiplier}x</span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-muted-foreground">Variável Base</span>
                              <span>{formatCurrency(row.result.base_variable)}</span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-muted-foreground">Ajuste Final</span>
                              <span
                                className={cn(
                                  row.result.final_adjustment_percentage > 0 && 'text-green-600',
                                  row.result.final_adjustment_percentage < 0 && 'text-red-600',
                                )}
                              >
                                {row.result.final_adjustment_percentage > 0 ? '+' : ''}
                                {row.result.final_adjustment_percentage.toFixed(1)}%
                              </span>
                            </div>
                            <div className="flex justify-between border-t pt-2">
                              <span className="font-semibold">Variável Final</span>
                              <span className="font-bold text-primary">
                                {formatCurrency(row.result.final_variable_amount)}
                              </span>
                            </div>
                          </div>
                        </div>

                        {/* Performance / aceleradores */}
                        <div className="space-y-4">
                          <h4 className="flex items-center gap-2 font-semibold">
                            <Zap className="h-4 w-4 text-primary" />
                            Performance
                          </h4>
                          <div className="space-y-3 text-sm">
                            <PerformanceRow
                              icon={<Gamepad2 className="h-4 w-4 text-muted-foreground" />}
                              label="Roleplay"
                              score={row.result.roleplay_score?.toFixed(1) ?? '-'}
                              accel={row.result.roleplay_accelerator}
                            />
                            <PerformanceRow
                              icon={<ClipboardCheck className="h-4 w-4 text-muted-foreground" />}
                              label="CRM"
                              score={`${row.result.crm_completion_score?.toFixed(0) ?? '-'}%`}
                              accel={row.result.crm_accelerator}
                            />
                            <PerformanceRow
                              icon={<Star className="h-4 w-4 text-muted-foreground" />}
                              label="FitScore"
                              score={row.result.fitscore_avg?.toFixed(0) ?? '-'}
                              accel={row.result.fitscore_accelerator}
                            />
                            <div className="flex justify-between border-t pt-2">
                              <span>Total Aceleradores</span>
                              <span className="text-green-600">
                                +{row.result.total_accelerator_percentage}%
                              </span>
                            </div>
                            <div className="flex justify-between">
                              <span>Total Desaceleradores</span>
                              <span className="text-red-600">
                                -{row.result.total_decelerator_percentage}%
                              </span>
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Drill-down: vendas (Closer) ou qualificações (Pré-vendas).
                          Fonte ÚNICA mantida (atribuição histórica). */}
                      <div className="mt-6 border-t pt-4">
                        {row.isLeads ? (
                          period ? (
                            <OTESellerQualifiedLeadsDrilldown
                              userId={row.result.user_id}
                              userName={row.result.profile?.full_name}
                              period={period}
                              expectedCount={row.qualifiedLeads}
                            />
                          ) : (
                            <div className="py-4 text-sm text-muted-foreground">
                              Período não informado para detalhar qualificações.
                            </div>
                          )
                        ) : (
                          <OTESellerSalesDrilldown
                            records={allRecords.filter((rec) => rec.ote_result_id === row.result.id)}
                            kind="sale"
                            loading={recordsLoading}
                          />
                        )}
                      </div>

                      <div className="mt-6 flex items-center justify-end border-t pt-4">
                        <p className="text-xs text-muted-foreground">
                          Calculado em{' '}
                          {new Date(row.result.calculated_at).toLocaleString('pt-BR')}
                        </p>
                      </div>
                    </CardContent>
                  </CollapsibleContent>
                </Collapsible>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}

function SummaryStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0">
      <p className="truncate text-[11px] uppercase tracking-wide text-muted-foreground">
        {label}
      </p>
      <p className="truncate text-sm font-semibold">{value}</p>
    </div>
  );
}

function PodiumCard({ row, idx }: { row: RankRow; idx: number }) {
  const rankAccent =
    idx === 0
      ? 'from-amber-500/15 to-transparent border-amber-400/40'
      : idx === 1
      ? 'from-slate-400/15 to-transparent border-slate-400/30'
      : 'from-orange-500/15 to-transparent border-orange-400/30';
  const metricPrimary = row.isLeads
    ? `${Math.round(row.qualifiedLeads)} de ${Math.round(Number(row.result.goal_amount || 0))} leads`
    : `${formatCurrency(row.eligibleTotal)} de ${formatCurrency(Number(row.result.goal_amount || 0))}`;
  return (
    <Card className={cn('overflow-hidden border bg-gradient-to-br', rankAccent)}>
      <CardContent className="p-4">
        <div className="mb-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <PodiumIcon idx={idx} />
            <span className="text-sm font-semibold">{positionLabel(idx)}</span>
          </div>
          <Badge
            variant="outline"
            className={cn('text-[10px]', statusBadgeClasses(row.status))}
          >
            {statusLabel(row.status)}
          </Badge>
        </div>
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-background/60">
              <User className="h-4 w-4 text-muted-foreground" />
            </div>
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold">{row.fullName}</p>
              <p className="truncate text-[11px] text-muted-foreground">
                {row.levelName}
                {row.isInactive && ' · Inativo'}
              </p>
            </div>
          </div>
        </div>
        <div className="mt-3 space-y-1">
          <div className="flex items-baseline justify-between">
            <span className="text-2xl font-bold">{row.pctMeta.toFixed(1)}%</span>
            <Badge variant="outline" className="text-[10px]">
              {row.isLeads ? 'Meta em leads' : 'Meta em R$'}
            </Badge>
          </div>
          <p className="text-xs text-muted-foreground">{metricPrimary}</p>
          <p className="text-sm">
            Variável final:{' '}
            <span className="font-semibold text-primary">
              {formatCurrency(row.variableAmount)}
            </span>
          </p>
        </div>
      </CardContent>
    </Card>
  );
}

function PerformanceRow({
  icon,
  label,
  score,
  accel,
}: {
  icon: React.ReactNode;
  label: string;
  score: string;
  accel: number;
}) {
  return (
    <div className="flex items-center justify-between">
      <div className="flex items-center gap-2">
        {icon}
        <span>{label}</span>
      </div>
      <div className="text-right">
        <span className="mr-2 text-muted-foreground">{score}</span>
        <span
          className={cn(
            accel > 0 && 'text-green-600',
            accel < 0 && 'text-red-600',
          )}
        >
          {accel > 0 ? '+' : ''}
          {accel}%
        </span>
      </div>
    </div>
  );
}
