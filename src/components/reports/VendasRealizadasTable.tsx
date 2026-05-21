/**
 * P0 SSoT — Tabela read-only de Vendas Realizadas.
 * Fonte: commercial_won_revenue_view.
 */
import { useMemo, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useVendasRealizadas, type VendasRealizadasFilters } from '@/hooks/reports/useVendasRealizadas';
import { useReportFiltersContext } from '@/contexts/ReportFiltersContext';
import { useActiveUsers } from '@/hooks/users/useActiveUsers';
import { useOrganizationPipelines } from '@/hooks/useOrganizationPipelines';

const formatCurrency = (n: number) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(Number(n) || 0);
import { AlertTriangle, ShieldCheck, ShieldAlert } from 'lucide-react';

function fmt(n: number) {
  try {
    return formatCurrency(n);
  } catch {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(n || 0);
  }
}

export function VendasRealizadasTable() {
  const { effectiveDates } = useReportFiltersContext();
  const { data: users } = useActiveUsers();
  const { pipelines } = useOrganizationPipelines();

  const [sellerUserId, setSellerUserId] = useState<string | undefined>(undefined);
  const [pipelineId, setPipelineId] = useState<string | undefined>(undefined);
  const [revenueType, setRevenueType] = useState<'all' | 'one_time' | 'mrr' | 'mixed'>('all');
  const [commissionStatus, setCommissionStatus] = useState<'all' | 'eligible' | 'blocked_review_required' | 'blocked_settlement_pending'>('all');

  const filters: VendasRealizadasFilters = useMemo(
    () => ({
      start: new Date(effectiveDates.startDate).toISOString(),
      end: new Date(effectiveDates.endDate).toISOString(),
      sellerUserId: sellerUserId || null,
      pipelineId: pipelineId || null,
      revenueType,
      commissionStatus,
    }),
    [effectiveDates, sellerUserId, pipelineId, revenueType, commissionStatus],
  );

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
          Fonte oficial: <code className="font-mono">commercial_won_revenue_view</code>. Esta tela é a verdade financeira de vendas realizadas. Outras telas (Dashboard, Forecast, Win/Loss, Comissão) devem reconciliar com este total no mesmo período.
        </AlertDescription>
      </Alert>

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-8 gap-3">
        <KPI label="Receita Total" value={fmt(totals?.commercial_amount ?? 0)} />
        <KPI label="Receita Avulsa" value={fmt(totals?.one_shot_amount ?? 0)} />
        <KPI label="Novo MRR" value={fmt(totals?.mrr_amount ?? 0)} />
        <KPI label="Vendas" value={String(totals?.won_count ?? 0)} />
        <KPI label="Ticket Médio" value={fmt(totals?.avg_ticket ?? 0)} />
        <KPI label="Comissão Elegível" value={fmt(totals?.eligible_commission ?? 0)} variant="success" />
        <KPI label="Comissão em Revisão" value={fmt(totals?.review_commission ?? 0)} variant="warning" />
        <KPI label="Aguardando Settlement" value={fmt(totals?.settlement_pending_commission ?? 0)} variant="warning" />
      </div>


      {/* Filtros */}
      <Card>
        <CardContent className="pt-4 grid grid-cols-1 md:grid-cols-4 gap-3">
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
          <Select value={commissionStatus} onValueChange={(v: any) => setCommissionStatus(v)}>
            <SelectTrigger><SelectValue placeholder="Comissão" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas comissões</SelectItem>
              <SelectItem value="eligible">Elegíveis</SelectItem>
              <SelectItem value="blocked_review_required">Em revisão</SelectItem>
              <SelectItem value="blocked_settlement_pending">Aguardando settlement</SelectItem>

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
                <TableHead className="text-right">Total Comercial</TableHead>
                <TableHead>Comercial</TableHead>
                <TableHead>Operacional</TableHead>
                <TableHead>Settlement</TableHead>
                <TableHead>Comissão</TableHead>
                <TableHead>Confiança</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.length === 0 && (
                <TableRow>
                  <TableCell colSpan={12} className="text-center text-muted-foreground py-8">
                    Nenhuma venda realizada no período.
                  </TableCell>
                </TableRow>
              )}
              {rows.map((r) => (
                <TableRow key={r.opportunity_id}>
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
                  <TableCell className="text-right tabular-nums font-semibold">{fmt(Number(r.commercial_amount) || 0)}</TableCell>
                  <TableCell><CommercialStatusBadge status={r.commercial_status} /></TableCell>
                  <TableCell><FulfillmentBadge status={r.fulfillment_status} /></TableCell>
                  <TableCell><SettlementBadge status={r.financial_settlement_status} /></TableCell>
                  <TableCell><CommissionBadge status={r.commission_status} /></TableCell>
                  <TableCell>
                    <ConfidenceBadge confidence={r.revenue_confidence} reviewRequired={r.review_required} />
                  </TableCell>
                </TableRow>
              ))}

            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}

function KPI({ label, value, variant }: { label: string; value: string; variant?: 'success' | 'warning' }) {
  return (
    <Card>
      <CardContent className="pt-4">
        <div className="text-xs text-muted-foreground">{label}</div>
        <div className={
          'text-lg font-semibold tabular-nums ' +
          (variant === 'success' ? 'text-emerald-600' : variant === 'warning' ? 'text-amber-600' : '')
        }>{value}</div>
      </CardContent>
    </Card>
  );
}

function ConfidenceBadge({ confidence, reviewRequired }: { confidence: string; reviewRequired: boolean }) {
  if (reviewRequired || confidence === 'manual_review') {
    return <Badge variant="destructive" className="gap-1"><ShieldAlert className="h-3 w-3" />Review</Badge>;
  }
  if (confidence === 'warning') {
    return <Badge variant="secondary" className="gap-1"><AlertTriangle className="h-3 w-3" />Warning</Badge>;
  }
  return <Badge variant="outline" className="gap-1"><ShieldCheck className="h-3 w-3" />Trusted</Badge>;
}
