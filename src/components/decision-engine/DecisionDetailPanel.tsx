import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Loader2, RefreshCw } from "lucide-react";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { useDecisionLogs, useRunDecisionEngine } from "@/hooks/useDecisionEngine";
import { formatDateBR } from "@/lib/dateUtils";

interface Props {
  prospectId: string;
  enrichmentRunId?: string | null;
}

export function DecisionDetailPanel({ prospectId, enrichmentRunId }: Props) {
  const { organization } = useCurrentUser();
  const { data: logs, isLoading } = useDecisionLogs(prospectId);
  const run = useRunDecisionEngine();

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold">Histórico de decisões</h3>
        <Button
          size="sm"
          variant="outline"
          disabled={!organization?.id || run.isPending}
          onClick={() =>
            run.mutate({
              prospect_id: prospectId,
              organization_id: organization!.id,
              enrichment_run_id: enrichmentRunId ?? null,
            })
          }
        >
          <RefreshCw className="h-3 w-3 mr-1" /> Reprocessar
        </Button>
      </div>

      {!logs || logs.length === 0 ? (
        <Card>
          <CardContent className="py-8 text-center text-sm text-muted-foreground">
            Nenhuma decisão registrada.
          </CardContent>
        </Card>
      ) : (
        logs.map((log) => {
          const actions = log.actions_executed ?? {};
          const payload = log.decision_payload ?? {};
          return (
            <Card key={log.id}>
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <Badge variant={log.decision_taken === "executed" ? "default" : "outline"}>
                      {log.decision_taken}
                    </Badge>
                    {payload.priority_label && (
                      <Badge variant="secondary">{payload.priority_label as string}</Badge>
                    )}
                  </CardTitle>
                  <span className="text-xs text-muted-foreground">
                    {formatDateBR(log.created_at)}
                  </span>
                </div>
              </CardHeader>
              <CardContent className="text-xs space-y-1">
                <div className="flex gap-3 text-muted-foreground">
                  <span>Score: {log.score ?? "—"}</span>
                  <span>Confiança: {log.confidence ?? "—"}%</span>
                  {log.quality_label && <span>Qualidade: {log.quality_label}</span>}
                </div>
                {payload.rule_name && (
                  <div>Regra: <span className="font-medium">{payload.rule_name as string}</span></div>
                )}
                {Object.keys(actions).length > 0 && (
                  <div className="pt-1 space-y-0.5">
                    {actions.opportunity_id && <div>✔ Oportunidade criada</div>}
                    {actions.owner_user_id && <div>✔ Owner atribuído</div>}
                    {actions.activity_id && <div>✔ Task criada</div>}
                    {actions.sequence_enrollment_id && <div>✔ Sequência iniciada</div>}
                  </div>
                )}
                {log.error_message && (
                  <div className="text-destructive pt-1">Erro: {log.error_message}</div>
                )}
              </CardContent>
            </Card>
          );
        })
      )}
    </div>
  );
}
