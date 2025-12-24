import { motion } from "framer-motion";
import { useAdminDashboard } from "@/hooks/useAdminDashboard";
import { AdminKPICards } from "./AdminKPICards";
import { AutomationFlowChart } from "./AutomationFlowChart";
import { FailureHistoryChart } from "./FailureHistoryChart";
import { VoltsConsumptionChart } from "./VoltsConsumptionChart";
import { LeadsByChannelChart } from "./LeadsByChannelChart";
import { SystemUsageChart } from "./SystemUsageChart";
import { AdminSmartLists } from "./AdminSmartLists";
import { AdminQuickLinks } from "./AdminQuickLinks";
import { DashboardHeader } from "../shared/DashboardHeader";
import { 
  DashboardHeaderSkeleton, 
  KPIGridSkeleton, 
  ChartCardSkeleton,
  SmartListSkeleton 
} from "../shared/ShimmerSkeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { AlertCircle, LayoutDashboard, Zap, Database, RefreshCcw } from "lucide-react";
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

export function AdminDashboard() {
  const { data, isLoading, error, refetch } = useAdminDashboard();

  if (isLoading) {
    return <AdminDashboardSkeleton />;
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
          Não foi possível carregar os dados. Tente novamente.
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
      className="space-y-4 md:space-y-6"
    >
      {/* Premium Header */}
      <DashboardHeader
        role="admin"
        title="Dashboard de Operações"
        subtitle="Governança & Automações"
      />

      {/* KPI Cards */}
      <motion.div variants={sectionVariants}>
        <AdminKPICards data={data} />
      </motion.div>

      {/* Tabs for different views */}
      <motion.div variants={sectionVariants}>
        <Tabs defaultValue="overview" className="space-y-4">
          <TabsList className="bg-muted/50 p-1">
            <TabsTrigger value="overview" className="gap-2 data-[state=active]:bg-background">
              <LayoutDashboard className="h-4 w-4" />
              Visão Geral
            </TabsTrigger>
            <TabsTrigger value="automations" className="gap-2 data-[state=active]:bg-background">
              <Zap className="h-4 w-4" />
              Automações
            </TabsTrigger>
            <TabsTrigger value="data-quality" className="gap-2 data-[state=active]:bg-background">
              <Database className="h-4 w-4" />
              Qualidade de Dados
            </TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="space-y-4 mt-4">
            {/* Quick Links */}
            <AdminQuickLinks />

            {/* Charts Row 1 */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <AutomationFlowChart data={data.automationFlow} />
              <FailureHistoryChart data={data.failureHistory} />
            </div>

            {/* Charts Row 2 */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
              <VoltsConsumptionChart data={data.voltsUsage.byOperation} total={data.voltsUsage.total} />
              <LeadsByChannelChart data={data.leadsByChannel} />
              <SystemUsageChart data={data.systemUsage.byRole} totalUsers={data.systemUsage.totalUsers} />
            </div>
          </TabsContent>

          <TabsContent value="automations" className="space-y-4 mt-4">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <AutomationFlowChart data={data.automationFlow} />
              <FailureHistoryChart data={data.failureHistory} />
            </div>
            
            {/* Automation execution stats */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              {data.automations.byStatus.map((status, i) => (
                <motion.div 
                  key={i} 
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.1 }}
                  className="p-4 rounded-xl bg-gradient-to-br from-muted/50 to-muted/30 border border-border/50"
                >
                  <p className="text-sm text-muted-foreground capitalize">{status.status}</p>
                  <p className="text-2xl font-bold">{status.count}</p>
                </motion.div>
              ))}
            </div>
          </TabsContent>

          <TabsContent value="data-quality" className="space-y-4 mt-4">
            {/* Smart Lists */}
            <AdminSmartLists data={data} />

            {/* Additional Charts */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <LeadsByChannelChart data={data.leadsByChannel} />
              <SystemUsageChart data={data.systemUsage.byRole} totalUsers={data.systemUsage.totalUsers} />
            </div>
          </TabsContent>
        </Tabs>
      </motion.div>
    </motion.div>
  );
}

function AdminDashboardSkeleton() {
  return (
    <div className="space-y-4 md:space-y-6 animate-fade-in">
      <DashboardHeaderSkeleton />
      <KPIGridSkeleton count={6} />
      
      <div className="h-12 rounded-lg bg-muted/30 w-96" />
      
      <div className="h-20 rounded-xl bg-muted/30" />
      
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <ChartCardSkeleton />
        <ChartCardSkeleton />
      </div>
      
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <ChartCardSkeleton />
        <ChartCardSkeleton />
        <ChartCardSkeleton />
      </div>
    </div>
  );
}
