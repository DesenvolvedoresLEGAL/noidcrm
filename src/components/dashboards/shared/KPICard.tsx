import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { LucideIcon } from "lucide-react";

export interface KPICardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  icon?: LucideIcon;
  iconColor?: string;
  trend?: {
    value: number | string;
    label?: string;
    isPositive?: boolean;
  };
  variant?: "default" | "success" | "warning" | "danger" | "primary";
  className?: string;
  onClick?: () => void;
}

const variantStyles = {
  default: "border-border",
  success: "border-l-4 border-l-green-500",
  warning: "border-l-4 border-l-yellow-500",
  danger: "border-l-4 border-l-red-500",
  primary: "border-l-4 border-l-primary",
};

export function KPICard({
  title,
  value,
  subtitle,
  icon: Icon,
  iconColor,
  trend,
  variant = "default",
  className,
  onClick,
}: KPICardProps) {
  const formatTrendValue = (val: number | string) => {
    if (typeof val === 'number') {
      return `${val >= 0 ? '↑' : '↓'} ${Math.abs(val)}%`;
    }
    return val;
  };

  return (
    <Card 
      className={cn(
        "transition-all hover:shadow-md",
        variantStyles[variant],
        onClick && "cursor-pointer hover:bg-accent/50",
        className
      )}
      onClick={onClick}
    >
      <CardContent className="p-4">
        <div className="flex items-start justify-between">
          <div className="flex-1 min-w-0">
            <p className="text-sm text-muted-foreground truncate">{title}</p>
            <p className="text-2xl font-bold mt-1">{value}</p>
            {subtitle && (
              <p className="text-xs text-muted-foreground mt-1">{subtitle}</p>
            )}
            {trend && (
              <div className="flex items-center gap-1 mt-2">
                <span
                  className={cn(
                    "text-xs font-medium",
                    trend.isPositive ? "text-green-600" : "text-red-600"
                  )}
                >
                  {typeof trend.value === 'number' ? formatTrendValue(trend.value) : trend.value}
                </span>
                {trend.label && (
                  <span className="text-xs text-muted-foreground">
                    {trend.label}
                  </span>
                )}
              </div>
            )}
          </div>
          {Icon && (
            <div className={cn("p-2 rounded-lg", iconColor ? `${iconColor.replace('text-', 'bg-').replace('500', '500/10')}` : "bg-primary/10")}>
              <Icon className={cn("h-5 w-5", iconColor || "text-primary")} />
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
