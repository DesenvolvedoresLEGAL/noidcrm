import { KPICard } from "../shared/KPICard";
import { 
  Target, 
  FileText, 
  CheckSquare, 
  Users, 
  TrendingUp,
  AlertTriangle
} from "lucide-react";
import { RepDashboardData } from "@/hooks/useRepDashboard";

interface RepKPICardsProps {
  data: RepDashboardData;
}

export function RepKPICards({ data }: RepKPICardsProps) {
  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value);
  };

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
        value={`${data.monthlyGoal.percentage}%`}
        subtitle={`${formatCurrency(data.monthlyGoal.achieved)} de ${formatCurrency(data.monthlyGoal.goal)}`}
        icon={TrendingUp}
        variant={data.monthlyGoal.percentage >= 100 ? "success" : data.monthlyGoal.percentage >= 70 ? "warning" : "danger"}
      />
      
      <KPICard
        title="Tarefas Pendentes"
        value={data.pendingTasks.total}
        subtitle={data.pendingTasks.overdue > 0 ? `${data.pendingTasks.overdue} atrasadas` : "Nenhuma atrasada"}
        icon={CheckSquare}
        variant={data.pendingTasks.overdue > 0 ? "danger" : "default"}
      />
      
      <KPICard
        title="Leads Novos (7d)"
        value={data.newLeads.last7d}
        subtitle={`${data.newLeads.today} hoje`}
        icon={Users}
        variant="default"
      />
      
      <KPICard
        title="Conversão"
        value={`${data.funnelConversion.won}/${data.funnelConversion.opportunities}`}
        subtitle={`${data.funnelConversion.opportunities > 0 ? Math.round((data.funnelConversion.won / data.funnelConversion.opportunities) * 100) : 0}% taxa`}
        icon={AlertTriangle}
        variant="default"
      />
    </div>
  );
}
