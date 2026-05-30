/**
 * P0 SSoT — Tabela read-only de Vendas Realizadas.
 * Fonte: commercial_won_revenue_view.
 * SPRINT REL V2.10 — Receita Válida vs Aprovada vs Cancelada.
 */
import { useMemo, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  useVendasRealizadas,
  isExcludedFromGoal,
  type VendasRealizadasFilters,
  type VendaRealizadaRow,
  type SaleStatusFilter,
  type FinancialStatusFilter,
} from '@/hooks/reports/useVendasRealizadas';
import { useReportFiltersContext } from '@/contexts/ReportFiltersContext';
import { useActiveUsers } from '@/hooks/users/useActiveUsers';
import { useOrganizationPipelines } from '@/hooks/useOrganizationPipelines';
import { AlertTriangle, ShieldCheck, ShieldAlert, Ban } from 'lucide-react';

const fmt = (n: number) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(Number(n) || 0);

export function VendasRealizadasTable() {
  const { effectiveDates } = useReportFiltersContext();
  const { data: users } = useActiveUsers();
  const { pipelines } = useOrganizationPipelines();

  const [sellerUserId, setSellerUserId] = useState<string | undefined>(undefined);
  const [pipelineId, setPipelineId] = useState<string | undefined>(undefined);
  const [revenueType, setRevenueType] = useState<'all' | 'one_time' | 'mrr' | 'mixed'>('all');
  const [commissionStatus, setCommissionStatus] = useState<
    'all' | 'eligible' | 'blocked_review_required' | 'blocked_settlement_pending' | 'blocked_cancelled'
  >('all');
  const [saleStatus, setSaleStatus] = useState<SaleStatusFilter>('all');
  const [financialStatus, setFinancialStatus] = useState<FinancialStatusFilter>('all');

  const filters: VendasRealizadasFilters = useMemo(() => {
    const start = new Date(`${effectiveDates.startDate}T00:00:00.000Z`).toISOString();
    const end = new Date(`${effectiveDates.endDate}T23:59:59.999Z`).toISOString();
    return {
      start,
      end,
      sellerUserId: sellerUserId || null,
      pipelineId: pipelineId || null,
      revenueType,
      commissionStatus,
      saleStatus,
      financialStatus,
    };
  }, [effectiveDates, sellerUserId, pipelineId, revenueType, commissionStatus, saleStatus, financialStatus]);

  const { data, isLoading, error } = useVendasRealizadas(filters);

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }
  if (error) {
    return (
      <Alert variant="destructive">
        <AlertTriangle className="h-4 w-4" />
        <AlertDescription>Falha ao carregar vendas realizadas: {(error as Error).message}</AlertDescription>
      </Alert>
    );
  }

  const totals = data?.totals;
  const rows = data?.rows ?? [];

  return (
    <div className="space-y-4">
      <Alert>
        <ShieldCheck className="h-4 w-4" />
        <AlertDescription className="text-sm">
          Fonte oficial: <code className="font-mono">commercial_won_revenue_view</code>. Venda aprovada que foi cancelada
          depois NÃO entra em Receita Válida, Meta, Comissão Elegível nem Ticket Médio Válido — mas continua visível na tabela,
          marcada como Cancelada.
        </AlertDescription>
      </Alert>

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-8 gap-3">
        <KPI label="Receita Válida" value={fmt(totals?.valid_revenue_amount ?? 0)} variant="success" highlight />
        <KPI label="Receita Aprovada" value={fmt(totals?.approved_amount ?? 0)} />
        <KPI
          label="Receita Cancelada"
          value={fmt(totals?.cancelled_amount ?? 0)}
          variant={totals && totals.cancelled_amount > 0 ? 'warning' : undefined}
        />
        <KPI label="Receita Liquidada" value={fmt(totals?.liquidated_amount ?? 0)} />
        <KPI label="Vendas Válidas" value={String(totals?.valid_count ?? 0)} />
        <KPI
          label="Vendas Canceladas"
          value={String(totals?.cancelled_count ?? 0)}
          variant={totals && totals.cancelled_count > 0 ? 'warning' : undefined}
        />
        <KPI label="Ticket Médio Válido" value={fmt(totals?.valid_avg_ticket ?? 0)} />
        <KPI label="Comissão Elegível" value={fmt(totals?.eligible_commission ?? 0)} variant="success" />
      </div>

      {/* Filtros */}
      <Card>
        <CardContent className="pt-4 grid grid-cols-1 md:grid-cols-3 lg:grid-cols-6 gap-3">
          <Select value={sellerUserId ?? 'all'} onValueChange={(v) => setSellerUserId(v === 'all' ? undefined : v)}>
            <SelectTrigger><SelectValue placeholder="Vendedor" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos os vendedores</SelectItem>
              {users?.map((u: any) => (
                <SelectItem key={u.id ?? u.user_id} value={u.user_id ?? u.id}>{u.full_name ?? u.name ?? u.email}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={pipelineId ?? 'all'} onValueChange={(v) => setPipelineId(v === 'all' ? undefined : v)}>
            <SelectTrigger><SelectValue placeholder="Pipeline" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos pipelines</SelectItem>
              {pipelines?.map((p: any) => (
                <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={revenueType} onValueChange={(v: any) => setRevenueType(v)}>
            <SelectTrigger><SelectValue placeholder="Tipo de receita" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos tipos</SelectItem>
              <SelectItem value="one_time">Somente Avulsa</SelectItem>
              <SelectItem value="mrr">Somente MRR</SelectItem>
              <SelectItem value="mixed">Mista (Avulsa + MRR)</SelectItem>
            </SelectContent>
          </Select>
          <Select value={saleStatus} onValueChange={(v: any) => setSaleStatus(v)}>
            <SelectTrigger><SelectValue placeholder="Status da Venda" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas as vendas</SelectItem>
              <SelectItem value="valid">Válidas</SelectItem>
              <SelectItem value="cancelled">Canceladas</SelectItem>
              <SelectItem value="review">Em revisão</SelectItem>
            </SelectContent>
          </Select>
          <Select value={financialStatus} onValueChange={(v: any) => setFinancialStatus(v)}>
            <SelectTrigger><SelectValue placeholder="Status Financeiro" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas situações</SelectItem>
              <SelectItem value="settled">Liquidada</SelectItem>
              <SelectItem value="pending">Pendente de Liquidação</SelectItem>
              <SelectItem value="cancelled">Cancelada</SelectItem>
            </SelectContent>
          </Select>
          <Select value={commissionStatus} onValueChange={(v: any) => setCommissionStatus(v)}>
            <SelectTrigger><SelectValue placeholder="Comissão" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas comissões</SelectItem>
              <SelectItem value="eligible">Elegíveis</SelectItem>
              <SelectItem value="blocked_review_required">Em revisão</SelectItem>
              <SelectItem value="blocked_settlement_pending">Pendente</SelectItem>
              <SelectItem value="blocked_cancelled">Bloqueada (cancelada)</SelectItem>
            </SelectContent>
          </Select>
        </CardContent>
      </Card>

      {/* Tabela */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Vendas Realizadas — {rows.length} registros</CardTitle>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Data</TableHead>
                <TableHead>Cliente</TableHead>
                <TableHead>Proposta</TableHead>
                <TableHead>Vendedor</TableHead>
                <TableHead className="text-right">Avulsa</TableHead>
                <TableHead className="text-right">MRR</TableHead>
                <TableHead className="text-right">Aprovado</TableHead>
                <TableHead className="text-right">Receita Válida</TableHead>
                <TableHead>Status Venda</TableHead>
                <TableHead>Status Entrega</TableHead>
                <TableHead>Status Financeiro</TableHead>
                <TableHead>Comissão</TableHead>
                <TableHead>Auditoria</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.length === 0 && (
                <TableRow>
                  <TableCell colSpan={13} className="text-center text-muted-foreground py-8">
                    Nenhuma venda realizada no período.
                  </TableCell>
                </TableRow>
              )}
              {rows.map((r) => {
                const cancelled = r.is_cancelled_sale === true || isExcludedFromGoal(r);
                const approved = Number(r.approved_amount ?? r.commercial_amount) || 0;
                const valid = Number(r.valid_revenue_amount ?? (cancelled ? 0 : approved)) || 0;
                return (
                  <TableRow key={r.opportunity_id} className={cancelled ? 'opacity-80' : ''}>
                    <TableCell className="whitespace-nowrap text-xs">
                      {r.won_at ? new Date(r.won_at).toLocaleDateString('pt-BR') : '—'}
                    </TableCell>
                    <TableCell className="max-w-[220px] truncate" title={r.nome_fantasia || r.account_name || ''}>
                      {r.nome_fantasia || r.account_name || '—'}
                    </TableCell>
                    <TableCell className="font-mono text-xs">{r.proposal_number ?? '—'}</TableCell>
                    <TableCell className="text-sm">{r.seller_name ?? '—'}</TableCell>
                    <TableCell className="text-right tabular-nums">{fmt(Number(r.one_shot_amount) || 0)}</TableCell>
                    <TableCell className="text-right tabular-nums">{fmt(Number(r.mrr_amount) || 0)}</TableCell>
                    <TableCell className={`text-right tabular-nums ${cancelled ? 'line-through text-muted-foreground' : ''}`}>
                      {fmt(approved)}
                    </TableCell>
                    <TableCell className={`text-right tabular-nums font-semibold ${cancelled ? 'text-muted-foreground' : 'text-emerald-700 dark:text-emerald-400'}`}>
                      {fmt(valid)}
                    </TableCell>
                    <TableCell><SaleStatusBadge row={r} /></TableCell>
                    <TableCell><DeliveryStatusBadge row={r} /></TableCell>
                    <TableCell><FinancialStatusBadge row={r} /></TableCell>
                    <TableCell><CommissionBadge row={r} /></TableCell>
                    <TableCell><AuditBadge row={r} /></TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}

function KPI({
  label,
  value,
  variant,
  highlight,
}: {
  label: string;
  value: string;
  variant?: 'success' | 'warning';
  highlight?: boolean;
}) {
  return (
    <Card className={highlight ? 'border-emerald-500/40 bg-emerald-500/5' : ''}>
      <CardContent className="pt-4">
        <div className="text-xs text-muted-foreground">{label}</div>
        <div
          className={
            (highlight ? 'text-xl ' : 'text-lg ') +
            'font-semibold tabular-nums ' +
            (variant === 'success' ? 'text-emerald-600' : variant === 'warning' ? 'text-amber-600' : '')
          }
        >
          {value}
        </div>
      </CardContent>
    </Card>
  );
}

function SaleStatusBadge({ row }: { row: VendaRealizadaRow }) {
  const cancelled = row.is_cancelled_sale === true || isExcludedFromGoal(row);
  if (cancelled) {
    const reason = row.cancellation_reason === 'reopened_lost' ? 'Reaberta como perdida' : 'Cancelada após aprovação';
    return (
      <Badge variant="destructive" className="text-[10px] gap-1" title={reason}>
        <Ban className="h-3 w-3" />
        {row.cancellation_reason === 'reopened_lost' ? 'Reaberta' : 'Cancelada'}
      </Badge>
    );
  }
  if (row.review_required) {
    return <Badge variant="secondary" className="text-[10px]">Em revisão</Badge>;
  }
  return <Badge variant="default" className="text-[10px]">{row.sale_status_label ?? 'Aprovada'}</Badge>;
}

const DELIVERY_LABEL: Record<string, string> = {
  active: 'Em execução',
  completed: 'Entregue',
  cancelled: 'Cancelada',
  removed: 'Removida',
  not_started: 'Pendente',
  not_applicable: 'Não aplicável',
};
function DeliveryStatusBadge({ row }: { row: VendaRealizadaRow }) {
  const s = row.fulfillment_status;
  if (!s) return <span className="text-xs text-muted-foreground">—</span>;
  const label = row.delivery_status_label ?? DELIVERY_LABEL[s] ?? s;
  const variant: any =
    s === 'completed' ? 'default'
    : s === 'active' ? 'secondary'
    : s === 'removed' || s === 'cancelled' ? 'destructive'
    : 'outline';
  return <Badge variant={variant} className="text-[10px]">{label}</Badge>;
}

function FinancialStatusBadge({ row }: { row: VendaRealizadaRow }) {
  const cancelled = row.is_cancelled_sale === true || isExcludedFromGoal(row);
  if (cancelled) return <Badge variant="destructive" className="text-[10px]">Cancelada</Badge>;
  const fs = row.financial_settlement_status;
  if (!fs) return <span className="text-xs text-muted-foreground">—</span>;
  if (fs === 'settled') return <Badge variant="default" className="text-[10px]">Liquidada</Badge>;
  if (fs === 'manual_review') return <Badge variant="destructive" className="text-[10px]">Em revisão</Badge>;
  return <Badge variant="secondary" className="text-[10px]">Pendente de Liquidação</Badge>;
}

function CommissionBadge({ row }: { row: VendaRealizadaRow }) {
  const status = row.commission_status;
  if (!status) return <span className="text-xs text-muted-foreground">—</span>;
  const map: Record<string, { label: string; variant: any }> = {
    eligible: { label: 'Elegível', variant: 'default' },
    blocked_review_required: { label: 'Em revisão', variant: 'destructive' },
    blocked_settlement_pending: { label: 'Pendente', variant: 'secondary' },
    blocked_cancelled: { label: 'Bloqueada', variant: 'destructive' },
  };
  const m = map[status] ?? { label: status, variant: 'outline' };
  return <Badge variant={m.variant} className="text-[10px]">{m.label}</Badge>;
}

function AuditBadge({ row }: { row: VendaRealizadaRow }) {
  if (row.review_required || row.revenue_confidence === 'manual_review') {
    return <Badge variant="destructive" className="gap-1 text-[10px]"><ShieldAlert className="h-3 w-3" />Revisar</Badge>;
  }
  if (row.revenue_confidence === 'warning') {
    return <Badge variant="secondary" className="gap-1 text-[10px]"><AlertTriangle className="h-3 w-3" />Atenção</Badge>;
  }
  return <Badge variant="outline" className="gap-1 text-[10px]"><ShieldCheck className="h-3 w-3" />OK</Badge>;
}
