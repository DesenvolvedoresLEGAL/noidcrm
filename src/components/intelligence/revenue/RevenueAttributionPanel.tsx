import { useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { DollarSign, Download, RefreshCw, TrendingUp, Target, FileText, CheckCircle2 } from "lucide-react";
import { useRevenueAttributions, useSyncAttribution } from "@/hooks/intelligence/useRevenueAttribution";
import {
  computeKpis,
  rank,
  toCsv,
  type AttributionFilters,
  type AttributionStatus,
  type RankRow,
} from "@/services/intelligence/revenueAttribution";
import { RevenueSsotBanner } from "@/components/revenue/RevenueSsotBanner";

const STATUS_OPTIONS: { value: AttributionStatus; label: string }[] = [
  { value: "promoted_to_crm", label: "Promovido ao CRM" },
  { value: "opportunity_open", label: "Em oportunidade" },
  { value: "proposal_created", label: "Proposta criada" },
  { value: "proposal_sent", label: "Proposta enviada" },
  { value: "proposal_viewed", label: "Proposta visualizada" },
  { value: "won", label: "Ganho" },
  { value: "lost", label: "Perdido" },
  { value: "cancelled", label: "Cancelado" },
];

function fmtBRL(v: number) {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 }).format(v || 0);
}
function fmtPct(v: number) {
  return `${(v * 100).toFixed(1)}%`;
}

import { PremiumKpi, ModuleHeader, TableSkeleton, PremiumEmpty } from "@/components/intelligence/kairos/premium";
import { LineChart } from "lucide-react";

