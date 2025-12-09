import { motion } from "framer-motion";
import { useFinanceDashboard } from "@/hooks/useFinanceDashboard";
import { FinanceKPICards } from "./FinanceKPICards";
import { RevenueChart } from "./RevenueChart";
import { OTEOverview } from "./OTEOverview";
import { ContractsOverview } from "./ContractsOverview";
import { ForecastSummary } from "./ForecastSummary";
import { DashboardHeader } from "../shared/DashboardHeader";
import { 
  DashboardHeaderSkeleton, 
  KPIGridSkeleton, 
  ChartCardSkeleton 
} from "../shared/ShimmerSkeleton";
import { AlertCircle, RefreshCcw } from "lucide-react";
import { Button } from "@/components/ui/button";

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.1,
    },
  },
};

const sectionVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: { 
    opacity: 1, 
    y: 0,
    transition: { duration: 0.5 }
  },
};

export function FinanceDashboard() {
  const { data, isLoading, error, refetch } = useFinanceDashboard();

  if (isLoading) {
    return <FinanceDashboardSkeleton />;
  }

  if (error || !data) {
    return (
      <motion.div 
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="flex flex-col items-center justify-center h-96 text-center"
      >
        <div className="p-4 rounded-full bg-destructive/10 mb-4">
          <AlertCircle className="h-10 w-10 text-destructive" />
        </div>
        <h3 className="text-lg font-semibold mb-2">Erro ao carregar dashboard</h3>
        <p className="text-sm text-muted-foreground mb-4 max-w-md">
          Não foi possível carregar os dados financeiros. Tente novamente.
        </p>
        <Button onClick={() => refetch()} variant="outline" className="gap-2">
          <RefreshCcw className="h-4 w-4" />
          Tentar novamente
        </Button>
      </motion.div>
    );
  }

  return (
    <motion.div
      variants={containerVariants}
      initial="hidden"
      animate="visible"
      className="space-y-6 max-w-7xl mx-auto"
    >
      {/* Header */}
      <DashboardHeader
        role="finance"
        title="Painel Financeiro"
        subtitle="Visão consolidada"
      />

      {/* KPI Cards */}
      <motion.div variants={sectionVariants}>
        <FinanceKPICards data={data.kpis} />
      </motion.div>

      {/* Charts Row */}
      <motion.div variants={sectionVariants} className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <RevenueChart data={data.revenueHistory} />
        <ForecastSummary data={data.forecast} />
      </motion.div>

      {/* Details Row */}
      <motion.div variants={sectionVariants} className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <ContractsOverview data={data.contracts} />
        <OTEOverview data={data.ote} />
      </motion.div>
    </motion.div>
  );
}

function FinanceDashboardSkeleton() {
  return (
    <div className="space-y-6 max-w-7xl mx-auto animate-fade-in">
      <DashboardHeaderSkeleton />
      
      <div className="grid grid-cols-4 gap-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="h-28 rounded-xl bg-muted/30 animate-pulse" />
        ))}
      </div>
      
      <div className="grid grid-cols-2 gap-4">
        <ChartCardSkeleton />
        <ChartCardSkeleton />
      </div>
      
      <div className="grid grid-cols-2 gap-4">
        <ChartCardSkeleton />
        <ChartCardSkeleton />
      </div>
    </div>
  );
}
