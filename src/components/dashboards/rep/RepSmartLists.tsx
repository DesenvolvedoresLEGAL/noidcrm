import { SmartList, SmartListItem } from "../shared/SmartList";
import { RepDashboardData } from "@/hooks/useRepDashboard";
import { 
  Flame, 
  AlertTriangle, 
  FileText, 
  RefreshCw 
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";

interface RepSmartListsProps {
  data: RepDashboardData;
}

export function RepSmartLists({ data }: RepSmartListsProps) {
  const navigate = useNavigate();

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value);
  };

  // Hot leads list
  const hotLeadsItems: SmartListItem[] = data.hotLeads.map((lead) => ({
    id: lead.id,
    title: lead.name,
    subtitle: lead.source,
    icon: Flame,
    iconColor: "text-orange-500",
    badge: {
      label: `Score ${lead.score}`,
      variant: lead.score >= 80 ? "default" : lead.score >= 60 ? "secondary" : "outline",
    },
    onClick: () => navigate(`/app/accounts/${lead.id}`),
  }));

  // At risk opportunities
  const atRiskItems: SmartListItem[] = data.atRiskOpportunities.map((opp) => ({
    id: opp.id,
    title: opp.title,
    subtitle: opp.reason,
    value: formatCurrency(opp.value),
    icon: AlertTriangle,
    iconColor: "text-red-500",
    badge: {
      label: `${opp.daysStale}d`,
      variant: "destructive",
    },
    onClick: () => navigate(`/app/opportunities/${opp.id}`),
  }));

  // Pending proposals
  const pendingProposalsItems: SmartListItem[] = data.pendingProposals.map((prop) => ({
    id: prop.id,
    title: prop.title,
    subtitle: `Enviada há ${prop.hoursAgo}h`,
    value: formatCurrency(prop.value),
    icon: FileText,
    iconColor: "text-yellow-500",
    badge: {
      label: `+${Math.floor(prop.hoursAgo / 24)}d`,
      variant: "outline",
    },
    onClick: () => navigate(`/app/proposals/${prop.id}/edit`),
  }));

  // Inactive clients
  const inactiveClientsItems: SmartListItem[] = data.inactiveClients.map((client) => ({
    id: client.id,
    title: client.name,
    subtitle: client.lastPurchase 
      ? `Última compra: ${formatDistanceToNow(new Date(client.lastPurchase), { locale: ptBR, addSuffix: true })}`
      : "Sem compras recentes",
    value: formatCurrency(client.totalValue),
    icon: RefreshCw,
    iconColor: "text-blue-500",
    onClick: () => navigate(`/app/accounts/${client.id}`),
  }));

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
      <SmartList
        title="🔥 Leads Quentes"
        icon={Flame}
        items={hotLeadsItems}
        emptyMessage="Nenhum lead quente no momento"
        showViewAll
        onViewAll={() => navigate("/app/accounts")}
      />
      
      <SmartList
        title="⚠️ Oportunidades em Risco"
        icon={AlertTriangle}
        items={atRiskItems}
        emptyMessage="Nenhuma oportunidade em risco"
        showViewAll
        onViewAll={() => navigate("/app/opportunities")}
      />
      
      <SmartList
        title="📨 Propostas Sem Resposta (+48h)"
        icon={FileText}
        items={pendingProposalsItems}
        emptyMessage="Todas as propostas com resposta"
        showViewAll
        onViewAll={() => navigate("/app/proposals")}
      />
      
      <SmartList
        title="🔄 Clientes para Reativação"
        icon={RefreshCw}
        items={inactiveClientsItems}
        emptyMessage="Nenhum cliente inativo identificado"
        showViewAll
        onViewAll={() => navigate("/app/accounts")}
      />
    </div>
  );
}