function RankTable({ title, rows, keyLabel }: { title: string; rows: RankRow[]; keyLabel: string }) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm">{title}</CardTitle>
      </CardHeader>
      <CardContent className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{keyLabel}</TableHead>
              <TableHead className="text-right">Atribuições</TableHead>
              <TableHead className="text-right">Propostas</TableHead>
              <TableHead className="text-right">Enviadas</TableHead>
              <TableHead className="text-right">Vendas</TableHead>
              <TableHead className="text-right">Receita válida</TableHead>
              <TableHead className="text-right">Ticket médio</TableHead>
              <TableHead className="text-right">Conversão</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.length === 0 ? (
              <TableRow>
                <TableCell colSpan={8} className="text-center text-muted-foreground text-xs py-6">
                  Sem dados no período selecionado.
                </TableCell>
              </TableRow>
            ) : rows.slice(0, 20).map((r) => (
              <TableRow key={r.key}>
                <TableCell className="font-medium">{r.label || "—"}</TableCell>
                <TableCell className="text-right">{r.attributions}</TableCell>
                <TableCell className="text-right">{r.proposals}</TableCell>
                <TableCell className="text-right">{r.proposals_sent}</TableCell>
                <TableCell className="text-right">{r.won}</TableCell>
                <TableCell className="text-right">{fmtBRL(r.valid_revenue)}</TableCell>
                <TableCell className="text-right">{fmtBRL(r.avg_ticket)}</TableCell>
                <TableCell className="text-right">{fmtPct(r.conversion)}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}

export function RevenueAttributionPanel() {
  const [filters, setFilters] = useState<AttributionFilters>({});
  const { data: rows = [], isLoading } = useRevenueAttributions(filters);
  const sync = useSyncAttribution();

  const kpis = useMemo(() => computeKpis(rows), [rows]);
  const byEvent = useMemo(() => rank(rows, "event_name", "Sem evento"), [rows]);
  const byIcp = useMemo(() => rank(rows, "icp_cluster_name", "Sem ICP"), [rows]);
  const byBatch = useMemo(() => rank(rows, "batch_run_id", "Sem batch"), [rows]);
  const byDept = useMemo(() => rank(rows, "primary_contact_department", "Sem departamento"), [rows]);
  const bySdr = useMemo(() => rank(rows, "sdr_id", "Sem SDR"), [rows]);

  const downloadCsv = () => {
    const blob = new Blob([toCsv(rows)], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `kairos-revenue-attribution-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-4">
      <RevenueSsotBanner surface="Kairós · Revenue Attribution" />

      {/* Filters */}
      <Card>
        <CardContent className="p-4 flex flex-wrap items-end gap-3">
          <div className="space-y-1">
            <label className="text-[11px] text-muted-foreground">De</label>
            <Input
              type="date"
              className="h-9"
              value={filters.start?.slice(0, 10) ?? ""}
              onChange={(e) => setFilters((f) => ({ ...f, start: e.target.value ? `${e.target.value}T00:00:00Z` : undefined }))}
            />
          </div>
          <div className="space-y-1">
            <label className="text-[11px] text-muted-foreground">Até</label>
            <Input
              type="date"
              className="h-9"
              value={filters.end?.slice(0, 10) ?? ""}
              onChange={(e) => setFilters((f) => ({ ...f, end: e.target.value ? `${e.target.value}T23:59:59Z` : undefined }))}
            />
          </div>
          <div className="space-y-1 min-w-[180px]">
            <label className="text-[11px] text-muted-foreground">Status</label>
            <Select
              value={filters.status ?? "all"}
              onValueChange={(v) => setFilters((f) => ({ ...f, status: v === "all" ? undefined : (v as AttributionStatus) }))}
            >
              <SelectTrigger className="h-9"><SelectValue placeholder="Todos" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos</SelectItem>
                {STATUS_OPTIONS.map((o) => (
                  <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="ml-auto flex gap-2">
            <Button variant="outline" size="sm" onClick={() => sync.mutate(undefined)} disabled={sync.isPending}>
              <RefreshCw className={`h-3.5 w-3.5 mr-1 ${sync.isPending ? "animate-spin" : ""}`} />
              Reconciliar
            </Button>
            <Button variant="outline" size="sm" onClick={downloadCsv} disabled={rows.length === 0}>
              <Download className="h-3.5 w-3.5 mr-1" />
              CSV
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <KpiCard icon={DollarSign} label="Receita atribuída" value={fmtBRL(kpis.revenue_total)} hint="commercial_won_revenue_view" />
        <KpiCard icon={CheckCircle2} label="Receita válida" value={fmtBRL(kpis.valid_revenue_total)} hint="líquido de cancelamentos" />
        <KpiCard icon={Target} label="Vendas ganhas" value={String(kpis.won)} hint={`${fmtPct(kpis.conversion_rate)} de conversão`} />
        <KpiCard icon={TrendingUp} label="Ticket médio" value={fmtBRL(kpis.avg_ticket)} />
      </div>

      {/* Funnel */}
      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-sm">Funil Kairós</CardTitle></CardHeader>
        <CardContent className="grid grid-cols-2 md:grid-cols-6 gap-2 text-xs">
          {[
            { label: "Atribuições", value: kpis.attributions },
            { label: "Em oportunidade", value: kpis.opportunities_open },
            { label: "Propostas", value: kpis.proposals_created },
            { label: "Enviadas", value: kpis.proposals_sent },
            { label: "Visualizadas", value: kpis.proposals_viewed },
            { label: "Ganhas", value: kpis.won },
          ].map((s) => (
            <div key={s.label} className="rounded-md border bg-muted/30 p-3">
              <div className="text-muted-foreground">{s.label}</div>
              <div className="text-lg font-semibold">{s.value}</div>
            </div>
          ))}
        </CardContent>
      </Card>

      {/* Rankings */}
      <Tabs defaultValue="event">
        <TabsList className="grid grid-cols-2 md:grid-cols-5 max-w-3xl">
          <TabsTrigger value="event">Por evento</TabsTrigger>
          <TabsTrigger value="icp">Por ICP</TabsTrigger>
          <TabsTrigger value="batch">Por batch</TabsTrigger>
          <TabsTrigger value="dept">Por decisor</TabsTrigger>
          <TabsTrigger value="sdr">Por SDR</TabsTrigger>
        </TabsList>
        <TabsContent value="event" className="mt-3">
          <RankTable title="Receita por evento" keyLabel="Evento" rows={byEvent} />
        </TabsContent>
        <TabsContent value="icp" className="mt-3">
          <RankTable title="Receita por ICP" keyLabel="ICP" rows={byIcp} />
        </TabsContent>
        <TabsContent value="batch" className="mt-3">
          <RankTable title="Receita por batch run" keyLabel="Batch" rows={byBatch} />
        </TabsContent>
        <TabsContent value="dept" className="mt-3">
          <RankTable title="Receita por departamento do decisor" keyLabel="Departamento" rows={byDept} />
        </TabsContent>
        <TabsContent value="sdr" className="mt-3">
          <RankTable title="Receita por SDR" keyLabel="SDR" rows={bySdr} />
        </TabsContent>
      </Tabs>

      {/* Detail */}
      <Card>
        <CardHeader className="pb-2 flex flex-row items-center justify-between">
          <CardTitle className="text-sm flex items-center gap-2">
            <FileText className="h-4 w-4" />
            Atribuições recentes
          </CardTitle>
          <Badge variant="secondary" className="text-[10px]">{rows.length} registros</Badge>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Evento</TableHead>
                <TableHead>ICP</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Proposta</TableHead>
                <TableHead className="text-right">Receita válida</TableHead>
                <TableHead>Ganho em</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-6 text-xs">Carregando…</TableCell></TableRow>
              ) : rows.length === 0 ? (
                <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-6 text-xs">
                  Nenhuma atribuição. Promova itens da Qualified Queue para o CRM.
                </TableCell></TableRow>
              ) : rows.slice(0, 50).map((r) => (
                <TableRow key={r.id}>
                  <TableCell className="text-xs">{r.event_name || "—"}</TableCell>
                  <TableCell className="text-xs">{r.icp_cluster_name || "—"}</TableCell>
                  <TableCell><Badge variant="outline" className="text-[10px]">{r.status}</Badge></TableCell>
                  <TableCell className="text-xs">{r.proposal_sent_at ? "enviada" : r.proposal_id ? "criada" : "—"}</TableCell>
                  <TableCell className="text-right text-xs">{fmtBRL(Number(r.valid_revenue_amount ?? 0))}</TableCell>
                  <TableCell className="text-xs">{r.won_at ? new Date(r.won_at).toLocaleDateString("pt-BR") : "—"}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
