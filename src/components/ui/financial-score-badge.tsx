import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Badge } from "@/components/ui/badge";
import { ShieldCheck, ShieldAlert, ShieldX, ShieldQuestion } from "lucide-react";
import { type LucideIcon } from "lucide-react";

interface ScoreFactors {
  total_receivables?: number;
  paid_count?: number;
  overdue_count?: number;
  payment_rate?: number;
  overdue_rate?: number;
  avg_dso_days?: number;
  max_days_overdue?: number;
  total_value_cents?: number;
  overdue_value_cents?: number;
}

interface FinancialScoreBadgeProps {
  score: number | null | undefined;
  riskLevel: string | null | undefined;
  factors?: ScoreFactors | Record<string, unknown> | null;
  compact?: boolean;
}

const riskConfig: Record<string, { label: string; color: string; icon: LucideIcon; bg: string }> = {
  low:      { label: "Baixo",   color: "text-emerald-700", icon: ShieldCheck, bg: "bg-emerald-50 border-emerald-200" },
  medium:   { label: "Médio",   color: "text-amber-700",   icon: ShieldAlert, bg: "bg-amber-50 border-amber-200" },
  high:     { label: "Alto",    color: "text-orange-700",  icon: ShieldX,     bg: "bg-orange-50 border-orange-200" },
  critical: { label: "Crítico", color: "text-red-700",     icon: ShieldX,     bg: "bg-red-50 border-red-200" },
};

export function FinancialScoreBadge({ score, riskLevel, factors, compact = false }: FinancialScoreBadgeProps) {
  if (score === null || score === undefined) {
    return (
      <Badge variant="outline" className="gap-1 text-muted-foreground">
        <ShieldQuestion className="h-3 w-3" />
        Sem score
      </Badge>
    );
  }

  const config = riskConfig[riskLevel || "medium"] || riskConfig.medium;
  const Icon = config.icon;

  const badge = (
    <Badge variant="outline" className={`gap-1 ${config.bg} ${config.color} border`}>
      <Icon className="h-3 w-3" />
      {compact ? score : `${score} · Risco ${config.label}`}
    </Badge>
  );

  const f = factors as ScoreFactors | null | undefined;
  if (!f || Object.keys(f).length === 0) return badge;

  const fmt = (cents: number) =>
    (cents / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>{badge}</TooltipTrigger>
        <TooltipContent side="bottom" className="max-w-xs p-3">
          <div className="space-y-2 text-xs">
            <p className="font-semibold text-sm">Score Financeiro: {score}/100</p>
            <p className={`font-medium ${config.color}`}>Risco: {config.label}</p>
            <hr className="border-border" />
            <div className="grid grid-cols-2 gap-x-4 gap-y-1">
              <span className="text-muted-foreground">Títulos totais:</span>
              <span>{f.total_receivables ?? "—"}</span>
              <span className="text-muted-foreground">Pagos:</span>
              <span>{f.paid_count ?? "—"}</span>
              <span className="text-muted-foreground">Vencidos:</span>
              <span>{f.overdue_count ?? "—"}</span>
              <span className="text-muted-foreground">Taxa pgto:</span>
              <span>{f.payment_rate ?? "—"}%</span>
              <span className="text-muted-foreground">DSO médio:</span>
              <span>{f.avg_dso_days ?? "—"} dias</span>
              <span className="text-muted-foreground">Maior atraso:</span>
              <span>{f.max_days_overdue ?? "—"} dias</span>
            </div>
            {(f.total_value_cents || f.overdue_value_cents) && (
              <>
                <hr className="border-border" />
                <div className="grid grid-cols-2 gap-x-4 gap-y-1">
                  <span className="text-muted-foreground">Valor total:</span>
                  <span>{fmt(f.total_value_cents || 0)}</span>
                  <span className="text-muted-foreground">Valor vencido:</span>
                  <span className="text-red-600">{fmt(f.overdue_value_cents || 0)}</span>
                </div>
              </>
            )}
          </div>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
