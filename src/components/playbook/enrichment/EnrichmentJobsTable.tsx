import { Fragment, useState } from "react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { ChevronDown, ChevronRight, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { useEnrichmentJobs } from "@/hooks/useEnrichmentJobs";

const STATUS_TONE: Record<string, string> = {
  done: "bg-emerald-500/10 text-emerald-600 border-emerald-500/30",
  running: "bg-blue-500/10 text-blue-600 border-blue-500/30",
  skipped: "bg-amber-500/10 text-amber-700 border-amber-500/30",
  failed: "bg-destructive/10 text-destructive border-destructive/30",
  partial: "bg-cyan-500/10 text-cyan-600 border-cyan-500/30",
};

const SKIP_LABELS: Record<string, string> = {
  already_enriched: "Já enriquecido (24h)",
  low_score: "Score baixo",
  low_quality: "Qualidade baixa",
  dm_already_found: "Decisor já encontrado",
  no_domain: "Sem domínio",
  rate_limited: "Rate limit",
  daily_limit: "Limite diário",
};

function fmtDate(iso: string) {
  return new Date(iso).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" });
}

interface Props {
  prospectId: string;
}

export function EnrichmentJobsTable({ prospectId }: Props) {
  const { data: jobs = [], isLoading } = useEnrichmentJobs(prospectId);
  const [expanded, setExpanded] = useState<string | null>(null);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8 text-sm text-muted-foreground gap-2">
        <Loader2 className="h-4 w-4 animate-spin" /> Carregando histórico…
      </div>
    );
  }

  if (jobs.length === 0) {
    return (
      <Card className="p-6 text-center text-sm text-muted-foreground border-dashed">
        Nenhum job de enriquecimento ainda.
      </Card>
    );
  }

  return (
    <div className="border rounded-md overflow-hidden">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-8" />
            <TableHead>Data</TableHead>
            <TableHead>Provider</TableHead>
            <TableHead>Status</TableHead>
            <TableHead className="text-right">Créditos</TableHead>
            <TableHead>Origem</TableHead>
            <TableHead>Resultado</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {jobs.map((j) => {
            const isOpen = expanded === j.id;
            const summary = (j.response_summary ?? {}) as any;
            const resultText =
              j.status === "skipped"
                ? (SKIP_LABELS[j.skip_reason ?? ""] ?? j.skip_reason ?? "—")
                : j.status === "failed"
                ? (j.error ?? "Falhou").slice(0, 60)
                : `${summary.contacts_found ?? j.contacts_found ?? 0} contatos${summary.decision_makers_found ? ` · ${summary.decision_makers_found} decisor(es)` : ""}`;
            return (
              <Fragment key={j.id}>
                <TableRow
                  className="cursor-pointer"
                  onClick={() => setExpanded(isOpen ? null : j.id)}
                >
                  <TableCell>
                    {isOpen ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
                  </TableCell>
                  <TableCell className="text-xs whitespace-nowrap">{fmtDate(j.created_at)}</TableCell>
                  <TableCell className="text-xs capitalize">{j.provider}</TableCell>
                  <TableCell>
                    <Badge variant="outline" className={cn("text-[10px] capitalize", STATUS_TONE[j.status] ?? "")}>
                      {j.status}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right text-xs font-mono">{j.credits_used ?? 0}</TableCell>
                  <TableCell className="text-xs capitalize">{j.trigger_source ?? "—"}</TableCell>
                  <TableCell className="text-xs truncate max-w-[200px]">{resultText}</TableCell>
                </TableRow>
                {isOpen && (
                  <TableRow className="bg-muted/30">
                    <TableCell colSpan={7} className="p-3">
                      <div className="space-y-2 text-xs">
                        {summary && Object.keys(summary).length > 0 && (
                          <div>
                            <div className="font-semibold mb-1">Resumo</div>
                            <pre className="bg-background border rounded p-2 overflow-x-auto">{JSON.stringify(summary, null, 2)}</pre>
                          </div>
                        )}
                        {j.error && (
                          <div>
                            <div className="font-semibold text-destructive mb-1">Erro</div>
                            <div className="bg-destructive/5 border border-destructive/20 rounded p-2">{j.error}</div>
                          </div>
                        )}
                        <details>
                          <summary className="cursor-pointer text-muted-foreground">Request / Response (raw)</summary>
                          <pre className="bg-background border rounded p-2 overflow-x-auto mt-1 max-h-64">{JSON.stringify({ request: j.request, response: j.response }, null, 2)}</pre>
                        </details>
                      </div>
                    </TableCell>
                  </TableRow>
                )}
              </Fragment>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}
