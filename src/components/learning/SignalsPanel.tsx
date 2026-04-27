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
            {items.map((s) => (
              <li
                key={s.id}
                className="flex items-center justify-between rounded-lg border border-border p-3"
              >
                <div>
                  <div className="text-sm font-medium text-foreground">
                    {s.signal_value}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {s.signal_type} · {s.occurrences} ocorrências · conf{" "}
                    {(s.confidence * 100).toFixed(0)}%
                  </div>
                </div>
                <Badge
                  variant={variant === "top" ? "default" : "destructive"}
                  className="tabular-nums"
                >
                  {s.impact_score > 0 ? "+" : ""}
                  {Number(s.impact_score).toFixed(1)}
                </Badge>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
