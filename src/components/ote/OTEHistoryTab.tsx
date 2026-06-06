/**
 * SPRINT OTE 1.7 — Histórico como memória oficial de fechamentos OTE.
 *
 * Estrutura:
 *   1) Filtros temporais
 *   2) Cards de evolução (total pago, melhor mês, maior atingimento, último cálculo)
 *   3) Gráfico "Evolução do valor pago" (ordem cronológica)
 *   4) Gráfico "Atingimento médio por período" (ordem cronológica)
 *   5) Gráfico "Composição da base OTE" (barras agrupadas)
 *   6) Tabela "Fechamentos OTE" (mais recente primeiro) com drawer de detalhe
 *
 * Não altera cálculos, fonte de vendas, fonte de qualificações nem Excel.
 * Fonte: ote_monthly_results + ote_sales_records (snapshots oficiais).
 */
import { useMemo, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Bar,
  BarChart,
  CartesianGrid,
  LabelList,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { format, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import {
  Activity,
  AlertTriangle,
  CalendarClock,
  FileSpreadsheet,
  History,
  Layers,
  LineChart as LineChartIcon,
  MoreHorizontal,
  RefreshCw,
  Trophy,
  Users,
  Wallet,
} from 'lucide-react';
import { toast } from 'sonner';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Tooltip as UITooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { EmptyState } from '@/components/EmptyState';
import { Skeleton } from '@/components/ui/skeleton';
import { supabase } from '@/integrations/supabase/client';
import { useCurrentOrganization } from '@/hooks/useCurrentOrganization';
import { useOTEMonthlyResults, useCalculateOTE, type OTEMonthlyResult } from '@/hooks/useOTEData';
import { useUserRole } from '@/hooks/useUserRole';
import { oteKeys } from '@/lib/query-keys';
import { cn } from '@/lib/utils';

type RangeKey = '3m' | '6m' | 'ytd' | 'lasty' | 'all';

/**
 * Snapshots calculados antes desta data foram gerados em versões anteriores
 * da regra item-a-item / Receita Válida oficial. São marcados como "Legado"
 * e devem ser recalculados para refletir a regra atual.
 */
const RULE_CUTOFF_ISO = '2026-06-01T00:00:00Z';

type SnapshotVersion = 'Atual' | 'Recalculado' | 'Legado' | 'Desatualizado' | 'Manual' | 'Aberto';

interface SalesAgg {
  ote_result_id: string;
  eligible: number;
  nonEligible: number;
  saleTotal: number;
}

interface PeriodRow {
  period: string;
  periodLabel: string;
  periodFull: string;
  sellers: number;
  totalPaid: number;
  // SPRINT OTE 1.7.3 — memória histórica vs recálculo pela regra atual
  originalTotalPaid: number;
  recalculatedTotalPaid: number;
  hasHistorical: boolean;
  hasRecalc: boolean;
  paidDifference: number;
  recalculatedAt: string | null;
  totalGoal: number;
  totalSales: number;
  eligibleOte: number;
  itemsOutOfGoal: number;
  commercialEligible: number;
  avgAchievement: number;
  highCount: number;
  lowCount: number;
  calculatedAt: string | null;
  status: 'Aberto' | 'Calculado' | 'Fechado' | 'Recalculado' | 'Revisado';
  version: SnapshotVersion;
  versionReason: string;
  needsRecalc: boolean;
  results: OTEMonthlyResult[];
}

const fmtBRL = (v: number) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v || 0);
const fmtBRLShort = (v: number) =>
  Math.abs(v) >= 1000 ? `R$ ${(v / 1000).toFixed(0)}k` : `R$ ${Math.round(v)}`;
const fmtPct = (n: number) => `${(n || 0).toFixed(1).replace('.', ',')}%`;
const fmtDateTime = (iso: string | null) =>
  iso ? format(parseISO(iso), "dd/MM/yyyy HH:mm", { locale: ptBR }) : '—';

const monthLabelMap = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro',
];

