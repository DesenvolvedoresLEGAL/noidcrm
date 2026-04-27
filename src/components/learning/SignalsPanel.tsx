import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useLearningSignals } from "@/hooks/useLearningSignals";
import { Skeleton } from "@/components/ui/skeleton";
import { TrendingUp, TrendingDown } from "lucide-react";

interface Props {
  organizationId: string | undefined;
  variant: "top" | "worst";
  limit?: number;
}

export function SignalsPanel({ organizationId, variant, limit = 10 }: Props) {
  const { data, isLoading } = useLearningSignals(organizationId, { minConfidence: 0.2 });

  if (isLoading) return <Skeleton className="h-80 w-full" />;

  const filtered = (data ?? []).filter((s) =>
    variant === "top" ? s.impact_score > 0 : s.impact_score < 0,
  );
  const sorted =
    variant === "top"
      ? filtered.sort((a, b) => b.impact_score - a.impact_score)
      : filtered.sort((a, b) => a.impact_score - b.impact_score);
  const items = sorted.slice(0, limit);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          {variant === "top" ? (
            <TrendingUp className="h-5 w-5 text-emerald-500" />
          ) : (
            <TrendingDown className="h-5 w-5 text-rose-500" />
          )}
          {variant === "top" ? "Sinais Positivos" : "Sinais Negativos"}
        </CardTitle>
      </CardHeader>
      <CardContent>
        {items.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Sem sinais com confiança suficiente ainda. Mínimo de 20 ocorrências.
          </p>
        ) : (
          <ul className="space-y-2">
            {items.map((s) => {
              const breakdown = (s.attribution_breakdown ?? {}) as any;
              const topOf = (dim: any) => {
                if (!dim) return null;
                const entries = Object.entries(dim) as [string, any][];
                if (entries.length === 0) return null;
                entries.sort((a, b) => {
                  const aScore = (a[1].pos ?? 0) - (a[1].neg ?? 0);
                  const bScore = (b[1].pos ?? 0) - (b[1].neg ?? 0);
                  return variant === "top" ? bScore - aScore : aScore - bScore;
                });
                return entries[0];
              };
              const topTemplate = topOf(breakdown.by_template);
              const topPlaybook = topOf(breakdown.by_playbook);
              const topChannel = topOf(breakdown.by_channel);

              return (
                <li
                  key={s.id}
                  className="rounded-lg border border-border p-3 space-y-1.5"
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="min-w-0">
                      <div className="text-sm font-medium text-foreground truncate">
                        {s.signal_value}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {s.signal_type} · {s.occurrences} ocorrências · conf{" "}
                        {(s.confidence * 100).toFixed(0)}%
                      </div>
                    </div>
                    <Badge
                      variant={variant === "top" ? "default" : "destructive"}
                      className="tabular-nums shrink-0"
                    >
                      {s.impact_score > 0 ? "+" : ""}
                      {Number(s.impact_score).toFixed(1)}
                    </Badge>
                  </div>
                  {(topTemplate || topPlaybook || topChannel) && (
                    <div className="flex flex-wrap gap-1.5 text-[10px] text-muted-foreground">
                      {topTemplate && (
                        <span className="px-1.5 py-0.5 rounded border border-border">
                          template: <code className="font-mono">{topTemplate[0]}</code> ({topTemplate[1].pos}/{topTemplate[1].neg})
                        </span>
                      )}
                      {topPlaybook && (
                        <span className="px-1.5 py-0.5 rounded border border-border">
                          playbook: <code className="font-mono">{String(topPlaybook[0]).slice(0, 8)}</code> ({topPlaybook[1].pos}/{topPlaybook[1].neg})
                        </span>
                      )}
                      {topChannel && (
                        <span className="px-1.5 py-0.5 rounded border border-border">
                          canal: {topChannel[0]} ({topChannel[1].pos}/{topChannel[1].neg})
                        </span>
                      )}
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
