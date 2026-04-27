import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Loader2 } from "lucide-react";
import { formatDateBR } from "@/lib/dateUtils";
import { useState } from "react";
import { Input } from "@/components/ui/input";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";

interface AuditLog {
  id: string;
  created_at: string;
  prospect_id: string | null;
  rule_id: string | null;
  score: number | null;
  confidence: number | null;
  quality_label: string | null;
  decision_taken: string;
  actions_executed: any;
  decision_payload: any;
  error_message: string | null;
}

const decisionVariant: Record<string, "default" | "secondary" | "outline" | "destructive"> = {
  executed: "default",
  skipped_duplicate: "secondary",
  skipped_low_quality: "secondary",
  no_active_matching_rule: "outline",
  skipped_no_rule: "outline",
  failed: "destructive",
};

const decisionLabel: Record<string, string> = {
  executed: "Executado",
  skipped_duplicate: "Pulado · duplicata",
  skipped_low_quality: "Pulado · baixa qualidade",
  no_active_matching_rule: "Sem regra ativa",
  skipped_no_rule: "Sem regra",
  failed: "Falhou",
};

export function DecisionAuditPanel({ organizationId }: { organizationId: string | undefined }) {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");

  const { data: logs, isLoading } = useQuery({
    queryKey: ["decision-audit", organizationId],
    enabled: !!organizationId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("decision_logs" as any)
        .select("*")
        .eq("organization_id", organizationId!)
        .order("created_at", { ascending: false })
        .limit(200);
      if (error) throw error;
      return (data ?? []) as unknown as AuditLog[];
    },
  });

  const { data: rules } = useQuery({
    queryKey: ["decision-rules-map", organizationId],
    enabled: !!organizationId,
    queryFn: async () => {
      const { data } = await supabase
        .from("decision_rules" as any)
        .select("id, name")
        .eq("organization_id", organizationId!);
      return Object.fromEntries(((data ?? []) as any[]).map((r) => [r.id, r.name]));
    },
  });

  const filtered = (logs ?? []).filter((l) => {
    if (statusFilter !== "all" && l.decision_taken !== statusFilter) return false;
    if (!search) return true;
    const hay = `${l.prospect_id ?? ""} ${l.id} ${rules?.[l.rule_id ?? ""] ?? ""}`.toLowerCase();
    return hay.includes(search.toLowerCase());
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-3">
        <Input
          placeholder="Buscar por prospect, log ou regra…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="max-w-sm"
        />
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[220px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos os status</SelectItem>
            <SelectItem value="executed">Executado</SelectItem>
            <SelectItem value="skipped_duplicate">Pulado · duplicata</SelectItem>
            <SelectItem value="skipped_low_quality">Pulado · baixa qualidade</SelectItem>
            <SelectItem value="no_active_matching_rule">Sem regra ativa</SelectItem>
            <SelectItem value="failed">Falhou</SelectItem>
          </SelectContent>
        </Select>
        <div className="text-xs text-muted-foreground self-center">
          {filtered.length} de {logs?.length ?? 0} registros
        </div>
      </div>

      {filtered.length === 0 ? (
        <Card>
          <CardContent className="py-10 text-center text-sm text-muted-foreground">
            Nenhum registro de decisão encontrado.
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {filtered.map((log) => {
            const ruleName = rules?.[log.rule_id ?? ""];
            const actions = log.actions_executed ?? {};
            const payload = log.decision_payload ?? {};
            return (
              <Card key={log.id}>
                <CardContent className="py-3 space-y-2">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-2 flex-wrap">
                      <Badge variant={decisionVariant[log.decision_taken] ?? "outline"}>
                        {decisionLabel[log.decision_taken] ?? log.decision_taken}
                      </Badge>
                      {ruleName && <Badge variant="secondary">{ruleName}</Badge>}
                      {payload.priority_label && (
                        <Badge variant="outline">{payload.priority_label}</Badge>
                      )}
                      {log.quality_label && (
                        <Badge variant="outline">qualidade: {log.quality_label}</Badge>
                      )}
                    </div>
                    <span className="text-xs text-muted-foreground">
                      {formatDateBR(log.created_at)}
                    </span>
                  </div>

                  <div className="flex flex-wrap gap-3 text-xs text-muted-foreground">
                    <span>Prospect: <code className="font-mono">{log.prospect_id?.slice(0, 8) ?? "—"}</code></span>
                    <span>Score: {log.score ?? "—"}</span>
                    <span>Confiança: {log.confidence ?? "—"}%</span>
                    {actions.owner_user_id && (
                      <span>Owner: <code className="font-mono">{String(actions.owner_user_id).slice(0, 8)}</code></span>
                    )}
                    {actions.opportunity_id && (
                      <span>Oport.: <code className="font-mono">{String(actions.opportunity_id).slice(0, 8)}</code></span>
                    )}
                  </div>

                  {payload.reason && (
                    <div className="text-xs">
                      <span className="text-muted-foreground">Motivo: </span>
                      <span className="font-medium">{payload.reason}</span>
                      {Array.isArray(payload.inactive_matching_rules) && payload.inactive_matching_rules.length > 0 && (
                        <span className="text-muted-foreground">
                          {" "}— regras desligadas que matchariam:{" "}
                          {payload.inactive_matching_rules.map((r: any) => r.name).join(", ")}
                        </span>
                      )}
                    </div>
                  )}

                  {log.error_message && (
                    <div className="text-xs text-destructive">Erro: {log.error_message}</div>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
