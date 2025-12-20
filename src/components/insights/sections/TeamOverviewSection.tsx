import { motion } from "framer-motion";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ManagerKPICards } from "@/components/dashboards/manager/ManagerKPICards";
import { TeamFunnelChart } from "@/components/dashboards/manager/TeamFunnelChart";
import { LossReasonsChart } from "@/components/dashboards/manager/LossReasonsChart";
import { PipelineAgingChart } from "@/components/dashboards/manager/PipelineAgingChart";
import { LeadsByOriginChart } from "@/components/dashboards/manager/LeadsByOriginChart";
import { ManagerDashboardData } from "@/hooks/useManagerDashboard";
import { BarChart3 } from "lucide-react";

interface TeamOverviewSectionProps {
  data: ManagerDashboardData;
}

const sectionVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: { 
    opacity: 1, 
    y: 0,
    transition: { duration: 0.4 }
  },
};

export function TeamOverviewSection({ data }: TeamOverviewSectionProps) {
  return (
    <motion.div
      variants={sectionVariants}
      initial="hidden"
      animate="visible"
      className="space-y-6"
    >
      {/* KPIs do Time */}
      <ManagerKPICards data={data} />

      {/* Charts Row 1 - Funil, Perdas, Aging */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <TeamFunnelChart data={data.teamFunnel} />
        <LossReasonsChart data={data.lossReasons} />
        <PipelineAgingChart data={data.pipelineAging} />
      </div>

      {/* Charts Row 2 - Origens */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <LeadsByOriginChart data={data.leadsByOrigin} />
        
        {/* Pipeline Summary Card */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <BarChart3 className="h-4 w-4 text-primary" />
              Resumo do Pipeline
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-4">
              <div className="p-4 rounded-lg bg-muted/50">
                <p className="text-xs text-muted-foreground mb-1">Ciclo Médio</p>
                <p className="text-2xl font-bold">{data.avgCycleTime}d</p>
              </div>
              <div className="p-4 rounded-lg bg-muted/50">
                <p className="text-xs text-muted-foreground mb-1">Conversão</p>
                <p className="text-2xl font-bold">{data.teamConversionRate}%</p>
              </div>
              <div className="p-4 rounded-lg bg-muted/50">
                <p className="text-xs text-muted-foreground mb-1">Opps Abertas</p>
                <p className="text-2xl font-bold">{data.totalOpenOpportunities}</p>
              </div>
              <div className="p-4 rounded-lg bg-muted/50">
                <p className="text-xs text-muted-foreground mb-1">Deals Ganhos</p>
                <p className="text-2xl font-bold">{data.teamFunnel.won}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </motion.div>
  );
}
