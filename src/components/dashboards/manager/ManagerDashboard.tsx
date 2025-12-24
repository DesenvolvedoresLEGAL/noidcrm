import { motion } from "framer-motion";
import { useManagerDashboard } from "@/hooks/useManagerDashboard";
import { ManagerKPICards } from "./ManagerKPICards";
import { TeamRankingTable } from "./TeamRankingTable";
import { TeamFunnelChart } from "./TeamFunnelChart";
import { ActivityHeatmap } from "./ActivityHeatmap";
import { LossReasonsChart } from "./LossReasonsChart";
import { PipelineAgingChart } from "./PipelineAgingChart";
import { LeadsByOriginChart } from "./LeadsByOriginChart";
import { ManagerSmartLists } from "./ManagerSmartLists";
import { BehaviorMonitor } from "./BehaviorMonitor";
import { DashboardHeader } from "../shared/DashboardHeader";
import { VibeAnalyticsDashboard } from "@/components/vibe/VibeAnalyticsDashboard";
import { 
  DashboardHeaderSkeleton, 
  KPIGridSkeleton, 
  ChartCardSkeleton,
  SmartListSkeleton 
} from "../shared/ShimmerSkeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { AlertCircle, BarChart3, Users, Brain, Sparkles, RefreshCcw } from "lucide-react";
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

export function ManagerDashboard() {
  const { data, isLoading, error, refetch } = useManagerDashboard();

  if (isLoading) {
    return <ManagerDashboardSkeleton />;
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
      className="space-y-6 max-w-7xl mx-auto"
    >
      {/* Premium Header */}
      <DashboardHeader
        role="manager"
        title="Dashboard do Gerente"
        subtitle="Performance do time"
      />

      {/* KPI Cards */}
      <motion.div variants={sectionVariants}>
        <ManagerKPICards data={data} />
      </motion.div>

      {/* Tabs for different views */}
      <motion.div variants={sectionVariants}>
        <Tabs defaultValue="overview" className="space-y-4">
          <TabsList className="bg-muted/50 p-1">
            <TabsTrigger value="overview" className="gap-2 data-[state=active]:bg-background">
              <BarChart3 className="h-4 w-4" />
              Visão Geral
            </TabsTrigger>
            <TabsTrigger value="team" className="gap-2 data-[state=active]:bg-background">
              <Users className="h-4 w-4" />
              Equipe
            </TabsTrigger>
            <TabsTrigger value="coaching" className="gap-2 data-[state=active]:bg-background">
              <Brain className="h-4 w-4" />
              Coaching IA
            </TabsTrigger>
            <TabsTrigger value="vibe" className="gap-2 data-[state=active]:bg-background">
              <Sparkles className="h-4 w-4" />
              Vibe Selling
            </TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="space-y-4 mt-4">
            {/* Charts Row 1 */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
              <TeamFunnelChart data={data.teamFunnel} />
              <LossReasonsChart data={data.lossReasons} />
              <PipelineAgingChart data={data.pipelineAging} />
            </div>

            {/* Charts Row 2 */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <TeamRankingTable members={data.teamMembers} />
              <LeadsByOriginChart data={data.leadsByOrigin} />
            </div>
          </TabsContent>

          <TabsContent value="team" className="space-y-4 mt-4">
            {/* Activity Heatmap */}
            <ActivityHeatmap data={data.activityHeatmap} />

            {/* Behavior Monitor */}
            <BehaviorMonitor data={data.behaviorMonitor} />
          </TabsContent>

          <TabsContent value="coaching" className="space-y-4 mt-4">
            {/* Smart Lists */}
            <ManagerSmartLists data={data} />
          </TabsContent>

          <TabsContent value="vibe" className="space-y-4 mt-4">
            {/* Vibe Analytics Dashboard */}
            <VibeAnalyticsDashboard />
          </TabsContent>
        </Tabs>
      </motion.div>
    </motion.div>
  );
}

function ManagerDashboardSkeleton() {
  return (
    <div className="space-y-6 max-w-7xl mx-auto animate-fade-in">
      <DashboardHeaderSkeleton />
      <KPIGridSkeleton count={6} />
      
      <div className="h-12 rounded-lg bg-muted/30 w-96" />
      
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <ChartCardSkeleton />
        <ChartCardSkeleton />
        <ChartCardSkeleton />
      </div>
      
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <SmartListSkeleton />
        <ChartCardSkeleton />
      </div>
    </div>
  );
}