function periodFullLabel(period: string): string {
  const [y, m] = period.split('-').map(Number);
  if (!y || !m) return period;
  return `${monthLabelMap[m - 1]} ${y}`;
}

/**
 * Classifica a versão do snapshot OTE para o histórico.
 * Não recalcula nada — apenas inspeciona o snapshot persistido vs. heurísticas
 * de consistência (cutoff temporal + split item-a-item presente).
 */
function classifySnapshot(args: {
  calculatedAt: string | null;
  status: PeriodRow['status'];
  commercialEligible: number;
  eligibleOte: number;
  itemsOutOfGoal: number;
  totalPaid: number;
}): { version: SnapshotVersion; reason: string; needsRecalc: boolean } {
  const { calculatedAt, status, commercialEligible, eligibleOte, itemsOutOfGoal, totalPaid } = args;
  if (!calculatedAt) {
    return { version: 'Aberto', reason: 'Período ainda não foi calculado.', needsRecalc: false };
  }
  const hasSplit = eligibleOte > 0.01 || itemsOutOfGoal > 0.01;
  const hasSales = commercialEligible > 0.01;

  // Sem split item-a-item mas com vendas → snapshot anterior à regra atual.
  if (hasSales && !hasSplit) {
    if (totalPaid > 0.01) {
      return {
        version: 'Manual',
        reason: 'Pagamento registrado sem Receita elegível OTE — provavelmente ajuste manual ou snapshot anterior à regra item-a-item. Recalcule para auditar.',
        needsRecalc: true,
      };
    }
    return {
      version: 'Desatualizado',
      reason: 'Snapshot sem split item-a-item. Recalcule o período para gerar Receita elegível OTE e Itens fora da meta.',
      needsRecalc: true,
    };
  }

  // Snapshot antigo (antes da correção oficial da regra).
  if (calculatedAt < RULE_CUTOFF_ISO) {
    return {
      version: 'Legado',
      reason: 'Calculado em versão anterior da regra OTE. Recalcule para alinhar com a Receita Válida oficial.',
      needsRecalc: true,
    };
  }

  return {
    version: status === 'Calculado' ? 'Atual' : 'Recalculado',
    reason: 'Snapshot gerado com a regra atual do OTE.',
    needsRecalc: false,
  };
}


function useAllOTESalesAgg(resultIds: string[]) {
  const { organization } = useCurrentOrganization();
  const ids = useMemo(() => [...resultIds].sort(), [resultIds]);
  return useQuery({
    queryKey: ['ote-history-sales-agg', organization?.id, ids],
    enabled: !!organization?.id && ids.length > 0,
    staleTime: 60_000,
    queryFn: async (): Promise<Map<string, SalesAgg>> => {
      const { data, error } = await supabase
        .from('ote_sales_records')
        .select('ote_result_id, sale_value, commercial_commission_base, eligible_amount, eligible_ote_amount, non_eligible_amount')
        .eq('organization_id', organization!.id)
        .in('ote_result_id', ids);
      if (error) throw error;
      const map = new Map<string, SalesAgg>();
      for (const row of data || []) {
        const key = (row as any).ote_result_id as string;
        const prev = map.get(key) || { ote_result_id: key, eligible: 0, nonEligible: 0, saleTotal: 0 };
        const nonEligible = Number((row as any).non_eligible_amount || 0);
        const eligibleOte = Number((row as any).eligible_ote_amount || 0);
        prev.eligible += eligibleOte > 0 || nonEligible > 0
          ? eligibleOte
          : Number((row as any).eligible_amount || 0);
        prev.nonEligible += nonEligible;
        prev.saleTotal += Number((row as any).commercial_commission_base || 0) > 0
          ? Number((row as any).commercial_commission_base || 0)
          : Number((row as any).sale_value || 0);
        map.set(key, prev);
      }
      return map;
    },
  });
}

