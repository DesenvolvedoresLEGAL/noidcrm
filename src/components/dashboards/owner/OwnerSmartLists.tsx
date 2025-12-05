import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Building2, AlertTriangle, Gem, AlertCircle, ExternalLink } from "lucide-react";
import { OwnerDashboardData } from "@/hooks/useOwnerDashboard";
import { useNavigate } from "react-router-dom";

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

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      {/* Enterprise Deals */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Building2 className="h-4 w-4 text-blue-500" />
            Grandes Contas em Negociação
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {data.enterpriseDeals.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nenhuma negociação enterprise ativa</p>
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

      {/* Churn Risk */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-orange-500" />
            Contas com Risco de Churn
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {data.churnRisk.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nenhuma conta em risco identificada</p>
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

      {/* Strategic Opportunities */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Gem className="h-4 w-4 text-purple-500" />
            Oportunidades Estratégicas
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {data.strategicOpportunities.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nenhuma oportunidade estratégica</p>
          ) : (
            data.strategicOpportunities.map((opp, i) => (
              <div key={i} className="flex items-center justify-between p-2 bg-muted/50 rounded-lg">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{opp.title}</p>
                  <p className="text-xs text-muted-foreground">{opp.stage}</p>
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

      {/* System Errors */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <AlertCircle className="h-4 w-4 text-red-500" />
            Erros que Impactam Receita
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {data.systemErrors.length === 0 ? (
            <p className="text-sm text-muted-foreground text-green-600">Nenhum erro crítico detectado</p>
          ) : (
            data.systemErrors.map((error, i) => (
              <div key={i} className="flex items-center justify-between p-2 bg-muted/50 rounded-lg">
                <div>
                  <p className="text-sm font-medium capitalize">{error.type.replace(/_/g, ' ')}</p>
                  <p className="text-xs text-muted-foreground">{error.count} ocorrências</p>
                </div>
                <Badge 
                  variant={error.impact === 'Alto' ? 'destructive' : error.impact === 'Médio' ? 'default' : 'secondary'}
                  className="text-xs"
                >
                  {error.impact}
                </Badge>
              </div>
            ))
          )}
        </CardContent>
      </Card>
    </div>
  );
}
