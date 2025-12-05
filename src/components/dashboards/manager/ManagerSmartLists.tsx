import { SmartList, SmartListItem } from "../shared/SmartList";
import { ManagerDashboardData } from "@/hooks/useManagerDashboard";
import { 
  AlertTriangle, 
  DollarSign, 
  Construction, 
  Sparkles 
} from "lucide-react";
import { useNavigate } from "react-router-dom";

interface ManagerSmartListsProps {
  data: ManagerDashboardData;
}

export function ManagerSmartLists({ data }: ManagerSmartListsProps) {
  const navigate = useNavigate();

  const formatCurrency = (value: number) => {
    if (value >= 1000000) return `R$ ${(value / 1000000).toFixed(1)}M`;
    if (value >= 1000) return `R$ ${(value / 1000).toFixed(0)}k`;
    return `R$ ${value.toFixed(0)}`;
  };

  // At-risk sellers
  const atRiskItems: SmartListItem[] = data.atRiskSellers.map((seller) => ({
    id: seller.userId,
    title: seller.name,
    subtitle: `Faltam ${formatCurrency(seller.gap)} para a meta`,
    value: `${Math.round((seller.achieved / seller.goal) * 100)}%`,
    icon: AlertTriangle,
    iconColor: "text-red-500",
    badge: {
      label: "Em risco",
      variant: "destructive",
    },
  }));

  // High-value opportunities
  const highValueItems: SmartListItem[] = data.highValueOpportunities.map((opp) => ({
    id: opp.id,
    title: opp.title,
    subtitle: `${opp.owner} • ${opp.stage}`,
    value: formatCurrency(opp.value),
    icon: DollarSign,
    iconColor: "text-green-500",
    badge: {
      label: "High-value",
      variant: "default",
    },
    onClick: () => navigate(`/app/opportunities/${opp.id}`),
  }));

  // Bottlenecks
  const bottleneckItems: SmartListItem[] = data.bottlenecks.map((bottleneck) => ({
    id: bottleneck.stageId,
    title: bottleneck.stageName,
    subtitle: `Média de ${bottleneck.avgDays} dias parados`,
    value: `${bottleneck.count} opps`,
    icon: Construction,
    iconColor: "text-orange-500",
    badge: {
      label: `${bottleneck.avgDays}d`,
      variant: "outline",
    },
  }));

  // AI Recommendations
  const aiRecommendationItems: SmartListItem[] = data.aiRecommendations.map((rec, index) => ({
    id: `rec-${index}`,
    title: rec.userName,
    subtitle: rec.action,
    icon: Sparkles,
    iconColor: rec.priority === "high" ? "text-red-500" : "text-purple-500",
    badge: {
      label: rec.priority === "high" ? "Urgente" : "Atenção",
      variant: rec.priority === "high" ? "destructive" : "secondary",
    },
  }));

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
      <SmartList
        title="⚠️ Vendedores em Risco"
        icon={AlertTriangle}
        items={atRiskItems}
        emptyMessage="Todos os vendedores no caminho certo!"
        maxHeight="280px"
      />
      
      <SmartList
        title="💰 Oportunidades High-Value (>R$20k)"
        icon={DollarSign}
        items={highValueItems}
        emptyMessage="Nenhuma oportunidade high-value"
        showViewAll
        onViewAll={() => navigate("/app/opportunities")}
        maxHeight="280px"
      />
      
      <SmartList
        title="🚧 Gargalos da Semana"
        icon={Construction}
        items={bottleneckItems}
        emptyMessage="Nenhum gargalo identificado"
        maxHeight="280px"
      />
      
      <SmartList
        title="🤖 Ações Recomendadas pela IA"
        icon={Sparkles}
        items={aiRecommendationItems}
        emptyMessage="Nenhuma ação recomendada no momento"
        maxHeight="280px"
      />
    </div>
  );
}
