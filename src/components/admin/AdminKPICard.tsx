import { LucideIcon, TrendingUp, TrendingDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { Card } from "@/components/ui/card";

interface AdminKPICardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  icon: LucideIcon;
  trend?: {
    value: number;
    label: string;
  };
  variant?: "default" | "success" | "warning" | "danger" | "info";
  loading?: boolean;
}

const variantStyles = {
  default: {
    iconBg: "bg-primary/10",
    iconColor: "text-primary",
  },
  success: {
    iconBg: "bg-emerald-500/10",
    iconColor: "text-emerald-500",
  },
  warning: {
    iconBg: "bg-amber-500/10",
    iconColor: "text-amber-500",
  },
  danger: {
    iconBg: "bg-destructive/10",
    iconColor: "text-destructive",
  },
  info: {
    iconBg: "bg-blue-500/10",
    iconColor: "text-blue-500",
  },
};

export function AdminKPICard({
  title,
  value,
  subtitle,
  icon: Icon,
  trend,
  variant = "default",
  loading = false,
}: AdminKPICardProps) {
  const styles = variantStyles[variant];

  if (loading) {
    return (
      <Card className="p-5 animate-pulse">
        <div className="flex items-start justify-between">
          <div className="space-y-3 flex-1">
            <div className="h-4 bg-muted rounded w-24" />
            <div className="h-8 bg-muted rounded w-32" />
            <div className="h-3 bg-muted rounded w-20" />
          </div>
          <div className="h-10 w-10 bg-muted rounded-xl" />
        </div>
      </Card>
    );
  }

  return (
    <Card className="p-5 hover:shadow-lg transition-shadow border-border/50">
      <div className="flex items-start justify-between">
        <div className="space-y-1">
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
            {title}
          </p>
          <p className="text-2xl font-bold tracking-tight">{value}</p>
          {(subtitle || trend) && (
            <div className="flex items-center gap-2">
              {trend && (
                <span className={cn(
                  "flex items-center gap-0.5 text-xs font-medium",
                  trend.value >= 0 ? "text-emerald-500" : "text-destructive"
                )}>
                  {trend.value >= 0 ? (
                    <TrendingUp className="h-3 w-3" />
                  ) : (
                    <TrendingDown className="h-3 w-3" />
                  )}
                  {Math.abs(trend.value)}%
                </span>
              )}
              {subtitle && (
                <span className="text-xs text-muted-foreground">{subtitle}</span>
              )}
            </div>
          )}
        </div>
        <div className={cn("p-2.5 rounded-xl", styles.iconBg)}>
          <Icon className={cn("h-5 w-5", styles.iconColor)} />
        </div>
      </div>
    </Card>
  );
}
