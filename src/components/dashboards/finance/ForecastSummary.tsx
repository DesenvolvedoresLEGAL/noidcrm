import { motion } from "framer-motion";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { TrendingUp, TrendingDown, Minus, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatCurrencyFull } from "@/lib/i18n";

interface ForecastSummaryProps {
  data: {
    pessimistic: number;
    realistic: number;
    optimistic: number;
    bestCase: number;
    trend: "up" | "down" | "stable";
    trendPercent: number;
  };
}

export function ForecastSummary({ data }: ForecastSummaryProps) {
  const TrendIcon = data.trend === "up" ? TrendingUp : data.trend === "down" ? TrendingDown : Minus;
  const trendColor = data.trend === "up" ? "text-emerald-500" : data.trend === "down" ? "text-red-500" : "text-muted-foreground";

  const scenarios = [
    { label: "Pessimista", value: data.pessimistic, color: "text-red-500", bgColor: "bg-red-500" },
    { label: "Realista", value: data.realistic, color: "text-amber-500", bgColor: "bg-amber-500" },
    { label: "Otimista", value: data.optimistic, color: "text-emerald-500", bgColor: "bg-emerald-500" },
    { label: "Best Case", value: data.bestCase, color: "text-blue-500", bgColor: "bg-blue-500" },
  ];

  const maxValue = Math.max(...scenarios.map(s => s.value));

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.5 }}
    >
      <Card className="border-border/50 bg-gradient-to-br from-card/80 to-card/40 backdrop-blur-xl">
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center justify-between text-base font-semibold">
            <div className="flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-purple-500" />
              Forecast Financeiro
            </div>
            <div className={cn("flex items-center gap-1 text-sm", trendColor)}>
              <TrendIcon className="h-4 w-4" />
              <span>{data.trendPercent > 0 ? "+" : ""}{data.trendPercent.toFixed(1)}%</span>
            </div>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Scenario Bars */}
          <div className="space-y-3">
            {scenarios.map((scenario) => (
              <div key={scenario.label} className="space-y-1">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">{scenario.label}</span>
                  <span className={cn("font-bold tabular-nums", scenario.color)}>
                    {formatCurrencyFull(scenario.value)}
                  </span>
                </div>
                <div className="h-2 bg-muted/30 rounded-full overflow-hidden">
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: `${maxValue > 0 ? (scenario.value / maxValue) * 100 : 0}%` }}
                    transition={{ delay: 0.3, duration: 0.5 }}
                    className={cn("h-full rounded-full", scenario.bgColor)}
                  />
                </div>
              </div>
            ))}
          </div>

          {/* Highlight */}
          <div className="p-3 rounded-lg bg-primary/5 border border-primary/20">
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Projeção Realista</span>
              <span className="text-xl font-bold text-primary">
                {formatCurrencyFull(data.realistic)}
              </span>
            </div>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
}
