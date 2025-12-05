import { Database, AlertTriangle, Zap, Users, Activity, Copy } from "lucide-react";
import { KPICard } from "../shared/KPICard";
import { AdminDashboardData } from "@/hooks/useAdminDashboard";

interface AdminKPICardsProps {
  data: AdminDashboardData;
}

export function AdminKPICards({ data }: AdminKPICardsProps) {
  const getHealthColor = (score: number) => {
    if (score >= 80) return "text-green-500";
    if (score >= 60) return "text-yellow-500";
    return "text-red-500";
  };

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
      <KPICard
        title="Saúde da Base"
        value={`${data.dataQuality.score}%`}
        subtitle={`${data.dataQuality.completeness}% completude`}
        icon={Database}
        iconColor={getHealthColor(data.dataQuality.score)}
        trend={data.dataQuality.score >= 80 ? { value: "Saudável", isPositive: true } : { value: "Atenção", isPositive: false }}
      />

      <KPICard
        title="Erros de Integração"
        value={data.integrationStatus.errors.toString()}
        subtitle={`${data.integrationStatus.healthy} operações OK`}
        icon={AlertTriangle}
        iconColor={data.integrationStatus.errors > 0 ? "text-red-500" : "text-green-500"}
        trend={data.integrationStatus.errors === 0 ? { value: "Sem erros", isPositive: true } : { value: "Requer atenção", isPositive: false }}
      />

      <KPICard
        title="Automações"
        value={`${data.automations.active}/${data.automations.total}`}
        subtitle={`${data.automations.executions} execuções`}
        icon={Zap}
        iconColor="text-blue-500"
        trend={data.automations.failures > 0 ? { value: `${data.automations.failures} falhas`, isPositive: false } : { value: "Tudo OK", isPositive: true }}
      />

      <KPICard
        title="Uso do Sistema"
        value={data.systemUsage.activeToday.toString()}
        subtitle={`de ${data.systemUsage.totalUsers} usuários`}
        icon={Users}
        iconColor="text-purple-500"
        trend={{ value: "Ativos hoje", isPositive: true }}
      />

      <KPICard
        title="Consumo VOLTS"
        value={data.voltsUsage.total > 1000 ? `${(data.voltsUsage.total / 1000).toFixed(1)}k` : data.voltsUsage.total.toString()}
        subtitle="Ações de IA"
        icon={Activity}
        iconColor="text-amber-500"
      />

      <KPICard
        title="Alertas Duplicidade"
        value={data.duplicateAlerts.toString()}
        subtitle="Registros duplicados"
        icon={Copy}
        iconColor={data.duplicateAlerts > 0 ? "text-orange-500" : "text-green-500"}
        trend={data.duplicateAlerts === 0 ? { value: "Limpo", isPositive: true } : { value: "Revisar", isPositive: false }}
      />
    </div>
  );
}
