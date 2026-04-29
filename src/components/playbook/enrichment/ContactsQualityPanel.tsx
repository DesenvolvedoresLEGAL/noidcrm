import { Card } from "@/components/ui/card";
import type { EnrichedContact } from "@/services/enrichment/apolloService";

interface Props {
  contacts: EnrichedContact[];
  mergedCount: number;
}

const DM_SENIORITY = new Set(["c_level", "vp", "director"]);

export function ContactsQualityPanel({ contacts, mergedCount }: Props) {
  const total = contacts.length;
  const decisionMakers = contacts.filter((c) => DM_SENIORITY.has(c.seniority ?? "")).length;
  const verifiedEmails = contacts.filter((c) => c.email_status === "verified").length;
  const scores = contacts.map((c) => c.confidence_score ?? 0).filter((s) => s > 0);
  const avgScore = scores.length ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : 0;

  const items = [
    { label: "Contatos", value: total, hint: "ativos" },
    { label: "Decisores", value: decisionMakers, hint: "C-Level / VP / Diretor" },
    { label: "E-mails válidos", value: verifiedEmails, hint: "verificados" },
    { label: "Score médio", value: avgScore || "—", hint: "0-100" },
    { label: "Duplicados", value: mergedCount, hint: "resolvidos" },
  ];

  return (
    <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
      {items.map((it) => (
        <Card key={it.label} className="p-2.5">
          <div className="text-[10px] uppercase tracking-wide text-muted-foreground">{it.label}</div>
          <div className="text-lg font-semibold leading-none mt-1">{it.value}</div>
          <div className="text-[10px] text-muted-foreground mt-0.5">{it.hint}</div>
        </Card>
      ))}
    </div>
  );
}
