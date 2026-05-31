import { useReleaseDrafts } from "@/hooks/useReleaseNotesAdmin";
import { ReleaseDraftEditor } from "./ReleaseDraftEditor";
import { Loader2, FileText } from "lucide-react";
import { GenerateReleaseDraftButton } from "./GenerateReleaseDraftButton";

export function DraftsTab() {
  const { data: drafts = [], isLoading } = useReleaseDrafts();

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (drafts.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center gap-3">
        <FileText className="h-10 w-10 text-muted-foreground/40" />
        <p className="text-sm text-muted-foreground">Nenhum rascunho aberto.</p>
        <GenerateReleaseDraftButton />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {drafts.map((d) => (
        <ReleaseDraftEditor key={d.id} draft={d} />
      ))}
    </div>
  );
}
