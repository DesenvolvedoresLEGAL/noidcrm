import { motion } from "framer-motion";
import { Card } from "@/components/ui/card";
import { DollarSign, TrendingUp, FileText, Target } from "lucide-react";
import { cn } from "@/lib/utils";

interface FinanceKPICardsProps {
  data: {
    monthlyRevenue: number;
    weightedPipeline: number;
    pendingProposals: number;
    goalProgress: number;
  };
}

const cardVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: (i: number) => ({
    opacity: 1,
    y: 0,
    transition: { delay: i * 0.1, duration: 0.4 },
  }),
};

export function FinanceKPICards({ data }: FinanceKPICardsProps) {
  const kpis = [
    {
      label: "Faturamento do Mês",
      value: data.monthlyRevenue,
      icon: DollarSign,
      color: "text-emerald-500",
      bgColor: "from-emerald-500/10 to-emerald-500/5",
      format: "currency",
    },
    {
      label: "Pipeline Ponderado",
      value: data.weightedPipeline,
      icon: TrendingUp,
      color: "text-blue-500",
      bgColor: "from-blue-500/10 to-blue-500/5",
      format: "currency",
    },
    {
      label: "Propostas Pendentes",
      value: data.pendingProposals,
      icon: FileText,
      color: "text-amber-500",
      bgColor: "from-amber-500/10 to-amber-500/5",
      format: "currency",
    },
    {
      label: "Meta vs Realizado",
      value: data.goalProgress,
      icon: Target,
      color: data.goalProgress >= 100 ? "text-emerald-500" : "text-orange-500",
      bgColor: data.goalProgress >= 100 ? "from-emerald-500/10 to-emerald-500/5" : "from-orange-500/10 to-orange-500/5",
      format: "percent",
    },
  ];

  const formatValue = (value: number, format: string) => {
    if (format === "currency") {
      return `R$ ${value.toLocaleString("pt-BR", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
    }
    if (format === "percent") {
      return `${value.toFixed(1)}%`;
    }
    return value.toString();
  };

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
      {kpis.map((kpi, index) => {
        const Icon = kpi.icon;
        return (
          <motion.div
            key={kpi.label}
            custom={index}
            variants={cardVariants}
            initial="hidden"
            animate="visible"
          >
            <Card className={cn(
              "relative overflow-hidden p-5 border-border/50",
              "bg-gradient-to-br backdrop-blur-xl",
              kpi.bgColor
            )}>
              <div className="flex items-start justify-between">
                <div className="space-y-1">
                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                    {kpi.label}
                  </p>
                  <p className="text-2xl font-bold tracking-tight">
                    {formatValue(kpi.value, kpi.format)}
                  </p>
                </div>
                <div className={cn("p-2.5 rounded-xl", kpi.bgColor)}>
                  <Icon className={cn("h-5 w-5", kpi.color)} />
                </div>
              </div>
            </Card>
          </motion.div>
        );
      })}
    </div>
  );
}
