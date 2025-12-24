import { motion } from "framer-motion";
import { cn } from "@/lib/utils";
import { LucideIcon, TrendingUp, TrendingDown, Info } from "lucide-react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

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
  index?: number;
  /** Tooltip explicando a metodologia de cálculo do KPI */
  methodology?: string;
  /** Timestamp de quando os dados foram atualizados */
  lastUpdated?: string;
  /** Badge indicando fonte do dado: 'real' | 'calculated' | 'projected' */
  dataSource?: 'real' | 'calculated' | 'projected';
}

const variantStyles = {
  default: {
    border: "border-border/50",
    bg: "from-card/80 to-card/40",
    iconBg: "bg-muted",
    iconColor: "text-muted-foreground",
    glow: "",
  },
  success: {
    border: "border-green-500/30",
    bg: "from-green-500/10 to-emerald-500/5",
    iconBg: "bg-green-500/15",
    iconColor: "text-green-600 dark:text-green-400",
    glow: "hover:shadow-[0_0_30px_-5px_rgba(34,197,94,0.3)]",
  },
  warning: {
    border: "border-amber-500/30",
    bg: "from-amber-500/10 to-yellow-500/5",
    iconBg: "bg-amber-500/15",
    iconColor: "text-amber-600 dark:text-amber-400",
    glow: "hover:shadow-[0_0_30px_-5px_rgba(245,158,11,0.3)]",
  },
  danger: {
    border: "border-red-500/30",
    bg: "from-red-500/10 to-rose-500/5",
    iconBg: "bg-red-500/15",
    iconColor: "text-red-600 dark:text-red-400",
    glow: "hover:shadow-[0_0_30px_-5px_rgba(239,68,68,0.3)]",
  },
  primary: {
    border: "border-primary/30",
    bg: "from-primary/10 to-accent/5",
    iconBg: "bg-primary/15",
    iconColor: "text-primary",
    glow: "hover:shadow-[0_0_30px_-5px_hsl(var(--primary)/0.4)]",
  },
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
  index = 0,
  methodology,
  lastUpdated,
  dataSource,
}: KPICardProps) {
  const styles = variantStyles[variant];

  const formatTrendValue = (val: number | string) => {
    if (typeof val === "number") {
      return `${Math.abs(val)}%`;
    }
    return val;
  };

  const dataSourceLabel = {
    real: { text: 'Real', color: 'bg-emerald-500/20 text-emerald-600' },
    calculated: { text: 'Calculado', color: 'bg-blue-500/20 text-blue-600' },
    projected: { text: 'Projetado', color: 'bg-amber-500/20 text-amber-600' },
  };


  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ 
        duration: 0.4, 
        delay: index * 0.05,
        ease: [0.25, 0.46, 0.45, 0.94]
      }}
      whileHover={{ 
        y: -4,
        transition: { duration: 0.2 }
      }}
      className={cn(
        "group relative overflow-hidden rounded-xl border p-4",
        "bg-gradient-to-br backdrop-blur-xl",
        "transition-all duration-300",
        styles.border,
        styles.bg,
        styles.glow,
        onClick && "cursor-pointer",
        className
      )}
      onClick={onClick}
    >
      {/* Subtle shine effect */}
      <div className="absolute inset-0 bg-gradient-to-tr from-white/0 via-white/5 to-white/0 opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
      
      <div className="relative flex items-start justify-between">
        <div className="flex-1 min-w-0 space-y-1">
          <div className="flex items-center gap-1">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider truncate">
              {title}
            </p>
            {methodology && (
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger>
                    <Info className="h-3 w-3 text-muted-foreground/50 hover:text-muted-foreground transition-colors" />
                  </TooltipTrigger>
                  <TooltipContent side="top" className="max-w-xs">
                    <p className="text-xs">{methodology}</p>
                    {lastUpdated && (
                      <p className="text-xs text-muted-foreground mt-1">Atualizado: {lastUpdated}</p>
                    )}
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            )}
            {dataSource && (
              <span className={cn(
                "text-[10px] px-1.5 py-0.5 rounded-full font-medium",
                dataSourceLabel[dataSource].color
              )}>
                {dataSourceLabel[dataSource].text}
              </span>
            )}
          </div>
          <p className="text-2xl md:text-3xl font-bold tracking-tight">
            {value}
          </p>
          {subtitle && (
            <p className="text-xs text-muted-foreground truncate">{subtitle}</p>
          )}
          {trend && (
            <div className="flex items-center gap-1.5 pt-1">
              {trend.isPositive ? (
                <TrendingUp className="h-3.5 w-3.5 text-green-600 dark:text-green-400" />
              ) : (
                <TrendingDown className="h-3.5 w-3.5 text-red-600 dark:text-red-400" />
              )}
              <span
                className={cn(
                  "text-xs font-semibold",
                  trend.isPositive 
                    ? "text-green-600 dark:text-green-400" 
                    : "text-red-600 dark:text-red-400"
                )}
              >
                {typeof trend.value === "number"
                  ? formatTrendValue(trend.value)
                  : trend.value}
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
          <motion.div 
            className={cn(
              "p-2.5 rounded-xl transition-colors duration-300",
              styles.iconBg
            )}
            whileHover={{ scale: 1.1, rotate: 5 }}
            transition={{ type: "spring", stiffness: 400, damping: 17 }}
          >
            <Icon className={cn("h-5 w-5", iconColor || styles.iconColor)} />
          </motion.div>
        )}
      </div>
    </motion.div>
  );
}
