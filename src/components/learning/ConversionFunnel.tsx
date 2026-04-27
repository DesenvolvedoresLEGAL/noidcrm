import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useConversionFunnel } from "@/hooks/useLifecycleTimeline";
import { Skeleton } from "@/components/ui/skeleton";

interface Props {
  organizationId: string | undefined;
}

const STAGES = [
  { key: "enrichment_completed", label: "Leads Enriquecidos" },
  { key: "decision_executed", label: "Decisões Executadas" },
  { key: "email_sent", label: "Emails Enviados" },
  { key: "email_replied", label: "Respostas" },
  { key: "meeting_booked", label: "Reuniões" },
  { key: "deal_won", label: "Wins" },
];

export function ConversionFunnel({ organizationId }: Props) {
  const { data: counts, isLoading } = useConversionFunnel(organizationId, 30);

  if (isLoading) return <Skeleton className="h-64 w-full" />;

  const c = counts ?? {};
  const max = Math.max(...STAGES.map((s) => c[s.key] ?? 0), 1);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Funil de Conversão (30 dias)</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {STAGES.map((s, i) => {
          const value = c[s.key] ?? 0;
          const widthPct = (value / max) * 100;
          const prevValue = i > 0 ? c[STAGES[i - 1].key] ?? 0 : null;
          const conversionPct =
            prevValue && prevValue > 0 ? ((value / prevValue) * 100).toFixed(1) : null;
          return (
            <div key={s.key} className="space-y-1">
              <div className="flex items-center justify-between text-sm">
                <span className="font-medium text-foreground">{s.label}</span>
                <span className="text-muted-foreground tabular-nums">
                  {value.toLocaleString()}{" "}
                  {conversionPct && (
                    <span className="text-xs text-muted-foreground/70 ml-2">
                      ({conversionPct}%)
                    </span>
                  )}
                </span>
              </div>
              <div className="h-3 w-full rounded-full bg-muted overflow-hidden">
                <div
                  className="h-full rounded-full bg-primary transition-all"
                  style={{ width: `${widthPct}%` }}
                />
              </div>
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}
