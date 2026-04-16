import { motion } from "framer-motion";
import { useRepDashboard } from "@/hooks/useRepDashboard";
import { RepKPICards } from "./RepKPICards";
import { RepPipelineChart } from "./RepPipelineChart";
import { RepActivitiesChart } from "./RepActivitiesChart";
import { RepFunnelChart } from "./RepFunnelChart";
import { RepSmartLists } from "./RepSmartLists";
import { RepQuickActions } from "./RepQuickActions";
import { RepPACECard } from "./RepPACECard";
import { RepDailyActivities } from "./RepDailyActivities";
import { DashboardHeader } from "../shared/DashboardHeader";
import { VoltsWidget } from "../shared/VoltsWidget";
import { DailyVibeCheckWidget } from "@/components/vibe/DailyVibeCheckWidget";
import { HumanoidInsights } from "../owner/HumanoidInsights";
import { useRepInsights } from "@/hooks/useDashboardInsights";
import { 
  DashboardHeaderSkeleton, 
  KPIGridSkeleton, 
  ChartCardSkeleton,
  SmartListSkeleton 
} from "../shared/ShimmerSkeleton";
import { AlertCircle, RefreshCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { usePlanType } from "@/hooks/usePlanType";
import { RepDailySummary } from "./RepDailySummary";
import { PushNotificationOptIn } from "@/components/notifications/PushNotificationOptIn";

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

export function RepDashboard() {
  const { data, isLoading, error, refetch } = useRepDashboard();
  const { isAutonomous } = usePlanType();
  const insights = useRepInsights(data);

  if (isLoading) {
    return <RepDashboardSkeleton />;
  }

  if (error) {
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
          {error.message || "Não foi possível carregar os dados. Tente novamente."}
        </p>
        <Button onClick={() => refetch()} variant="outline" className="gap-2">
          <RefreshCcw className="h-4 w-4" />
          Tentar novamente
        </Button>
      </motion.div>
    );
  }

  if (!data) {
    return null;
  }

  return (
    <motion.div
      variants={containerVariants}
      initial="hidden"
      animate="visible"
      className="p-4 md:p-6 space-y-4 md:space-y-6"
    >
      {/* Premium Header */}
      <DashboardHeader
        role="sales"
        title="Meu Dashboard"
        subtitle="Suas vendas, sua performance"
      />

      {/* VOLTS Widget for Autonomous plans - Compact version */}
      {isAutonomous && (
        <motion.div variants={sectionVariants}>
          <VoltsWidget compact />
        </motion.div>
      )}

      {/* Daily Summary - Resumo do Dia */}
      <motion.div variants={sectionVariants}>
        <RepDailySummary />
      </motion.div>

      {/* KPI Cards */}
      <motion.div variants={sectionVariants}>
        <RepKPICards data={data} />
      </motion.div>

      {/* HUMANOID Insights */}
      <motion.div variants={sectionVariants}>
        <HumanoidInsights insights={insights} />
      </motion.div>

      {/* Daily Vibe Check - Vibe Selling */}
      <motion.div variants={sectionVariants}>
        <DailyVibeCheckWidget />
      </motion.div>

      {/* PACE Card - Personal target tracking */}
      <motion.div variants={sectionVariants}>
        <RepPACECard />
      </motion.div>

      {/* Daily Activities - Track daily work */}
      <motion.div variants={sectionVariants}>
        <RepDailyActivities />
      </motion.div>

      {/* Quick Actions */}
      <motion.div variants={sectionVariants}>
        <RepQuickActions />
      </motion.div>

      {/* Charts Row */}
      <motion.div variants={sectionVariants}>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <RepPipelineChart data={data.pipelineByStage} />
          <RepActivitiesChart data={data.weeklyActivities} />
          <RepFunnelChart data={data.funnelConversion} />
        </div>
      </motion.div>

      {/* Smart Lists */}
      <motion.div variants={sectionVariants}>
        <div className="flex items-center gap-2 mb-4">
          <h2 className="text-lg font-semibold">Listas Inteligentes</h2>
          <span className="text-xs text-muted-foreground bg-muted px-2 py-0.5 rounded-full">
            Priorizado por IA
          </span>
        </div>
        <RepSmartLists data={data} />
      </motion.div>
    </motion.div>
  );
}

function RepDashboardSkeleton() {
  return (
    <div className="space-y-4 md:space-y-6 animate-fade-in">
      <DashboardHeaderSkeleton />
      <KPIGridSkeleton count={6} />
      
      <div className="h-24 rounded-xl bg-muted/30" />
      
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <ChartCardSkeleton />
        <ChartCardSkeleton />
        <ChartCardSkeleton />
      </div>
      
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <SmartListSkeleton />
        <SmartListSkeleton />
        <SmartListSkeleton />
        <SmartListSkeleton />
      </div>
    </div>
  );
}
