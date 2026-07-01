import { useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  AlertTriangle, CheckCircle2, Download, RefreshCw, Lightbulb,
  DollarSign, Target, TrendingDown, Zap,
} from "lucide-react";
import {
  useGtmPerformance, useGtmRecommendations, useRefreshGtmPerformance, useUpdateRecommendation,
} from "@/hooks/intelligence/useGtmPerformance";
import {
  computeKpis, buildFunnel, detectBottlenecks, rankBy, toCsv,
  type GtmFilters, type RankRow,
} from "@/services/intelligence/gtmPerformance";
import { RevenueSsotBanner } from "@/components/revenue/RevenueSsotBanner";
import { ModuleHeader, PremiumKpi, TableSkeleton } from "@/components/intelligence/kairos/premium";
import { BarChart3 } from "lucide-react";

const fmtBRL = (v: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 }).format(v || 0);
const fmtPct = (v: number) => `${(v * 100).toFixed(1)}%`;

function RankTable({ title, rows, keyLabel, onExport }: { title: string; rows: RankRow[]; keyLabel: string; onExport: () => void }) {
  return (
    <Card>
      <CardHeader className="pb-2 flex flex-row items-center justify-between">
        <CardTitle className="text-sm">{title}</CardTitle>
        <Button size="sm" variant="outline" onClick={onExport} disabled={rows.length === 0}>
          <Download className="h-3.5 w-3.5 mr-1" /> CSV
        </Button>
      </CardHeader>
      <CardContent className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{keyLabel}</TableHead>
              <TableHead className="text-right">Capturados</TableHead>
              <TableHead className="text-right">SDR Ready</TableHead>
              <TableHead className="text-right">Promovidos</TableHead>
              <TableHead className="text-right">Propostas</TableHead>
              <TableHead className="text-right">Vendas</TableHead>
              <TableHead className="text-right">Receita</TableHead>
              <TableHead className="text-right">Conv.</TableHead>
              <TableHead className="text-right">Apollo ROI</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.length === 0 ? (
              <TableRow><TableCell colSpan={9} className="text-center text-muted-foreground text-xs py-6">Sem dados</TableCell></TableRow>
            ) : rows.slice(0, 20).map((r) => (
              <TableRow key={r.key}>
                <TableCell className="font-medium text-xs">{r.label || "—"}</TableCell>
                <TableCell className="text-right text-xs">{r.captured}</TableCell>
                <TableCell className="text-right text-xs">{r.sdr_ready}</TableCell>
                <TableCell className="text-right text-xs">{r.promoted}</TableCell>
                <TableCell className="text-right text-xs">{r.proposals}</TableCell>
                <TableCell className="text-right text-xs">{r.won}</TableCell>
                <TableCell className="text-right text-xs">{fmtBRL(r.revenue)}</TableCell>
                <TableCell className="text-right text-xs">{fmtPct(r.conversion)}</TableCell>
                <TableCell className="text-right text-xs">{r.credits ? r.apollo_roi.toFixed(2) : "—"}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}

export function GtmPerformancePanel() {
  const [filters, setFilters] = useState<GtmFilters>({});
  const { data: rows = [], isLoading } = useGtmPerformance(filters);
  const { data: recs = [] } = useGtmRecommendations();
  const refresh = useRefreshGtmPerformance();
  const updateRec = useUpdateRecommendation();

  const kpis = useMemo(() => computeKpis(rows), [rows]);
  const funnel = useMemo(() => buildFunnel(rows), [rows]);
  const bottlenecks = useMemo(() => detectBottlenecks(rows), [rows]);
  const byEvent = useMemo(() => rankBy(rows, "event_name", "Sem evento"), [rows]);
  const byIcp = useMemo(() => rankBy(rows, "icp_cluster_name", "Sem ICP"), [rows]);
  const byBatch = useMemo(() => rankBy(rows, "batch_run_id", "Sem batch"), [rows]);
  const byDept = useMemo(() => rankBy(rows, "primary_contact_department", "Sem departamento"), [rows]);
  const bySdr = useMemo(() => rankBy(rows, "sdr_id", "Sem SDR"), [rows]);

  const download = (rankRows: RankRow[], label: string, filename: string) => {
    const blob = new Blob([toCsv(rankRows, label)], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${filename}-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const severityClass = (s: string) =>
    s === "high" || s === "critical" ? "border-destructive/40 bg-destructive/5 text-destructive"
    : s === "medium" ? "border-amber-500/40 bg-amber-500/5 text-amber-700 dark:text-amber-300"
    : "border-muted bg-muted/30";

  return (
    <div className="space-y-4">
      <RevenueSsotBanner surface="Kairós · GTM Performance" />

      {/* Filters + refresh */}
      <Card>
        <CardContent className="p-4 flex flex-wrap items-end gap-3">
          <div className="space-y-1">
            <label className="text-[11px] text-muted-foreground">Evento (id)</label>
            <Input className="h-9 w-44" value={filters.eventId ?? ""} onChange={(e) => setFilters((f) => ({ ...f, eventId: e.target.value || undefined }))} />
          </div>
          <div className="space-y-1">
            <label className="text-[11px] text-muted-foreground">Departamento</label>
            <Input className="h-9 w-44" value={filters.department ?? ""} onChange={(e) => setFilters((f) => ({ ...f, department: e.target.value || undefined }))} />
          </div>
          <div className="ml-auto">
            <Button onClick={() => refresh.mutate()} disabled={refresh.isPending}>
              <RefreshCw className={`h-3.5 w-3.5 mr-1 ${refresh.isPending ? "animate-spin" : ""}`} />
              Atualizar performance
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <Kpi icon={DollarSign} label="Receita válida" value={fmtBRL(kpis.valid_revenue)} />
        <Kpi icon={Target} label="Capturados" value={String(kpis.captured)} />
        <Kpi icon={CheckCircle2} label="SDR Ready" value={String(kpis.sdr_ready)} hint={fmtPct(kpis.capture_to_sdr_ready) + " conv."} />
        <Kpi icon={Zap} label="Vendas" value={String(kpis.won)} hint={fmtPct(kpis.proposal_to_won) + " proposta→venda"} />
        <Kpi icon={TrendingDown} label="Apollo R$/crédito" value={kpis.apollo_credits ? fmtBRL(kpis.revenue_per_credit) : "—"} hint={`${kpis.apollo_credits} créditos`} />
      </div>

      {/* Funnel */}
      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-sm">Funil GTM</CardTitle></CardHeader>
        <CardContent>
          <div className="space-y-1.5">
            {funnel.map((s) => {
              const top = funnel[0].value || 1;
              const widthPct = Math.max(4, Math.round((s.value / top) * 100));
              const conv = s.prev && s.prev > 0 ? s.value / s.prev : null;
              return (
                <div key={s.label} className="flex items-center gap-3 text-xs">
                  <div className="w-36 shrink-0 text-muted-foreground">{s.label}</div>
                  <div className="flex-1 bg-muted/30 rounded h-6 overflow-hidden">
                    <div className="h-full bg-primary/70 flex items-center justify-end px-2 text-[10px] text-primary-foreground"
                         style={{ width: `${widthPct}%` }}>
                      {s.value}
                    </div>
                  </div>
                  <div className="w-24 text-right text-muted-foreground">
                    {conv !== null ? `${(conv * 100).toFixed(1)}%` : "—"}
                  </div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Bottlenecks + Recommendations */}
      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader className="pb-2 flex flex-row items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-amber-500" />
            <CardTitle className="text-sm">Gargalos detectados</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {bottlenecks.length === 0 ? (
              <div className="text-xs text-muted-foreground">Funil saudável — sem gargalos significativos.</div>
            ) : bottlenecks.map((b) => (
              <div key={b.id} className={`rounded-md border p-3 ${severityClass(b.severity)}`}>
                <div className="text-xs font-medium">{b.title}</div>
                <div className="text-[11px] mt-0.5">{b.description}</div>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2 flex flex-row items-center gap-2">
            <Lightbulb className="h-4 w-4 text-primary" />
            <CardTitle className="text-sm">Recomendações automáticas</CardTitle>
            <Badge variant="secondary" className="ml-auto text-[10px]">{recs.length}</Badge>
          </CardHeader>
          <CardContent className="space-y-2 max-h-80 overflow-y-auto">
            {recs.length === 0 ? (
              <div className="text-xs text-muted-foreground">
                Sem recomendações abertas. Use “Atualizar performance” para gerar agora.
              </div>
            ) : recs.map((r) => (
              <div key={r.id} className={`rounded-md border p-3 ${severityClass(r.severity)}`}>
                <div className="flex items-start justify-between gap-2">
                  <div className="text-xs font-medium">{r.title}</div>
                  <Badge variant="outline" className="text-[10px]">{r.severity}</Badge>
                </div>
                <div className="text-[11px] mt-0.5">{r.description}</div>
                <div className="mt-2 flex gap-2">
                  <Button size="sm" variant="ghost" className="h-6 text-[11px]"
                    onClick={() => updateRec.mutate({ id: r.id, status: "acknowledged" })}>
                    Reconhecer
                  </Button>
                  <Button size="sm" variant="ghost" className="h-6 text-[11px]"
                    onClick={() => updateRec.mutate({ id: r.id, status: "resolved" })}>
                    Resolver
                  </Button>
                  <Button size="sm" variant="ghost" className="h-6 text-[11px]"
                    onClick={() => updateRec.mutate({ id: r.id, status: "dismissed" })}>
                    Dispensar
                  </Button>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      {/* Rankings */}
      <Tabs defaultValue="event">
        <TabsList className="grid grid-cols-2 md:grid-cols-5 max-w-3xl">
          <TabsTrigger value="event">Evento</TabsTrigger>
          <TabsTrigger value="icp">ICP</TabsTrigger>
          <TabsTrigger value="batch">Batch</TabsTrigger>
          <TabsTrigger value="dept">Decisor</TabsTrigger>
          <TabsTrigger value="sdr">SDR</TabsTrigger>
        </TabsList>
        <TabsContent value="event" className="mt-3">
          <RankTable title="Performance por evento" keyLabel="Evento" rows={byEvent}
            onExport={() => download(byEvent, "Evento", "gtm-evento")} />
        </TabsContent>
        <TabsContent value="icp" className="mt-3">
          <RankTable title="Performance por ICP" keyLabel="ICP" rows={byIcp}
            onExport={() => download(byIcp, "ICP", "gtm-icp")} />
        </TabsContent>
        <TabsContent value="batch" className="mt-3">
          <RankTable title="Performance por batch" keyLabel="Batch" rows={byBatch}
            onExport={() => download(byBatch, "Batch", "gtm-batch")} />
        </TabsContent>
        <TabsContent value="dept" className="mt-3">
          <RankTable title="Performance por departamento do decisor" keyLabel="Departamento" rows={byDept}
            onExport={() => download(byDept, "Departamento", "gtm-departamento")} />
        </TabsContent>
        <TabsContent value="sdr" className="mt-3">
          <RankTable title="Performance por SDR" keyLabel="SDR" rows={bySdr}
            onExport={() => download(bySdr, "SDR", "gtm-sdr")} />
        </TabsContent>
      </Tabs>

      {isLoading && <div className="text-xs text-muted-foreground text-center py-2">Carregando…</div>}
    </div>
  );
}
