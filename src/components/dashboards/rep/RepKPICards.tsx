import { KPICard } from "../shared/KPICard";
import { 
  Target, 
  FileText, 
  CheckSquare, 
  Users, 
  TrendingUp,
  Gauge,
  CalendarClock,
  UserCheck
} from "lucide-react";
import { RepDashboardData } from "@/hooks/useRepDashboard";
import { useRepPACE } from "@/hooks/useRepPACE";

interface RepKPICardsProps {
  data: RepDashboardData;
}

export function RepKPICards({ data }: RepKPICardsProps) {
  const { paceData, hasTarget } = useRepPACE();
  
  const isLeadsGoal = paceData.goalType === 'leads';

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value);
  };

  const formatGoalValue = (value: number) => {
    if (isLeadsGoal) return `${Math.round(value)} leads`;
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
      {/* Card 1: Adaptativo por goalType */}
      {isLeadsGoal ? (
        <KPICard
          title="Leads em Qualificação"
          value={data.openOpportunities.count}
          subtitle="Em andamento"
          icon={Users}
          variant="primary"
        />
      ) : (
        <KPICard
          title="Oportunidades Abertas"
          value={data.openOpportunities.count}
          subtitle={formatCurrency(data.openOpportunities.value)}
          icon={Target}
          variant="primary"
        />
      )}
      
      {/* Card 2: Adaptativo por goalType */}
      {isLeadsGoal ? (
        <KPICard
          title="Qualificados (7 dias)"
          value={data.newLeads.last7d}
          subtitle={`${data.newLeads.today} hoje`}
          icon={UserCheck}
          variant={data.newLeads.today > 0 ? "success" : "default"}
        />
      ) : (
        <KPICard
          title="Propostas (7 dias)"
          value={data.proposalsSent7d.count}
          subtitle={`${data.proposalsSent7d.viewed} visualizadas`}
          icon={FileText}
          variant={data.proposalsSent7d.accepted > 0 ? "success" : "default"}
        />
      )}
      
      <KPICard
        title="Meta do Mês"
        value={`${goalData.percentage}%`}
        subtitle={`${formatGoalValue(goalData.achieved)} de ${formatGoalValue(goalData.goal)}`}
        icon={TrendingUp}
        variant={goalData.percentage >= 100 ? "success" : goalData.percentage >= 70 ? "warning" : "danger"}
      />
      
      <KPICard
        title="Projeção do Mês"
        value={formatGoalValue(paceData.projection)}
        subtitle={`${paceData.workingDaysRemaining} dias úteis restam`}
        icon={CalendarClock}
        variant={projectionVariant}
      />
      
      <KPICard
        title="PACE Diário"
        value={formatGoalValue(paceData.dailyTarget)}
        subtitle={paceData.paceVariance >= 0 ? `+${formatGoalValue(paceData.paceVariance)} à frente` : `${formatGoalValue(paceData.paceVariance)} atrás`}
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
