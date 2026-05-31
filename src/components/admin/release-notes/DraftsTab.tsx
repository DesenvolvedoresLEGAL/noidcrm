import { useReleaseDrafts, useGithubReleaseStatus } from "@/hooks/useReleaseNotesAdmin";
import { ReleaseDraftEditor } from "./ReleaseDraftEditor";
import { Loader2, FileText, Github } from "lucide-react";
import { GenerateReleaseDraftButton } from "./GenerateReleaseDraftButton";
import { Alert, AlertDescription } from "@/components/ui/alert";

export function DraftsTab() {
  // DraftsTab só renderiza dentro de área admin (ReleaseNotes gateia com canManageDrafts).
  const { data: drafts = [], isLoading } = useReleaseDrafts(true);
  const { data: ghStatus } = useGithubReleaseStatus(true);

  const showGithubNotice = ghStatus && !ghStatus.configured;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {showGithubNotice && (
        <Alert className="bg-muted/40 border-border/60">
          <Github className="h-4 w-4" />
          <AlertDescription className="text-sm text-muted-foreground">
            GitHub ainda não conectado. As releases estão sendo geradas com eventos internos
            do sistema. Conecte o GitHub para enriquecer os drafts com PRs reais.
          </AlertDescription>
        </Alert>
      )}

      {drafts.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center gap-3">
          <FileText className="h-10 w-10 text-muted-foreground/40" />
          <p className="text-sm text-muted-foreground">Nenhum rascunho aberto.</p>
          <GenerateReleaseDraftButton />
        </div>
      ) : (
        drafts.map((d) => <ReleaseDraftEditor key={d.id} draft={d} />)
      )}
    </div>
  );
}
