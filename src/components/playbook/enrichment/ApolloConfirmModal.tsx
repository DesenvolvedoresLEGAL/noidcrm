import { useEffect, useState, KeyboardEvent } from "react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, Sparkles, AlertTriangle, CheckCircle2, XCircle, Coins, X, Plus } from "lucide-react";
import { previewApolloEnrichment, type ApolloPreview } from "@/services/enrichment/apolloPreview";
import { cn } from "@/lib/utils";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  prospectId: string | null;
  onConfirm: (customTitles?: string[]) => Promise<void> | void;
  isRunning: boolean;
}

const PRESETS: Array<{ label: string; titles: string[] }> = [
  { label: "Marketing", titles: ["gerente de marketing", "head de marketing", "diretor de marketing", "analista de marketing", "trade marketing", "cmo"] },
  { label: "Vendas", titles: ["gerente de vendas", "diretor comercial", "head de vendas", "vp de vendas", "chief revenue officer", "cro"] },
  { label: "Eventos", titles: ["analista de eventos", "coordenador de eventos", "gerente de eventos", "head de eventos"] },
  { label: "C-Level", titles: ["ceo", "cto", "coo", "cfo", "cmo", "founder", "presidente", "diretor executivo"] },
  { label: "Compras", titles: ["gerente de compras", "comprador", "head de procurement", "diretor de suprimentos"] },
];

function parseInput(raw: string): string[] {
  return raw
    .split(/[,\n;]/)
    .map((s) => s.trim())
    .filter((s) => s.length > 0 && s.length <= 80);
}

export function ApolloConfirmModal({ open, onOpenChange, prospectId, onConfirm, isRunning }: Props) {
  const [loading, setLoading] = useState(false);
  const [preview, setPreview] = useState<ApolloPreview | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [titles, setTitles] = useState<string[]>([]);
  const [draft, setDraft] = useState("");

  useEffect(() => {
    if (!open || !prospectId) return;
    setPreview(null); setError(null); setLoading(true);
    setTitles([]); setDraft("");
    previewApolloEnrichment(prospectId)
      .then(setPreview)
      .catch((e) => setError(e?.message ?? String(e)))
      .finally(() => setLoading(false));
  }, [open, prospectId]);

  const addFromDraft = () => {
    const parsed = parseInput(draft);
    if (parsed.length === 0) return;
    setTitles((prev) => {
      const seen = new Set(prev.map((t) => t.toLowerCase()));
      const merged = [...prev];
      for (const p of parsed) {
        if (!seen.has(p.toLowerCase()) && merged.length < 25) {
          merged.push(p);
          seen.add(p.toLowerCase());
        }
      }
      return merged;
    });
    setDraft("");
  };

  const onKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" || e.key === ",") {
      e.preventDefault();
      addFromDraft();
    } else if (e.key === "Backspace" && draft === "" && titles.length > 0) {
      setTitles((prev) => prev.slice(0, -1));
    }
  };

  const removeTitle = (t: string) => {
    setTitles((prev) => prev.filter((x) => x !== t));
  };

  const applyPreset = (presetTitles: string[]) => {
    setTitles((prev) => {
      const seen = new Set(prev.map((t) => t.toLowerCase()));
      const merged = [...prev];
      for (const p of presetTitles) {
        if (!seen.has(p.toLowerCase()) && merged.length < 25) {
          merged.push(p);
          seen.add(p.toLowerCase());
        }
      }
      return merged;
    });
  };

  const handleConfirm = async () => {
    // Inclui draft pendente se o usuário esqueceu de pressionar Enter
    const pending = parseInput(draft);
    const finalTitles = [...titles];
    const seen = new Set(finalTitles.map((t) => t.toLowerCase()));
    for (const p of pending) {
      if (!seen.has(p.toLowerCase()) && finalTitles.length < 25) {
        finalTitles.push(p);
        seen.add(p.toLowerCase());
      }
    }
    await onConfirm(finalTitles.length > 0 ? finalTitles : undefined);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
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

            {/* Custom titles input */}
            {preview.eligible && (
              <div className="space-y-2 rounded-md border bg-background p-3">
                <div className="flex items-center justify-between">
                  <Label className="text-xs font-semibold uppercase tracking-wide">
                    Cargos para buscar <span className="text-muted-foreground normal-case font-normal">(opcional)</span>
                  </Label>
                  {titles.length > 0 && (
                    <button
                      type="button"
                      onClick={() => setTitles([])}
                      className="text-[11px] text-muted-foreground hover:text-foreground"
                    >
                      Limpar
                    </button>
                  )}
                </div>

                <div className="flex flex-wrap gap-1">
                  {PRESETS.map((p) => (
                    <button
                      key={p.label}
                      type="button"
                      onClick={() => applyPreset(p.titles)}
                      className="text-[11px] px-2 py-0.5 rounded-full border bg-muted/40 hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
                    >
                      + {p.label}
                    </button>
                  ))}
                </div>

                {titles.length > 0 && (
                  <div className="flex flex-wrap gap-1.5">
                    {titles.map((t) => (
                      <Badge key={t} variant="secondary" className="gap-1 pr-1 font-normal">
                        {t}
                        <button
                          type="button"
                          onClick={() => removeTitle(t)}
                          className="rounded-full hover:bg-background/60 p-0.5"
                        >
                          <X className="h-3 w-3" />
                        </button>
                      </Badge>
                    ))}
                  </div>
                )}

                <div className="flex gap-1.5">
                  <Input
                    value={draft}
                    onChange={(e) => setDraft(e.target.value)}
                    onKeyDown={onKeyDown}
                    placeholder="ex: gerente de marketing, analista de eventos…"
                    className="h-8 text-xs"
                    disabled={titles.length >= 25}
                  />
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={addFromDraft}
                    disabled={!draft.trim() || titles.length >= 25}
                    className="h-8 px-2"
                  >
                    <Plus className="h-3.5 w-3.5" />
                  </Button>
                </div>
                <p className="text-[10px] text-muted-foreground leading-tight">
                  Pressione Enter ou vírgula para adicionar. Vazio = busca decisores genéricos (CEO, Diretor, Gerente, Marketing, Sales…).
                </p>
              </div>
            )}

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
