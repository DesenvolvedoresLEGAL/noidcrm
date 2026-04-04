import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Building2, AlertTriangle, Gem, ExternalLink, Calendar, FileWarning } from "lucide-react";
import { OwnerDashboardData } from "@/hooks/useOwnerDashboard";
import { useNavigate } from "react-router-dom";
import { formatDateShortBR } from "@/lib/dateUtils";

interface OwnerSmartListsProps {
  data: OwnerDashboardData;
}

const formatCurrency = (value: number) => {
  if (value >= 1000000) return `R$${(value / 1000000).toFixed(1)}M`;
  if (value >= 1000) return `R$${(value / 1000).toFixed(0)}k`;
  return `R$${value.toFixed(0)}`;
};

const urgencyConfig = {
  expired: { label: 'Vencida', className: 'bg-destructive/10 text-destructive border-destructive/30' },
  today: { label: 'Vence Hoje', className: 'bg-amber-500/10 text-amber-600 border-amber-500/30' },
  expiring: { label: 'Em breve', className: 'bg-orange-500/10 text-orange-600 border-orange-500/30' },
};

type ProposalFilter = 'all' | 'expired' | 'today' | 'expiring';

export function OwnerSmartLists({ data }: OwnerSmartListsProps) {
  const navigate = useNavigate();
  const [proposalFilter, setProposalFilter] = useState<ProposalFilter>('all');

  const hasEnterpriseDeals = data.enterpriseDeals.length > 0;
  const hasChurnRisk = data.churnRisk.length > 0;
  const hasStrategicOpps = data.strategicOpportunities.length > 0;
  const hasExpiringProposals = data.expiringProposals.length > 0;

  const filteredProposals = proposalFilter === 'all'
    ? data.expiringProposals
    : data.expiringProposals.filter(p => p.urgency === proposalFilter);

  const expiredCount = data.expiringProposals.filter(p => p.urgency === 'expired').length;
  const todayCount = data.expiringProposals.filter(p => p.urgency === 'today').length;
  const expiringCount = data.expiringProposals.filter(p => p.urgency === 'expiring').length;

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      {/* Expiring Proposals - PRIORITY */}
      <Card className={hasExpiringProposals ? 'border-destructive/30' : ''}>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <FileWarning className="h-4 w-4 text-destructive" />
            Propostas Vencendo
            {hasExpiringProposals && (
              <Badge variant="destructive" className="text-xs ml-auto">
                {data.expiringProposals.length}
              </Badge>
            )}
          </CardTitle>
          {/* Filter buttons */}
          {hasExpiringProposals && (
            <div className="flex flex-wrap gap-1.5 mt-2">
              <Button
                variant={proposalFilter === 'all' ? 'default' : 'outline'}
                size="sm"
                className="h-7 text-xs px-2.5"
                onClick={() => setProposalFilter('all')}
              >
                Todas ({data.expiringProposals.length})
              </Button>
              {expiredCount > 0 && (
                <Button
                  variant={proposalFilter === 'expired' ? 'default' : 'outline'}
                  size="sm"
                  className="h-7 text-xs px-2.5"
                  onClick={() => setProposalFilter('expired')}
                >
                  Vencidas ({expiredCount})
                </Button>
              )}
              {todayCount > 0 && (
                <Button
                  variant={proposalFilter === 'today' ? 'default' : 'outline'}
                  size="sm"
                  className="h-7 text-xs px-2.5"
                  onClick={() => setProposalFilter('today')}
                >
                  Hoje ({todayCount})
                </Button>
              )}
              {expiringCount > 0 && (
                <Button
                  variant={proposalFilter === 'expiring' ? 'default' : 'outline'}
                  size="sm"
                  className="h-7 text-xs px-2.5"
                  onClick={() => setProposalFilter('expiring')}
                >
                  Próx. 10 dias ({expiringCount})
                </Button>
              )}
            </div>
          )}
        </CardHeader>
        <CardContent className="space-y-2">
          {!hasExpiringProposals ? (
            <p className="text-sm text-green-600">Nenhuma proposta vencendo ou vencida</p>
          ) : filteredProposals.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nenhuma proposta neste filtro</p>
          ) : (
            filteredProposals.map((proposal, i) => (
              <div key={i} className="flex items-center justify-between p-2 bg-muted/50 rounded-lg">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{proposal.title}</p>
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <span className="truncate">{proposal.clientName}</span>
                    <Calendar className="h-3 w-3 flex-shrink-0" />
                    <span className="flex-shrink-0">{formatDateShortBR(proposal.expiresAt)}</span>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className={`text-xs ${urgencyConfig[proposal.urgency].className}`}>
                    {urgencyConfig[proposal.urgency].label}
                  </Badge>
                  <span className="text-sm font-bold text-primary">
                    {formatCurrency(proposal.totalAmount)}
                  </span>
                  {proposal.opportunityId && (
                    <Button 
                      variant="ghost" 
                      size="sm"
                      onClick={() => navigate(`/app/opportunities/${proposal.opportunityId}`)}
                    >
                      <ExternalLink className="h-3 w-3" />
                    </Button>
                  )}
                </div>
              </div>
            ))
          )}
        </CardContent>
      </Card>

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
                        <span>{formatDateShortBR(opp.closeDate)}</span>
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