function filterByRange(periods: string[], range: RangeKey): string[] {
  if (range === 'all') return periods;
  const today = new Date();
  const cutoff = new Date(today.getFullYear(), today.getMonth(), 1);
  if (range === '3m') cutoff.setMonth(cutoff.getMonth() - 2);
  if (range === '6m') cutoff.setMonth(cutoff.getMonth() - 5);
  if (range === 'ytd') cutoff.setMonth(0);
  if (range === 'lasty') {
    return periods.filter((p) => p.startsWith(String(today.getFullYear() - 1)));
  }
  const cutoffKey = `${cutoff.getFullYear()}-${String(cutoff.getMonth() + 1).padStart(2, '0')}`;
  return periods.filter((p) => p >= cutoffKey);
}

export function OTEHistoryTab() {
  const { loading: isLoadingOrg } = useCurrentOrganization();
  const queryClient = useQueryClient();
  const { data: allResults, isLoading, isPending } = useOTEMonthlyResults();
  const { isAdmin, isManager } = useUserRole();
  const calculateOTE = useCalculateOTE();
  const canRecalc = isAdmin || isManager;
  const [range, setRange] = useState<RangeKey>('6m');
  const [selectedPeriod, setSelectedPeriod] = useState<string | null>(null);

  const resultIds = useMemo(() => (allResults || []).map((r) => r.id), [allResults]);
  const { data: salesAgg } = useAllOTESalesAgg(resultIds);

  const handleRecalc = async (row: PeriodRow) => {
    if (!canRecalc) {
      toast.error('Apenas admin ou gestor pode recalcular um período.');
      return;
    }
    try {
      await calculateOTE.mutateAsync({ periodMonth: row.period, suppressToast: true });
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: oteKeys.monthlyResultsAll() }),
        queryClient.invalidateQueries({ queryKey: ['ote-history-sales-agg'] }),
        queryClient.invalidateQueries({ queryKey: ['ote-sales-records'] }),
      ]);
      toast.success(`${row.periodFull} recalculado com sucesso.`);
    } catch (error) {
      console.error('[OTEHistoryTab] Recalculation failed:', error);
      toast.error(`Não foi possível recalcular ${row.periodFull}. Verifique logs do cálculo OTE.`);
    }
  };

  const handleExport = (row: PeriodRow) => {
    toast.info('Exportação Excel disponível na Visão Geral. Selecione o período correspondente para gerar a planilha completa.');
    void row;
  };

  const allRows = useMemo<PeriodRow[]>(() => {
    if (!allResults || allResults.length === 0) return [];
    const byPeriod = new Map<string, OTEMonthlyResult[]>();
    for (const r of allResults) {
      const arr = byPeriod.get(r.period_month) || [];
      arr.push(r);
      byPeriod.set(r.period_month, arr);
    }
    const rows: PeriodRow[] = [];
    for (const [period, items] of byPeriod.entries()) {
      const individuals = items.filter((r) => !r.is_team_target);
      let totalPaid = 0;
      let totalGoal = 0;
      let totalSales = 0;
      let achievementSum = 0;
      let highCount = 0;
      let lowCount = 0;
      let calculatedAt: string | null = null;
      let eligibleOte = 0;
      let nonElig = 0;
      let saleSum = 0;
      let originalSum = 0;
      let recalcSum = 0;
      let hasHistorical = false;
      let hasRecalc = false;
      let recalculatedAt: string | null = null;

      for (const r of items) {
        const current = Number(r.final_variable_amount || 0);
        totalPaid += current;
        const orig = r.original_total_paid != null ? Number(r.original_total_paid) : null;
        const rec = r.recalculated_total_paid != null ? Number(r.recalculated_total_paid) : null;
        if (orig != null) {
          originalSum += orig;
          hasHistorical = true;
        } else {
          // sem original registrado: o atual é o histórico
          originalSum += current;
        }
        if (rec != null) {
          recalcSum += rec;
          hasRecalc = true;
        }
        if (r.recalculated_at && (!recalculatedAt || r.recalculated_at > recalculatedAt)) {
          recalculatedAt = r.recalculated_at;
        }
        const agg = salesAgg?.get(r.id);
        if (agg) {
          eligibleOte += agg.eligible;
          nonElig += agg.nonEligible;
          saleSum += agg.saleTotal;
        }
        if (r.calculated_at) {
          if (!calculatedAt || r.calculated_at > calculatedAt) calculatedAt = r.calculated_at;
        }
      }
      for (const r of individuals) {
        totalGoal += Number(r.goal_amount || 0);
        totalSales += Number(r.total_sales || 0);
        const pct = Number(r.achievement_percentage || 0);
        achievementSum += pct;
        if (pct >= 100) highCount += 1;
        if (pct < 50) lowCount += 1;
      }

      const status: PeriodRow['status'] = calculatedAt ? 'Calculado' : 'Aberto';
      const { version, reason, needsRecalc } = classifySnapshot({
        calculatedAt,
        status,
        commercialEligible: saleSum,
        eligibleOte,
        itemsOutOfGoal: nonElig,
        totalPaid,
      });

      rows.push({
        period,
        periodLabel: format(parseISO(period + '-01'), 'MMM/yy', { locale: ptBR }),
        periodFull: periodFullLabel(period),
        sellers: individuals.length,
        totalPaid,
        originalTotalPaid: originalSum,
        recalculatedTotalPaid: recalcSum,
        hasHistorical,
        hasRecalc,
        paidDifference: hasRecalc && hasHistorical ? recalcSum - originalSum : 0,
        recalculatedAt,
        totalGoal,
        totalSales,
        eligibleOte,
        itemsOutOfGoal: nonElig,
        commercialEligible: saleSum,
        avgAchievement: individuals.length > 0 ? achievementSum / individuals.length : 0,
        highCount,
        lowCount,
        calculatedAt,
        status,
        version,
        versionReason: reason,
        needsRecalc,
        results: items,
      });
    }
    return rows.sort((a, b) => a.period.localeCompare(b.period));
  }, [allResults, salesAgg]);

  const visiblePeriods = useMemo(
    () => filterByRange(allRows.map((r) => r.period), range),
    [allRows, range],
  );
  const visibleRows = useMemo(
    () => allRows.filter((r) => visiblePeriods.includes(r.period)),
    [allRows, visiblePeriods],
  );

  const chartRows = visibleRows; // ascending — chronological
  const tableRows = [...visibleRows].reverse(); // newest first

  const summary = useMemo(() => {
    if (visibleRows.length === 0) {
      return { totalPaid: 0, bestMonth: null as PeriodRow | null, bestAchieve: null as PeriodRow | null, lastCalc: null as string | null };
    }
    const totalPaid = visibleRows.reduce((s, r) => s + r.totalPaid, 0);
    const bestMonth = visibleRows.reduce((b, r) => (r.totalPaid > (b?.totalPaid ?? -1) ? r : b), null as PeriodRow | null);
    const bestAchieve = visibleRows.reduce((b, r) => (r.avgAchievement > (b?.avgAchievement ?? -1) ? r : b), null as PeriodRow | null);
    const lastCalc = visibleRows.reduce<string | null>((acc, r) => {
      if (!r.calculatedAt) return acc;
      if (!acc || r.calculatedAt > acc) return r.calculatedAt;
      return acc;
    }, null);
    return { totalPaid, bestMonth, bestAchieve, lastCalc };
  }, [visibleRows]);

  const selectedRow = selectedPeriod ? allRows.find((r) => r.period === selectedPeriod) ?? null : null;

  if (isLoading || isLoadingOrg || isPending) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-28 w-full" />
        <Skeleton className="h-64 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  if (allRows.length === 0) {
    return (
      <EmptyState
        icon={History}
        title="Nenhum cálculo OTE encontrado"
        description="Calcule um período na Visão Geral para gerar o histórico de remuneração variável."
      />
    );
  }

  return (
    <div className="space-y-6">
      {/* Filtros */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="text-sm text-muted-foreground">
          Memória oficial dos fechamentos OTE. Dados vêm dos snapshots persistidos por período.
        </div>
        <Select value={range} onValueChange={(v) => setRange(v as RangeKey)}>
          <SelectTrigger className="w-[200px]">
            <SelectValue placeholder="Período" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="3m">Últimos 3 meses</SelectItem>
            <SelectItem value="6m">Últimos 6 meses</SelectItem>
            <SelectItem value="ytd">Ano atual</SelectItem>
            <SelectItem value="lasty">Ano anterior</SelectItem>
            <SelectItem value="all">Todo o histórico</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Cards de evolução */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <SummaryCard
          icon={Wallet}
          label="Total pago no período analisado"
          value={fmtBRL(summary.totalPaid)}
          hint={`${visibleRows.length} ${visibleRows.length === 1 ? 'mês' : 'meses'} na janela`}
        />
        <SummaryCard
          icon={Trophy}
          label="Melhor mês"
          value={summary.bestMonth ? summary.bestMonth.periodFull : '—'}
          hint={summary.bestMonth ? fmtBRL(summary.bestMonth.totalPaid) : 'Sem dados'}
        />
        <SummaryCard
          icon={Activity}
          label="Maior atingimento médio"
          value={summary.bestAchieve ? summary.bestAchieve.periodFull : '—'}
          hint={summary.bestAchieve ? fmtPct(summary.bestAchieve.avgAchievement) : 'Sem dados'}
        />
        <SummaryCard
          icon={CalendarClock}
          label="Último cálculo"
          value={fmtDateTime(summary.lastCalc)}
          hint={summary.lastCalc ? 'Snapshot mais recente' : 'Nenhum cálculo registrado'}
        />
      </div>

      {/* Evolução do valor pago */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <LineChartIcon className="h-5 w-5 text-primary" />
            Evolução do valor pago
          </CardTitle>
          <p className="text-xs text-muted-foreground">
            Meses sem barra representam R$ 0,00 pago.
          </p>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={chartRows} margin={{ top: 20, right: 16, left: 0, bottom: 8 }}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
              <XAxis dataKey="periodLabel" fontSize={12} />
              <YAxis tickFormatter={fmtBRLShort} fontSize={12} />
              <Tooltip
                content={({ active, payload }) => {
                  if (!active || !payload?.length) return null;
                  const r = payload[0].payload as PeriodRow;
                  return (
                    <div className="rounded-md border bg-popover px-3 py-2 text-xs shadow-md">
                      <div className="font-medium">{r.periodFull}</div>
                      <div className="mt-1 text-muted-foreground">
                        Total pago: <span className="text-foreground font-medium">{fmtBRL(r.totalPaid)}</span>
                      </div>
                      <div className="text-muted-foreground">
                        Vendedores no cálculo: {r.sellers}
                      </div>
                      <div className="text-muted-foreground">Versão: {r.version}</div>
                    </div>
                  );
                }}
              />
              <Bar dataKey="totalPaid" fill="hsl(var(--primary))" radius={[6, 6, 0, 0]}>
                <LabelList
                  dataKey="totalPaid"
                  position="top"
                  fontSize={11}
                  formatter={(v: number) => (v > 0 ? fmtBRLShort(v) : 'R$ 0,00')}
                  className="fill-muted-foreground"
                />
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* Atingimento médio por período */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Activity className="h-5 w-5 text-primary" />
            Atingimento médio por período
          </CardTitle>
          <p className="text-xs text-muted-foreground">
            % médio de meta dos participantes (todos os vendedores no cálculo).
          </p>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={260}>
            <LineChart data={chartRows} margin={{ top: 8, right: 16, left: 0, bottom: 8 }}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
              <XAxis dataKey="periodLabel" fontSize={12} />
              <YAxis tickFormatter={(v) => `${v.toFixed(0)}%`} fontSize={12} />
              <Tooltip
                content={({ active, payload }) => {
                  if (!active || !payload?.length) return null;
                  const r = payload[0].payload as PeriodRow;
                  return (
                    <div className="rounded-md border bg-popover px-3 py-2 text-xs shadow-md">
                      <div className="font-medium">{r.periodFull}</div>
                      <div className="mt-1 text-muted-foreground">
                        % médio: <span className="text-foreground font-medium">{fmtPct(r.avgAchievement)}</span>
                      </div>
                      <div className="text-emerald-600">Alta performance: {r.highCount}</div>
                      <div className="text-amber-600">Abaixo do mínimo: {r.lowCount}</div>
                      <div className="text-muted-foreground">Vendedores no cálculo: {r.sellers}</div>
                    </div>
                  );
                }}
              />
              <Line
                type="monotone"
                dataKey="avgAchievement"
                name="% médio de meta dos participantes"
                stroke="hsl(var(--primary))"
                strokeWidth={2}
                dot={{ fill: 'hsl(var(--primary))', r: 3 }}
              />
            </LineChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* Composição da base OTE */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Layers className="h-5 w-5 text-primary" />
            Composição da base OTE
          </CardTitle>
          <p className="text-xs text-muted-foreground">
            Comissão elegível comercial × Receita elegível OTE × Itens fora da meta por período.
          </p>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={chartRows} margin={{ top: 8, right: 16, left: 0, bottom: 8 }}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
              <XAxis dataKey="periodLabel" fontSize={12} />
              <YAxis tickFormatter={fmtBRLShort} fontSize={12} />
              <Tooltip
                formatter={(value: number, name) => [fmtBRL(value), name as string]}
                labelFormatter={(_, p) => (p?.[0]?.payload as PeriodRow)?.periodFull ?? ''}
              />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              <Bar dataKey="commercialEligible" name="Comissão elegível comercial" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
              <Bar dataKey="eligibleOte" name="Receita elegível OTE" fill="hsl(var(--chart-2, var(--primary)))" fillOpacity={0.7} radius={[4, 4, 0, 0]} />
              <Bar dataKey="itemsOutOfGoal" name="Itens fora da meta" fill="hsl(38 92% 50%)" fillOpacity={0.75} radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* Tabela Fechamentos OTE */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Fechamentos OTE</CardTitle>
          <p className="text-xs text-muted-foreground">
            Mais recente primeiro. Clique em "Ver detalhe" para abrir a auditoria do mês.
          </p>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-muted-foreground">
                <th className="text-left py-3 px-2 font-medium">Período</th>
                <th className="text-left py-3 px-2 font-medium">Status</th>
                <th className="text-left py-3 px-2 font-medium">Versão / Origem</th>
                <th className="text-left py-3 px-2 font-medium">Calculado em</th>
                <th className="text-right py-3 px-2 font-medium">Vendedores</th>
                <th className="text-right py-3 px-2 font-medium">Comissão elegível comercial</th>
                <th className="text-right py-3 px-2 font-medium">Receita elegível OTE</th>
                <th className="text-right py-3 px-2 font-medium">Itens fora da meta</th>
                <th className="text-right py-3 px-2 font-medium">% médio de meta</th>
                <th className="text-right py-3 px-2 font-medium">Total pago</th>
                <th className="text-right py-3 px-2 font-medium">Ações</th>
              </tr>
            </thead>
            <tbody>
              {tableRows.map((row) => (
                <tr key={row.period} className={cn('border-b hover:bg-muted/40', row.needsRecalc && 'bg-destructive/[0.03]')}>
                  <td className="py-3 px-2 font-medium">{row.periodFull}</td>
                  <td className="py-3 px-2">
                    <Badge variant={row.status === 'Calculado' ? 'secondary' : 'outline'}>
                      {row.status}
                    </Badge>
                  </td>
                  <td className="py-3 px-2">
                    <VersionBadge row={row} />
                  </td>
                  <td className="py-3 px-2 text-muted-foreground">{fmtDateTime(row.calculatedAt)}</td>
                  <td className="py-3 px-2 text-right">{row.sellers}</td>
                  <td className="py-3 px-2 text-right">{fmtBRL(row.commercialEligible)}</td>
                  <td className="py-3 px-2 text-right">{fmtBRL(row.eligibleOte)}</td>
                  <td className="py-3 px-2 text-right text-muted-foreground">{fmtBRL(row.itemsOutOfGoal)}</td>
                  <td className="py-3 px-2 text-right">{fmtPct(row.avgAchievement)}</td>
                  <td className="py-3 px-2 text-right font-semibold text-primary">{fmtBRL(row.totalPaid)}</td>
                  <td className="py-3 px-2 text-right">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="sm" aria-label="Ações do período">
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="w-52">
                        <DropdownMenuLabel>{row.periodFull}</DropdownMenuLabel>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem onClick={() => setSelectedPeriod(row.period)}>
                          <History className="h-4 w-4 mr-2" /> Ver detalhe
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => handleExport(row)}>
                          <FileSpreadsheet className="h-4 w-4 mr-2" /> Exportar Excel
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem
                          onClick={() => handleRecalc(row)}
                          disabled={!canRecalc || calculateOTE.isPending}
                        >
                          <RefreshCw className={cn('h-4 w-4 mr-2', calculateOTE.isPending && 'animate-spin')} />
                          Recalcular período
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </CardContent>
      </Card>

      <PeriodDetailDrawer
        row={selectedRow}
        open={!!selectedRow}
        onClose={() => setSelectedPeriod(null)}
      />
    </div>
  );
}

interface SummaryCardProps {
  icon: typeof Wallet;
  label: string;
  value: string;
  hint: string;
}
function SummaryCard({ icon: Icon, label, value, hint }: SummaryCardProps) {
  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-center justify-between">
          <p className="text-xs text-muted-foreground uppercase tracking-wide">{label}</p>
          <Icon className="h-4 w-4 text-muted-foreground" />
        </div>
        <p className="text-xl font-semibold mt-2 truncate">{value}</p>
        <p className="text-xs text-muted-foreground mt-1">{hint}</p>
      </CardContent>
    </Card>
  );
}

function PeriodDetailDrawer({
  row,
  open,
  onClose,
}: {
  row: PeriodRow | null;
  open: boolean;
  onClose: () => void;
}) {
  if (!row) return null;
  const ranking = [...row.results]
    .filter((r) => !r.is_team_target)
    .sort((a, b) => Number(b.achievement_percentage || 0) - Number(a.achievement_percentage || 0));
  const closers = ranking.filter((r) => (r.goal_type || 'revenue') === 'revenue');
  const preSales = ranking.filter((r) => r.goal_type === 'leads');

  return (
    <Sheet open={open} onOpenChange={(v) => (!v ? onClose() : null)}>
      <SheetContent side="right" className="w-full sm:max-w-xl overflow-y-auto">
        <SheetHeader>
          <SheetTitle>{row.periodFull}</SheetTitle>
          <SheetDescription>
            Detalhe auditável do fechamento OTE deste período.
          </SheetDescription>
        </SheetHeader>

        <div className="space-y-4 mt-6">
          {row.needsRecalc && (
            <div className="rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-xs text-destructive flex gap-2">
              <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />
              <div>
                <p className="font-medium">Snapshot desatualizado</p>
                <p className="mt-0.5 text-destructive/80">{row.versionReason}</p>
              </div>
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <MiniStat label="Total pago" value={fmtBRL(row.totalPaid)} highlight />
            <MiniStat label="% médio de meta" value={fmtPct(row.avgAchievement)} />
            <MiniStat label="Comissão elegível comercial" value={fmtBRL(row.commercialEligible)} />
            <MiniStat label="Receita elegível OTE" value={fmtBRL(row.eligibleOte)} />
            <MiniStat label="Itens fora da meta" value={fmtBRL(row.itemsOutOfGoal)} />
            <MiniStat label="Vendedores no cálculo" value={String(row.sellers)} />
          </div>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-2">
                <Trophy className="h-4 w-4 text-primary" /> Ranking
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 pt-0">
              <RankingSection title="Closers" items={closers} />
              <RankingSection title="Pré vendas" items={preSales} />
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-2">
                <Users className="h-4 w-4 text-primary" /> Auditoria
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-0 text-xs text-muted-foreground space-y-1">
              <p className="flex items-center gap-2">
                <span className="text-foreground font-medium">Versão do cálculo:</span>
                <VersionBadge row={row} />
              </p>
              <p><span className="text-foreground font-medium">Status do snapshot:</span> {row.status}</p>
              <p><span className="text-foreground font-medium">Calculado em:</span> {fmtDateTime(row.calculatedAt)}</p>
              <p><span className="text-foreground font-medium">Fonte das vendas:</span> Relatório Vendas Realizadas (ote_sales_records).</p>
              <p><span className="text-foreground font-medium">Fonte das qualificações:</span> historicalQualifications (responsável histórico no momento da qualificação).</p>
              <p>Resultados históricos usam o responsável histórico, não o owner atual.</p>
            </CardContent>
          </Card>
        </div>
      </SheetContent>
    </Sheet>
  );
}

function MiniStat({
  label,
  value,
  highlight,
  warn,
}: {
  label: string;
  value: string;
  highlight?: boolean;
  warn?: boolean;
}) {
  return (
    <div className={cn(
      'rounded-md border p-3',
      highlight && 'border-primary/40 bg-primary/5',
      warn && 'border-destructive/30 bg-destructive/5',
    )}>
      <p className="text-[11px] text-muted-foreground uppercase tracking-wide">{label}</p>
      <p className={cn(
        'text-sm font-semibold mt-1',
        highlight && 'text-primary',
        warn && 'text-destructive',
      )}>{value}</p>
    </div>
  );
}

function RankingSection({ title, items }: { title: string; items: OTEMonthlyResult[] }) {
  if (items.length === 0) {
    return (
      <div>
        <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1">{title}</p>
        <p className="text-xs text-muted-foreground">Sem participantes neste período.</p>
      </div>
    );
  }
  return (
    <div>
      <p className="text-xs text-muted-foreground uppercase tracking-wide mb-2">{title}</p>
      <ul className="space-y-1">
        {items.map((r, idx) => (
          <li key={r.id} className="flex items-center justify-between text-sm border-b last:border-0 py-1.5">
            <span className="truncate">
              <span className="text-muted-foreground mr-2">{idx + 1}º</span>
              {r.profile?.full_name || 'Usuário'}
            </span>
            <span className="flex items-center gap-3 shrink-0">
              <span className="text-muted-foreground">{fmtPct(Number(r.achievement_percentage || 0))}</span>
              <span className="font-medium">{fmtBRL(Number(r.final_variable_amount || 0))}</span>
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

const VERSION_STYLES: Record<SnapshotVersion, { label: string; className: string }> = {
  Atual:         { label: 'Atual',         className: 'bg-emerald-500/10 text-emerald-700 border-emerald-500/30 dark:text-emerald-400' },
  Recalculado:   { label: 'Recalculado',   className: 'bg-emerald-500/10 text-emerald-700 border-emerald-500/30 dark:text-emerald-400' },
  Legado:        { label: 'Legado',        className: 'bg-amber-500/10 text-amber-700 border-amber-500/30 dark:text-amber-400' },
  Desatualizado: { label: 'Snapshot desatualizado', className: 'bg-destructive/10 text-destructive border-destructive/30' },
  Manual:        { label: 'Manual',        className: 'bg-amber-500/10 text-amber-700 border-amber-500/30 dark:text-amber-400' },
  Aberto:        { label: 'Aberto',        className: 'bg-muted text-muted-foreground border-border' },
};

function VersionBadge({ row }: { row: PeriodRow }) {
  const cfg = VERSION_STYLES[row.version];
  return (
    <TooltipProvider delayDuration={150}>
      <UITooltip>
        <TooltipTrigger asChild>
          <span
            className={cn(
              'inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-medium cursor-help',
              cfg.className,
            )}
          >
            {row.needsRecalc && <AlertTriangle className="h-3 w-3" />}
            {cfg.label}
          </span>
        </TooltipTrigger>
        <TooltipContent className="max-w-xs text-xs">
          {row.needsRecalc
            ? 'Este fechamento foi calculado antes da regra atual do OTE. Recalcule o período para atualizar Comissão elegível comercial, Receita elegível OTE e Itens fora da meta.'
            : row.versionReason}
        </TooltipContent>
      </UITooltip>
    </TooltipProvider>
  );
}
