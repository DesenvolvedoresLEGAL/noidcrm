import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Download, Loader2, Users, Target, Coins, CheckCircle2 } from "lucide-react";
import { useReportFiltersContext } from "@/contexts/ReportFiltersContext";
import { toast } from "sonner";

interface Row {
  id: string;
  prospect_id: string | null;
  full_name: string | null;
  role_title: string | null;
  seniority: string | null;
  email: string | null;
  email_status: string | null;
  phone: string | null;
  linkedin_url: string | null;
  provider: string | null;
  confidence_score: number | null;
  created_at: string;
  prospect: {
    company_name: string | null;
    normalized_domain: string | null;
    organization_id: string;
  } | null;
}

function exportToCSV(rows: Row[]) {
  const header = [
    "company_name", "domain", "decision_maker_name", "role", "seniority",
    "email", "email_status", "phone", "linkedin", "contact_score", "provider", "enriched_at",
  ];
  const escape = (v: unknown) => {
    if (v == null) return "";
    const s = String(v).replace(/"/g, '""');
    return /[",\n;]/.test(s) ? `"${s}"` : s;
  };
  const lines = [header.join(",")];
  for (const r of rows) {
    lines.push([
      r.prospect?.company_name ?? "",
      r.prospect?.normalized_domain ?? "",
      r.full_name ?? "",
      r.role_title ?? "",
      r.seniority ?? "",
      r.email ?? "",
      r.email_status ?? "",
      r.phone ?? "",
      r.linkedin_url ?? "",
      r.confidence_score ?? "",
      r.provider ?? "",
      r.created_at ?? "",
    ].map(escape).join(","));
  }
  const blob = new Blob(["\uFEFF" + lines.join("\n")], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `decisores-enriquecidos-${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

export function EnrichedDecisionMakersWrapper() {
  const { effectiveDates } = useReportFiltersContext();
  const [minScore, setMinScore] = useState<number>(0);
  const [provider, setProvider] = useState<string>("all");
  const [emailStatus, setEmailStatus] = useState<string>("all");

  const { data: rows = [], isLoading } = useQuery({
    queryKey: ["enriched-decision-makers", effectiveDates.startDate, effectiveDates.endDate, minScore, provider, emailStatus],
    queryFn: async () => {
      let q = supabase
        .from("enriched_contact_profiles")
        .select("id, prospect_id, full_name, role_title, seniority, email, email_status, phone, linkedin_url, provider, confidence_score, created_at, prospect:prospects(company_name, normalized_domain, organization_id)")
        .gte("created_at", `${effectiveDates.startDate}T00:00:00.000Z`)
        .lte("created_at", `${effectiveDates.endDate}T23:59:59.999Z`)
        .order("confidence_score", { ascending: false, nullsFirst: false })
        .limit(1000);
      if (minScore > 0) q = q.gte("confidence_score", minScore);
      if (provider !== "all") q = q.eq("provider", provider);
      if (emailStatus !== "all") q = q.eq("email_status", emailStatus);
      const { data, error } = await q;
      if (error) throw error;
      return (data ?? []) as unknown as Row[];
    },
  });

  // Credits used in window
  const { data: creditsAgg } = useQuery({
    queryKey: ["enriched-decision-makers-credits", effectiveDates.startDate, effectiveDates.endDate],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("enrichment_jobs" as any)
        .select("credits_used, status, prospect_id")
        .gte("created_at", `${effectiveDates.startDate}T00:00:00.000Z`)
        .lte("created_at", `${effectiveDates.endDate}T23:59:59.999Z`)
        .eq("provider", "apollo");
      if (error) throw error;
      const list = (data ?? []) as any[];
      const credits = list.reduce((s, j) => s + (j.credits_used ?? 0), 0);
      const totalJobs = list.length;
      const doneJobs = list.filter((j) => j.status === "done").length;
      return { credits, totalJobs, doneJobs };
    },
  });

  const kpis = useMemo(() => {
    const prospectsSet = new Set(rows.map((r) => r.prospect_id).filter(Boolean));
    const dmCount = rows.filter((r) => ["c_level", "vp", "director"].includes(r.seniority ?? "")).length;
    const dmProspectsSet = new Set(
      rows.filter((r) => ["c_level", "vp", "director"].includes(r.seniority ?? ""))
        .map((r) => r.prospect_id).filter(Boolean),
    );
    const avgScore = rows.length
      ? Math.round(rows.reduce((s, r) => s + (r.confidence_score ?? 0), 0) / rows.length)
      : 0;
    const dmRate = prospectsSet.size ? Math.round((dmProspectsSet.size / prospectsSet.size) * 100) : 0;
    return { contacts: rows.length, dmCount, prospects: prospectsSet.size, avgScore, dmRate };
  }, [rows]);

  return (
    <div className="space-y-4">
      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <Users className="h-5 w-5 text-primary" />
            <div>
              <div className="text-2xl font-bold">{kpis.prospects}</div>
              <div className="text-xs text-muted-foreground">Prospects enriquecidos</div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <Target className="h-5 w-5 text-emerald-600" />
            <div>
              <div className="text-2xl font-bold">{kpis.dmRate}%</div>
              <div className="text-xs text-muted-foreground">Taxa decisor encontrado</div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <CheckCircle2 className="h-5 w-5 text-blue-600" />
            <div>
              <div className="text-2xl font-bold">{kpis.avgScore}</div>
              <div className="text-xs text-muted-foreground">Score médio</div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <Coins className="h-5 w-5 text-amber-600" />
            <div>
              <div className="text-2xl font-bold">{creditsAgg?.credits ?? 0}</div>
              <div className="text-xs text-muted-foreground">
                Créditos consumidos · {creditsAgg?.totalJobs ?? 0} jobs
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters + Export */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <CardTitle className="text-base">Decisores Enriquecidos</CardTitle>
            <Button
              size="sm"
              variant="outline"
              onClick={() => {
                if (rows.length === 0) {
                  toast.info("Nenhum dado para exportar");
                  return;
                }
                exportToCSV(rows);
                toast.success("CSV exportado");
              }}
              className="gap-1.5"
            >
              <Download className="h-3.5 w-3.5" /> Exportar CSV
            </Button>
          </div>
          <div className="flex gap-2 flex-wrap pt-2">
            <div className="flex items-center gap-1.5">
              <span className="text-xs text-muted-foreground">Score min</span>
              <Input
                type="number"
                value={minScore}
                onChange={(e) => setMinScore(Number(e.target.value) || 0)}
                className="h-8 w-20"
              />
            </div>
            <Select value={provider} onValueChange={setProvider}>
              <SelectTrigger className="h-8 w-32"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos providers</SelectItem>
                <SelectItem value="apollo">Apollo</SelectItem>
              </SelectContent>
            </Select>
            <Select value={emailStatus} onValueChange={setEmailStatus}>
              <SelectTrigger className="h-8 w-40"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos emails</SelectItem>
                <SelectItem value="verified">Verificado</SelectItem>
                <SelectItem value="guessed">Guessed</SelectItem>
                <SelectItem value="unavailable">Indisponível</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="py-12 text-center text-sm text-muted-foreground flex items-center justify-center gap-2">
              <Loader2 className="h-4 w-4 animate-spin" /> Carregando…
            </div>
          ) : rows.length === 0 ? (
            <div className="py-12 text-center text-sm text-muted-foreground">Nenhum decisor enriquecido no período.</div>
          ) : (
            <div className="border rounded-md overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Empresa</TableHead>
                    <TableHead>Domínio</TableHead>
                    <TableHead>Decisor</TableHead>
                    <TableHead>Cargo</TableHead>
                    <TableHead>Senioridade</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Telefone</TableHead>
                    <TableHead>LinkedIn</TableHead>
                    <TableHead className="text-right">Score</TableHead>
                    <TableHead>Provider</TableHead>
                    <TableHead>Enriquecido em</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.map((r) => (
                    <TableRow key={r.id}>
                      <TableCell className="font-medium text-xs">{r.prospect?.company_name ?? "—"}</TableCell>
                      <TableCell className="text-xs font-mono">{r.prospect?.normalized_domain ?? "—"}</TableCell>
                      <TableCell className="text-xs">{r.full_name ?? "—"}</TableCell>
                      <TableCell className="text-xs">{r.role_title ?? "—"}</TableCell>
                      <TableCell className="text-xs">
                        {r.seniority ? <Badge variant="outline" className="text-[10px]">{r.seniority}</Badge> : "—"}
                      </TableCell>
                      <TableCell className="text-xs font-mono">
                        {r.email ?? "—"}
                        {r.email_status === "verified" && <CheckCircle2 className="h-3 w-3 inline ml-1 text-green-600" />}
                      </TableCell>
                      <TableCell className="text-xs">{r.phone ?? "—"}</TableCell>
                      <TableCell className="text-xs">
                        {r.linkedin_url ? (
                          <a href={r.linkedin_url} target="_blank" rel="noreferrer" className="text-primary hover:underline">link</a>
                        ) : "—"}
                      </TableCell>
                      <TableCell className="text-right text-xs font-bold">{r.confidence_score ?? "—"}</TableCell>
                      <TableCell className="text-xs">{r.provider ?? "—"}</TableCell>
                      <TableCell className="text-xs whitespace-nowrap">{new Date(r.created_at).toLocaleDateString("pt-BR")}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
