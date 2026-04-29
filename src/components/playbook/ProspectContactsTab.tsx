import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Sparkles, Loader2, Star, Mail, Phone, Linkedin, Copy, CheckCircle2, AlertCircle } from "lucide-react";
import { toast } from "sonner";
import { useEnrichedContacts } from "@/hooks/useEnrichedContacts";
import { ApolloConfirmModal } from "./enrichment/ApolloConfirmModal";
import { ContactsQualityPanel } from "./enrichment/ContactsQualityPanel";
import { MergedContactsAccordion } from "./enrichment/MergedContactsAccordion";
import { useQuery } from "@tanstack/react-query";
import { listMergedContacts } from "@/services/enrichment/apolloService";
import { cn } from "@/lib/utils";

interface ProspectContactsTabProps {
  prospectId: string;
  decisionMakerFound?: boolean | null;
  enrichmentStatus?: string | null;
  contactScore?: number | null;
}

function copy(text: string, label: string) {
  navigator.clipboard.writeText(text);
  toast.success(`${label} copiado`);
}

function ConfidenceBadge({ score }: { score: number | null }) {
  if (score == null) return null;
  const tone =
    score >= 70 ? "bg-green-500/10 text-green-600 border-green-500/20" :
    score >= 40 ? "bg-amber-500/10 text-amber-600 border-amber-500/20" :
    "bg-red-500/10 text-red-600 border-red-500/20";
  return <Badge variant="outline" className={cn("text-xs font-bold", tone)}>{score}</Badge>;
}

function SeniorityBadge({ s }: { s: string | null }) {
  if (!s) return null;
  const map: Record<string, { label: string; cls: string }> = {
    c_level: { label: "C-Level", cls: "bg-purple-500/10 text-purple-600 border-purple-500/20" },
    vp: { label: "VP", cls: "bg-blue-500/10 text-blue-600 border-blue-500/20" },
    director: { label: "Diretor", cls: "bg-cyan-500/10 text-cyan-600 border-cyan-500/20" },
    manager: { label: "Gerente", cls: "bg-emerald-500/10 text-emerald-600 border-emerald-500/20" },
    ic: { label: "IC", cls: "bg-muted text-muted-foreground" },
  };
  const cfg = map[s] ?? { label: s, cls: "bg-muted text-muted-foreground" };
  return <Badge variant="outline" className={cn("text-[10px]", cfg.cls)}>{cfg.label}</Badge>;
}

export function ProspectContactsTab({
  prospectId,
  decisionMakerFound,
  enrichmentStatus,
  contactScore,
}: ProspectContactsTabProps) {
  const { data: contacts = [], isLoading, enrich, setPrimary } = useEnrichedContacts(prospectId);
  const [confirmOpen, setConfirmOpen] = useState(false);

  const handleConfirm = async () => {
    try {
      const res = await enrich.mutateAsync();
      if (res.status === "skipped") {
        toast.info(`Apollo pulou: ${res.reason ?? "não elegível"}`);
      } else if (res.status === "done" || res.status === "partial") {
        toast.success(`${res.contacts_found ?? 0} contato(s) encontrado(s) (${res.decision_makers_found ?? 0} decisor(es))`);
      } else {
        toast.error(`Apollo falhou: ${res.reason ?? res.status}`);
      }
    } catch (e: any) {
      toast.error(e?.message || "Erro ao chamar Apollo");
    }
  };

  return (
    <div className="space-y-4 py-4">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2 flex-wrap">
          {decisionMakerFound && (
            <Badge className="gap-1 bg-emerald-500/10 text-emerald-600 border-emerald-500/30">
              🎯 Decisor encontrado
            </Badge>
          )}
          {contactScore != null && (
            <Badge variant="outline">Top score: <span className="ml-1 font-bold">{contactScore}</span></Badge>
          )}
          {enrichmentStatus && (
            <Badge variant="secondary" className="text-[10px]">{enrichmentStatus}</Badge>
          )}
        </div>
        <Button
          size="sm"
          variant="outline"
          onClick={() => setConfirmOpen(true)}
          disabled={enrich.isPending}
          className="gap-1.5"
        >
          {enrich.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}
          Enriquecer (Apollo)
        </Button>
      </div>

      <ApolloConfirmModal
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        prospectId={prospectId}
        onConfirm={handleConfirm}
        isRunning={enrich.isPending}
      />

      {isLoading && <div className="text-sm text-muted-foreground py-4 text-center">Carregando contatos…</div>}

      {!isLoading && contacts.length === 0 && (
        <Card className="p-6 text-center text-sm text-muted-foreground border-dashed">
          <AlertCircle className="h-5 w-5 mx-auto mb-2 opacity-50" />
          Nenhum decisor mapeado ainda. Use <strong>Enriquecer (Apollo)</strong> para buscar contatos.
          <div className="text-xs mt-2 opacity-75">
            Requer: quality_label = high_confidence, priority_score ≥ 180.
          </div>
        </Card>
      )}

      {contacts.map((c) => (
        <Card key={c.id} className={cn("p-3 space-y-2", c.is_primary && "ring-1 ring-primary/40 bg-primary/5")}>
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <div className="flex items-center gap-1.5 flex-wrap">
                <span className="font-semibold text-sm truncate">{c.full_name || "—"}</span>
                {c.is_primary && <Star className="h-3.5 w-3.5 fill-amber-400 text-amber-400" />}
                <SeniorityBadge s={c.seniority} />
              </div>
              {c.role_title && (
                <div className="text-xs text-muted-foreground mt-0.5 truncate">{c.role_title}</div>
              )}
            </div>
            <ConfidenceBadge score={c.confidence_score} />
          </div>

          <div className="space-y-1 text-xs">
            {c.email && (
              <button
                onClick={() => copy(c.email!, "Email")}
                className="flex items-center gap-1.5 w-full hover:bg-muted/50 rounded px-1 py-0.5 -mx-1 group"
              >
                <Mail className="h-3 w-3 text-muted-foreground" />
                <span className="truncate font-mono">{c.email}</span>
                {c.email_status === "verified" && <CheckCircle2 className="h-3 w-3 text-green-600" />}
                <Copy className="h-3 w-3 ml-auto opacity-0 group-hover:opacity-50" />
              </button>
            )}
            {c.phone && (
              <button
                onClick={() => copy(c.phone!, "Telefone")}
                className="flex items-center gap-1.5 w-full hover:bg-muted/50 rounded px-1 py-0.5 -mx-1 group"
              >
                <Phone className="h-3 w-3 text-muted-foreground" />
                <span className="font-mono">{c.phone}</span>
                <Copy className="h-3 w-3 ml-auto opacity-0 group-hover:opacity-50" />
              </button>
            )}
            {c.linkedin_url && (
              <a
                href={c.linkedin_url}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1.5 hover:text-primary px-1 py-0.5 -mx-1"
              >
                <Linkedin className="h-3 w-3" />
                <span className="truncate">LinkedIn</span>
              </a>
            )}
          </div>

          {!c.is_primary && (
            <div className="flex justify-end pt-1">
              <Button
                size="sm"
                variant="ghost"
                className="h-6 text-[11px] gap-1"
                onClick={() => setPrimary.mutate(c.id)}
                disabled={setPrimary.isPending}
              >
                <Star className="h-3 w-3" /> Marcar principal
              </Button>
            </div>
          )}
        </Card>
      ))}
    </div>
  );
}
