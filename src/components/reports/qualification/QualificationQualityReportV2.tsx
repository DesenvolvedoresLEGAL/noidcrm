// Sprint REL V2.11 — Tela "Qualidade de Qualificação" (SDR → Proposta → Venda)
import { useMemo, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import {
  Target, FileText, AlertTriangle, Trophy, TrendingDown,
  DollarSign, Percent, UserX, ArrowRightLeft,
} from 'lucide-react';
import {
  useQualificationQualityV2,
  QualificationRow, QualificationDrilldownRow,
} from '@/hooks/reports/useQualificationQualityV2';

const fmtMoney = (v: number) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 }).format(v || 0);
const fmtPct = (v: number) => `${(v || 0).toFixed(1)}%`;
const fmtNum = (v: number | null | undefined, suf = '') =>
  v == null ? '—' : `${Math.round(v * 10) / 10}${suf}`;

function ConfidenceBadge({ level }: { level: 'trusted' | 'partial' | 'warning' }) {
  const map = {
    trusted: { label: 'Dados confiáveis', cls: 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20' },
    partial: { label: 'Confiança parcial', cls: 'bg-amber-500/10 text-amber-600 border-amber-500/20' },
    warning: { label: 'Atenção — muitos SQLs sem proposta', cls: 'bg-rose-500/10 text-rose-600 border-rose-500/20' },
  } as const;
  const v = map[level];
  return <Badge variant="outline" className={v.cls}>{v.label}</Badge>;
}

function KpiCard({
  icon: Icon, label, value, sub, accent,
}: { icon: any; label: string; value: string; sub?: string; accent?: string }) {
  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-center gap-3">
          <div className={`p-2 rounded-lg ${accent ?? 'bg-primary/10 text-primary'}`}>
            <Icon className="h-4 w-4" />
          </div>
          <div className="min-w-0">
            <p className="text-xs text-muted-foreground">{label}</p>
            <p className="text-xl font-bold leading-tight">{value}</p>
            {sub && <p className="text-[11px] text-muted-foreground">{sub}</p>}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export function QualificationQualityReportV2() {
  const [proposalStatus, setProposalStatus] = useState<'any' | 'with' | 'without'>('any');
  const [statusFilter, setStatusFilter] = useState<'all' | 'won' | 'lost' | 'open'>('all');
  const [includeRemovedUsers, setIncludeRemovedUsers] = useState(false);
  const [drillSdr, setDrillSdr] = useState<QualificationRow | null>(null);

  const { data, isLoading } = useQualificationQualityV2({
    proposalStatus,
    statusFilter: statusFilter === 'all' ? undefined : [statusFilter],
    includeRemovedUsers,
  });

  const drill = useQualificationQualityV2({
    proposalStatus,
    statusFilter: statusFilter === 'all' ? undefined : [statusFilter],
    includeRemovedUsers,
    sdrUserIds: drillSdr?.sdr_user_id ? [drillSdr.sdr_user_id] : undefined,
    includeDrilldown: !!drillSdr,
  });

  const summary = data?.summary;
  const rows = data?.rows ?? [];

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header + filtros */}
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-2xl font-bold">Qualidade de Qualificação</h2>
          <p className="text-sm text-muted-foreground">
            Mede se o pré-vendas está qualificando bem (SQL → Proposta → Venda).
            Receita usa <strong>valor líquido</strong>, sem vendas canceladas.
          </p>
        </div>
        <div className="flex flex-wrap items-end gap-3">
          {data?.confidence && <ConfidenceBadge level={data.confidence} />}
          <div className="space-y-1">
            <Label className="text-[11px]">Proposta</Label>
            <Select value={proposalStatus} onValueChange={(v: any) => setProposalStatus(v)}>
              <SelectTrigger className="h-9 w-[160px]"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="any">Todas</SelectItem>
                <SelectItem value="with">Com proposta</SelectItem>
                <SelectItem value="without">Sem proposta</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label className="text-[11px]">Status</Label>
            <Select value={statusFilter} onValueChange={(v: any) => setStatusFilter(v)}>
              <SelectTrigger className="h-9 w-[140px]"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos</SelectItem>
                <SelectItem value="won">Ganhos</SelectItem>
                <SelectItem value="lost">Perdidos</SelectItem>
                <SelectItem value="open">Abertos</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-center gap-2 pb-1">
            <Switch id="incRemoved" checked={includeRemovedUsers} onCheckedChange={setIncludeRemovedUsers} />
            <Label htmlFor="incRemoved" className="text-xs">Incluir removidos</Label>
          </div>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <KpiCard icon={Target} label="SQLs qualificados" value={String(summary?.qualified_count ?? 0)} />
        <KpiCard icon={FileText} label="Com proposta" value={String(summary?.with_proposal_count ?? 0)}
                 sub={`Taxa SQL→Proposta ${fmtPct(summary?.sql_to_proposal_rate ?? 0)}`} />
        <KpiCard icon={AlertTriangle} label="Sem proposta" value={String(summary?.without_proposal_count ?? 0)}
                 accent="bg-amber-500/10 text-amber-600" />
        <KpiCard icon={Trophy} label="Ganhos" value={String(summary?.won_count ?? 0)}
                 accent="bg-emerald-500/10 text-emerald-600"
                 sub={`Taxa SQL→Venda ${fmtPct(summary?.sql_to_won_rate ?? 0)}`} />
        <KpiCard icon={TrendingDown} label="Perdidos" value={String(summary?.lost_count ?? 0)}
                 accent="bg-rose-500/10 text-rose-600"
                 sub={`Perda pós-qualif. ${fmtPct(summary?.post_qualification_loss_rate ?? 0)}`} />
        <KpiCard icon={DollarSign} label="Receita válida" value={fmtMoney(summary?.valid_revenue_amount ?? 0)}
                 accent="bg-blue-500/10 text-blue-600" sub="Líquido de cancelamentos" />
        <KpiCard icon={Percent} label="Proposta→Venda" value={fmtPct(summary?.proposal_to_won_rate ?? 0)} />
        <KpiCard icon={ArrowRightLeft} label="Abertos" value={String(summary?.open_count ?? 0)} />
      </div>

      {/* Tabela por SDR */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Por SDR</CardTitle>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>SDR</TableHead>
                <TableHead className="text-right">SQLs</TableHead>
                <TableHead className="text-right">Com proposta</TableHead>
                <TableHead className="text-right">Sem proposta</TableHead>
                <TableHead className="text-right">Ganhos</TableHead>
                <TableHead className="text-right">Perdidos</TableHead>
                <TableHead className="text-right">Abertos</TableHead>
                <TableHead className="text-right">Receita válida</TableHead>
                <TableHead className="text-right">SQL→Prop.</TableHead>
                <TableHead className="text-right">SQL→Venda</TableHead>
                <TableHead className="text-right">Perda pós-qualif.</TableHead>
                <TableHead className="text-right">Tempo→Prop. (h)</TableHead>
                <TableHead className="text-right">Tempo→Fech. (d)</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.length === 0 && (
                <TableRow><TableCell colSpan={13} className="text-center text-muted-foreground py-8">Sem dados no período selecionado.</TableCell></TableRow>
              )}
              {rows.map((r) => (
                <TableRow key={r.sdr_user_id ?? 'null'} className="cursor-pointer hover:bg-muted/40"
                          onClick={() => setDrillSdr(r)}>
                  <TableCell className="font-medium">
                    <div className="flex items-center gap-2">
                      <span>{r.sdr_name}</span>
                      {r.sdr_is_deleted && (
                        <Badge variant="outline" className="bg-muted/60 text-[10px] gap-1">
                          <UserX className="h-3 w-3" /> Removido
                        </Badge>
                      )}
                    </div>
                  </TableCell>
                  <TableCell className="text-right">{r.qualified_count}</TableCell>
                  <TableCell className="text-right">{r.with_proposal_count}</TableCell>
                  <TableCell className="text-right text-amber-600">{r.without_proposal_count}</TableCell>
                  <TableCell className="text-right text-emerald-600">{r.won_count}</TableCell>
                  <TableCell className="text-right text-rose-600">{r.lost_count}</TableCell>
                  <TableCell className="text-right">{r.open_count}</TableCell>
                  <TableCell className="text-right">{fmtMoney(r.valid_revenue_amount)}</TableCell>
                  <TableCell className="text-right">{fmtPct(r.sql_to_proposal_rate)}</TableCell>
                  <TableCell className="text-right">{fmtPct(r.sql_to_won_rate)}</TableCell>
                  <TableCell className="text-right">{fmtPct(r.post_qualification_loss_rate)}</TableCell>
                  <TableCell className="text-right">{fmtNum(r.avg_hours_qualification_to_proposal)}</TableCell>
                  <TableCell className="text-right">{fmtNum(r.avg_days_qualification_to_close)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Drilldown */}
      <Dialog open={!!drillSdr} onOpenChange={(o) => !o && setDrillSdr(null)}>
        <DialogContent className="max-w-6xl">
          <DialogHeader>
            <DialogTitle>
              Leads qualificados — {drillSdr?.sdr_name}
              {drillSdr?.sdr_is_deleted && (
                <Badge variant="outline" className="ml-2 text-[10px]">Removido</Badge>
              )}
            </DialogTitle>
          </DialogHeader>
          <div className="max-h-[70vh] overflow-auto">
            {drill.isLoading ? (
              <div className="flex items-center justify-center h-32">
                <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary" />
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Cliente</TableHead>
                    <TableHead>Oportunidade</TableHead>
                    <TableHead>Qualificação</TableHead>
                    <TableHead>Closer</TableHead>
                    <TableHead>Proposta</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Motivo perda</TableHead>
                    <TableHead className="text-right">Receita válida</TableHead>
                    <TableHead className="text-right">Dias</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {(drill.data?.drilldown ?? []).map((d: QualificationDrilldownRow) => (
                    <TableRow key={d.opportunity_id}>
                      <TableCell className="font-medium">{d.account_name ?? '—'}</TableCell>
                      <TableCell className="max-w-[240px] truncate">{d.opportunity_title ?? '—'}</TableCell>
                      <TableCell className="text-xs">{d.qualified_at ? new Date(d.qualified_at).toLocaleDateString('pt-BR') : '—'}</TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1">
                          <span className="text-sm">{d.closer_name}</span>
                          {d.closer_is_deleted && <Badge variant="outline" className="text-[9px]">Removido</Badge>}
                        </div>
                      </TableCell>
                      <TableCell>
                        {d.has_proposal ? (
                          <Badge variant="outline" className="bg-blue-500/10 text-blue-600 text-[10px]">
                            {d.proposal_number ?? '✓'} {d.proposal_status ? `· ${d.proposal_status}` : ''}
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="bg-amber-500/10 text-amber-600 text-[10px]">Sem proposta</Badge>
                        )}
                      </TableCell>
                      <TableCell>
                        {d.status === 'won' && <Badge className="bg-emerald-500/15 text-emerald-700 text-[10px]">Ganhou</Badge>}
                        {d.status === 'lost' && <Badge className="bg-rose-500/15 text-rose-700 text-[10px]">Perdeu</Badge>}
                        {d.status !== 'won' && d.status !== 'lost' && <Badge variant="outline" className="text-[10px]">Aberto</Badge>}
                        {d.has_cancelled_sale && <Badge variant="outline" className="ml-1 bg-rose-500/10 text-rose-600 text-[9px]">Cancelada</Badge>}
                      </TableCell>
                      <TableCell className="text-xs">{d.loss_reason_name ?? '—'}</TableCell>
                      <TableCell className="text-right">{fmtMoney(d.valid_revenue_amount)}</TableCell>
                      <TableCell className="text-right text-xs">
                        {d.days_qualification_to_close != null
                          ? `${Math.round(d.days_qualification_to_close)}d até fech.`
                          : d.days_since_qualification != null
                            ? `${Math.round(d.days_since_qualification)}d aberto`
                            : '—'}
                      </TableCell>
                    </TableRow>
                  ))}
                  {drill.data?.drilldown?.length === 0 && (
                    <TableRow><TableCell colSpan={9} className="text-center text-muted-foreground py-6">Sem registros.</TableCell></TableRow>
                  )}
                </TableBody>
              </Table>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
