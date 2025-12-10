import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Building2, AlertTriangle, Gem, ExternalLink, Calendar } from "lucide-react";
import { OwnerDashboardData } from "@/hooks/useOwnerDashboard";
import { useNavigate } from "react-router-dom";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

interface OwnerSmartListsProps {
  data: OwnerDashboardData;
}

const formatCurrency = (value: number) => {
  if (value >= 1000000) return `R$${(value / 1000000).toFixed(1)}M`;
  if (value >= 1000) return `R$${(value / 1000).toFixed(0)}k`;
  return `R$${value.toFixed(0)}`;
};

export function OwnerSmartLists({ data }: OwnerSmartListsProps) {
  const navigate = useNavigate();

  const hasEnterpriseDeals = data.enterpriseDeals.length > 0;
  const hasChurnRisk = data.churnRisk.length > 0;
  const hasStrategicOpps = data.strategicOpportunities.length > 0;

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      {/* Enterprise Deals */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Building2 className="h-4 w-4 text-blue-500" />
            Maiores Negociações
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {!hasEnterpriseDeals ? (
            <p className="text-sm text-muted-foreground">Nenhuma negociação de alto valor no pipeline</p>
          ) : (
            data.enterpriseDeals.map((deal, i) => (
              <div key={i} className="flex items-center justify-between p-2 bg-muted/50 rounded-lg">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{deal.title}</p>
                  <p className="text-xs text-muted-foreground truncate">{deal.account}</p>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className="text-xs">
                    {deal.probability}%
                  </Badge>
                  <span className="text-sm font-bold text-green-600">
                    {formatCurrency(deal.value)}
                  </span>
                  <Button 
                    variant="ghost" 
                    size="sm"
                    onClick={() => navigate(`/app/opportunities/${deal.id}`)}
                  >
                    <ExternalLink className="h-3 w-3" />
                  </Button>
                </div>
              </div>
            ))
          )}
        </CardContent>
      </Card>

      {/* Strategic Opportunities (closing this month) */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Gem className="h-4 w-4 text-purple-500" />
            Fechando Este Mês
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {!hasStrategicOpps ? (
            <p className="text-sm text-muted-foreground">Nenhuma oportunidade com previsão de fechamento este mês</p>
          ) : (
            data.strategicOpportunities.map((opp, i) => (
              <div key={i} className="flex items-center justify-between p-2 bg-muted/50 rounded-lg">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{opp.title}</p>
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <span>{opp.stage}</span>
                    {opp.closeDate && (
                      <>
                        <Calendar className="h-3 w-3" />
                        <span>{format(new Date(opp.closeDate), "dd MMM", { locale: ptBR })}</span>
                      </>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-sm font-bold text-primary">
                    {formatCurrency(opp.value)}
                  </span>
                  <Button 
                    variant="ghost" 
                    size="sm"
                    onClick={() => navigate(`/app/opportunities/${opp.id}`)}
                  >
                    <ExternalLink className="h-3 w-3" />
                  </Button>
                </div>
              </div>
            ))
          )}
        </CardContent>
      </Card>

      {/* Churn Risk */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-orange-500" />
            Risco de Churn
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {!hasChurnRisk ? (
            <p className="text-sm text-green-600">Nenhum cliente em risco identificado</p>
          ) : (
            data.churnRisk.map((account, i) => (
              <div key={i} className="flex items-center justify-between p-2 bg-muted/50 rounded-lg">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{account.name}</p>
                  <p className="text-xs text-destructive">{account.reason}</p>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-muted-foreground">
                    {formatCurrency(account.value)}
                  </span>
                  <Button 
                    variant="ghost" 
                    size="sm"
                    onClick={() => navigate(`/app/accounts/${account.id}`)}
                  >
                    <ExternalLink className="h-3 w-3" />
                  </Button>
                </div>
              </div>
            ))
          )}
        </CardContent>
      </Card>
    </div>
  );
}
