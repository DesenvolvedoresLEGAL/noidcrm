import { KPICard } from "../shared/KPICard";
import { 
  Target, 
  FileText, 
  CheckSquare, 
  Users, 
  TrendingUp,
  Gauge,
  CalendarClock
} from "lucide-react";
import { RepDashboardData } from "@/hooks/useRepDashboard";
import { useRepPACE } from "@/hooks/useRepPACE";

interface RepKPICardsProps {
  data: RepDashboardData;
}

export function RepKPICards({ data }: RepKPICardsProps) {
  const { paceData, hasTarget } = useRepPACE();
  
  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value);
  };

  const formatGoalValue = (value: number) => {
    if (paceData.goalType === 'leads') return `${value} leads`;
    return formatCurrency(value);
  };

  // Use PACE data for monthly goal if available
  const goalData = hasTarget ? {
    goal: paceData.monthlyTarget,
    achieved: paceData.achieved,
    percentage: paceData.monthlyTarget > 0 ? Math.round((paceData.achieved / paceData.monthlyTarget) * 100) : 0,
  } : data.monthlyGoal;

  const projectionVariant = paceData.projection >= paceData.monthlyTarget ? "success" : 
    paceData.projection >= paceData.monthlyTarget * 0.8 ? "warning" : "danger";

  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
      <KPICard
        title="Oportunidades Abertas"
        value={data.openOpportunities.count}
        subtitle={formatCurrency(data.openOpportunities.value)}
        icon={Target}
        variant="primary"
      />
      
      <KPICard
        title="Propostas (7 dias)"
        value={data.proposalsSent7d.count}
        subtitle={`${data.proposalsSent7d.viewed} visualizadas`}
        icon={FileText}
        variant={data.proposalsSent7d.accepted > 0 ? "success" : "default"}
      />
      
      <KPICard
        title="Meta do Mês"
        value={`${goalData.percentage}%`}
        subtitle={`${formatCurrency(goalData.achieved)} de ${formatCurrency(goalData.goal)}`}
        icon={TrendingUp}
        variant={goalData.percentage >= 100 ? "success" : goalData.percentage >= 70 ? "warning" : "danger"}
      />
      
      <KPICard
        title="Projeção do Mês"
        value={formatCurrency(paceData.projection)}
        subtitle={`${paceData.workingDaysRemaining} dias úteis restam`}
        icon={CalendarClock}
        variant={projectionVariant}
      />
      
      <KPICard
        title="PACE Diário"
        value={formatCurrency(paceData.dailyTarget)}
        subtitle={paceData.paceVariance >= 0 ? `+${formatCurrency(paceData.paceVariance)} à frente` : `${formatCurrency(paceData.paceVariance)} atrás`}
        icon={Gauge}
        variant={paceData.paceScore === "green" ? "success" : paceData.paceScore === "yellow" ? "warning" : "danger"}
      />
      
      <KPICard
        title="Tarefas Pendentes"
        value={data.pendingTasks.total}
        subtitle={data.pendingTasks.overdue > 0 ? `${data.pendingTasks.overdue} atrasadas` : "Nenhuma atrasada"}
        icon={CheckSquare}
        variant={data.pendingTasks.overdue > 0 ? "danger" : "default"}
      />
    </div>
  );
}
