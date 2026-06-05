import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { FileText, AlertTriangle, CheckCircle2, ExternalLink, Calendar, Clock } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useReleaseNotesAdminStatus } from "@/hooks/useReleaseNotesAdminStatus";
import { GenerateReleaseDraftButton } from "@/components/admin/release-notes/GenerateReleaseDraftButton";

function formatDateTime(iso?: string) {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleString("pt-BR", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return iso;
  }
}

function formatPeriod(start?: string, end?: string) {
  if (!start || !end) return null;
  const fmt = (d: string) =>
    new Date(d).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });
  return `${fmt(start)} → ${fmt(end)}`;
}

/**
 * Card executivo do Release Notes Automático no Admin Command Center.
 * Renderiza APENAS quando o caller é platform admin (a página de Admin já gateia o acesso).
 */
export function ReleaseNotesAutomationCard({ enabled = true }: { enabled?: boolean }) {
  const navigate = useNavigate();
  const { data, isLoading } = useReleaseNotesAdminStatus(enabled);

  const statusBadge = (() => {
    if (!data?.lastGeneration) {
      return (
        <Badge variant="outline" className="gap-1.5">
          <Clock className="h-3 w-3" />
          Nunca executado
        </Badge>
      );
    }
    if (data.lastGeneration.status === "success") {
      return (
        <Badge variant="outline" className="gap-1.5 border-emerald-500/40 text-emerald-600 dark:text-emerald-400">
          <CheckCircle2 className="h-3 w-3" />
          Sucesso
        </Badge>
      );
    }
    return (
      <Badge variant="destructive" className="gap-1.5">
        <AlertTriangle className="h-3 w-3" />
        Falha
      </Badge>
    );
  })();

  const cronRanButNoDraft =
    data?.lastGeneration?.status === "success" && data.pendingDraftsCount === 0;

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between gap-2">
          <CardTitle className="text-base flex items-center gap-2">
            <FileText className="h-4 w-4" />
            Release Notes Automático
          </CardTitle>
          {statusBadge}
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {isLoading ? (
          <div className="space-y-3">
            <Skeleton className="h-4 w-3/4" />
            <Skeleton className="h-4 w-1/2" />
            <Skeleton className="h-4 w-2/3" />
          </div>
        ) : (
          <>
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div>
                <div className="text-xs text-muted-foreground">Última execução</div>
                <div className="font-medium">{formatDateTime(data?.lastGeneration?.at)}</div>
              </div>
              <div>
                <div className="text-xs text-muted-foreground">Próxima execução</div>
                <div className="font-medium flex items-center gap-1">
                  <Calendar className="h-3 w-3 text-muted-foreground" />
                  {formatDateTime(data?.nextRunAt)}
                </div>
                <div className="text-[10px] text-muted-foreground">Sexta 18h BRT</div>
              </div>
              <div>
                <div className="text-xs text-muted-foreground">Drafts pendentes</div>
                <div className="font-medium">{data?.pendingDraftsCount ?? 0}</div>
              </div>
              <div>
                <div className="text-xs text-muted-foreground">Última versão</div>
                <div className="font-medium">
                  {data?.lastDraft?.version || data?.lastGeneration?.version || "—"}
                </div>
              </div>
            </div>

            {data?.lastDraft && (
              <div className="rounded-md border bg-muted/30 p-3 text-sm space-y-1">
                <div className="text-xs text-muted-foreground">Último draft</div>
                <div className="font-medium line-clamp-1">{data.lastDraft.title}</div>
                <div className="text-xs text-muted-foreground">
                  v{data.lastDraft.version} · {formatDateTime(data.lastDraft.created_at)}
                  {formatPeriod(data.lastDraft.period_start, data.lastDraft.period_end) && (
                    <> · Período {formatPeriod(data.lastDraft.period_start, data.lastDraft.period_end)}</>
                  )}
                </div>
              </div>
            )}

            {cronRanButNoDraft && (
              <Alert className="py-2">
                <AlertTriangle className="h-3.5 w-3.5" />
                <AlertDescription className="text-xs">
                  Cron rodou, mas não há drafts pendentes. Pode ser período sem novidades.
                </AlertDescription>
              </Alert>
            )}

            {data?.lastFailure && (
              <Alert variant="destructive" className="py-2">
                <AlertTriangle className="h-3.5 w-3.5" />
                <AlertDescription className="text-xs">
                  <span className="font-medium">Última falha:</span> {formatDateTime(data.lastFailure.at)} —{" "}
                  {data.lastFailure.message}
                </AlertDescription>
              </Alert>
            )}

            <div className="flex flex-wrap items-center gap-2 pt-1">
              <Button
                size="sm"
                variant="outline"
                className="gap-1.5"
                onClick={() => navigate("/release-notes")}
              >
                <ExternalLink className="h-3.5 w-3.5" />
                Abrir Release Notes
              </Button>
              <GenerateReleaseDraftButton />
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
