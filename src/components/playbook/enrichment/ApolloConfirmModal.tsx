import { useEffect, useState } from "react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Loader2, Sparkles, AlertTriangle, CheckCircle2, XCircle, Coins } from "lucide-react";
import { previewApolloEnrichment, type ApolloPreview } from "@/services/enrichment/apolloPreview";
import { cn } from "@/lib/utils";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  prospectId: string | null;
  onConfirm: () => Promise<void> | void;
  isRunning: boolean;
}

export function ApolloConfirmModal({ open, onOpenChange, prospectId, onConfirm, isRunning }: Props) {
  const [loading, setLoading] = useState(false);
  const [preview, setPreview] = useState<ApolloPreview | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open || !prospectId) return;
    setPreview(null); setError(null); setLoading(true);
    previewApolloEnrichment(prospectId)
      .then(setPreview)
      .catch((e) => setError(e?.message ?? String(e)))
      .finally(() => setLoading(false));
  }, [open, prospectId]);

  const handleConfirm = async () => {
    await onConfirm();
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-primary" /> Enriquecer com Apollo
          </DialogTitle>
          <DialogDescription>
            Confirme antes de consumir créditos da API.
          </DialogDescription>
        </DialogHeader>

        {loading && (
          <div className="py-8 text-center text-sm text-muted-foreground flex items-center justify-center gap-2">
            <Loader2 className="h-4 w-4 animate-spin" /> Verificando elegibilidade…
          </div>
        )}

        {error && (
          <div className="rounded-md border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">
            Erro ao carregar preview: {error}
          </div>
        )}

        {preview && (
          <div className="space-y-3">
            <div className="rounded-md border bg-muted/30 p-3 space-y-1.5 text-sm">
              <div className="flex justify-between gap-2">
                <span className="text-muted-foreground">Empresa</span>
                <span className="font-medium truncate">{preview.company_name ?? "—"}</span>
              </div>
              <div className="flex justify-between gap-2">
                <span className="text-muted-foreground">Domínio</span>
                <span className="font-mono text-xs">{preview.domain ?? "—"}</span>
              </div>
              <div className="flex justify-between gap-2 items-center">
                <span className="text-muted-foreground">Score</span>
                <Badge variant="outline">{preview.score} {preview.quality_label && `· ${preview.quality_label}`}</Badge>
              </div>
              <div className="flex justify-between gap-2 items-center">
                <span className="text-muted-foreground">Status</span>
                {preview.eligible && preview.review_required ? (
                  <Badge className="gap-1 bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/30">
                    <AlertTriangle className="h-3 w-3" /> Elegível com revisão
                  </Badge>
                ) : preview.eligible ? (
                  <Badge className="gap-1 bg-emerald-500/10 text-emerald-600 border-emerald-500/30">
                    <CheckCircle2 className="h-3 w-3" /> Elegível
                  </Badge>
                ) : (
                  <Badge variant="outline" className="gap-1 border-destructive/40 text-destructive">
                    <XCircle className="h-3 w-3" /> Não elegível
                  </Badge>
                )}
              </div>
              <div className="flex justify-between gap-2 items-center">
                <span className="text-muted-foreground flex items-center gap-1">
                  <Coins className="h-3.5 w-3.5" /> Créditos estimados
                </span>
                <span className="font-bold">{preview.estimated_credits}</span>
              </div>
            </div>

            {!preview.eligible && preview.reason && (
              <div className={cn(
                "rounded-md border p-2.5 text-xs flex gap-2",
                "border-destructive/30 bg-destructive/5 text-destructive",
              )}>
                <XCircle className="h-3.5 w-3.5 shrink-0 mt-0.5" />
                <span>{preview.reason}</span>
              </div>
            )}

            {preview.warning && (
              <div className="rounded-md border border-amber-500/30 bg-amber-500/5 p-2.5 text-xs text-amber-700 dark:text-amber-400 flex gap-2">
                <AlertTriangle className="h-3.5 w-3.5 shrink-0 mt-0.5" />
                <span>{preview.warning}</span>
              </div>
            )}
          </div>
        )}

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={isRunning}>
            Cancelar
          </Button>
          <Button
            onClick={handleConfirm}
            disabled={!preview?.eligible || isRunning || loading}
            className="gap-1.5"
          >
            {isRunning ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}
            {preview?.review_required ? "Confirmar (revisão humana)" : "Confirmar enriquecimento"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
