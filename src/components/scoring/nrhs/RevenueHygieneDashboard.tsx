// Revenue Hygiene Dashboard - Página principal NRHS

import { Shield, RefreshCw, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { useNRHSAnalytics } from '@/hooks/useNRHSAnalytics';
import { useCurrentOrganization } from '@/hooks/useCurrentOrganization';
import { NRHSTier } from '@/services/crm/nrhs-calculator';
import { NRHSOverviewKPIs } from './NRHSOverviewKPIs';
import { NRHSDistributionCharts } from './NRHSDistributionCharts';
import { NRHSDealsTable } from './NRHSDealsTable';
import { NRHSByOwner } from './NRHSByOwner';
import { NRHSCorrelations } from './NRHSCorrelations';
import { NRHSInsightsPanel } from './NRHSInsightsPanel';
import { NRHSGovernanceBox } from './NRHSGovernanceBox';

export function RevenueHygieneDashboard() {
  const { organization } = useCurrentOrganization();
  const {
    deals,
    kpis,
    tierDistribution,
    pillarAverages,
    ownerStats,
    insights,
    correlations,
    isLoading,
    filters,
    setFilters,
    clearFilters,
    filteredDeals,
  } = useNRHSAnalytics();

  const handleFilterTier = (tier: NRHSTier | 'at_risk_or_below') => {
    if (tier === 'at_risk_or_below') {
      // Filter deals with NRHS < 60 (critical + insalubrious)
      setFilters({ ...filters, tier: 'critical' });
    } else {
      setFilters({ ...filters, tier });
    }
  };

  const handleFilterOwner = (ownerId: string) => {
    setFilters({ ...filters, ownerId });
  };

  const handleViewInsightDeals = (insightId: string, pillar: string) => {
    // Could filter by blocker type in the future
    setFilters({ ...filters, hasBlocker: true });
  };

  return (
    <TooltipProvider>
      <div className="space-y-6">
        {/* Header */}
        <div className="relative overflow-hidden rounded-xl bg-gradient-to-r from-purple-500/10 via-purple-500/5 to-transparent border p-6">
          <div className="absolute top-0 right-0 w-64 h-64 bg-purple-500/5 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2" />
          <div className="relative flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="h-14 w-14 rounded-xl bg-purple-500/10 flex items-center justify-center">
                <Shield className="h-7 w-7 text-purple-500" />
              </div>
              <div>
                <h2 className="text-2xl font-bold flex items-center gap-2">
                  Revenue Hygiene (NRHS)
                  <Badge variant="secondary" className="ml-2 bg-purple-500/10 text-purple-600">
                    <Sparkles className="h-3 w-3 mr-1" />
                    Qualidade de Dados
                  </Badge>
                </h2>
                <p className="text-muted-foreground">
                  Qualidade e confiabilidade dos dados do pipeline
                </p>
              </div>
            </div>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button 
                  variant="outline" 
                  disabled={isLoading}
                  className="bg-background/50 backdrop-blur-sm"
                >
                  <RefreshCw className="h-4 w-4 mr-2" />
                  Atualizar NRHS
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                <p>Atualiza o cálculo de NRHS de todos os deals</p>
              </TooltipContent>
            </Tooltip>
          </div>
        </div>

      {/* Seção 1: KPIs Overview */}
      <NRHSOverviewKPIs 
        kpis={kpis} 
        isLoading={isLoading} 
        onFilterTier={handleFilterTier}
      />

      {/* Seção 2: Gráficos de Distribuição */}
      <NRHSDistributionCharts 
        tierDistribution={tierDistribution}
        pillarAverages={pillarAverages}
        isLoading={isLoading}
      />

      {/* Seção 5: Correlações */}
      <NRHSCorrelations 
        correlations={correlations}
        isLoading={isLoading}
      />

      {/* Seção 3: Tabela de Deals */}
      <NRHSDealsTable
        deals={deals}
        filteredDeals={filteredDeals}
        isLoading={isLoading}
        filters={filters}
        onFiltersChange={setFilters}
        onClearFilters={clearFilters}
        organizationId={organization?.id || ''}
      />

      {/* Seção 4 + 6: By Owner + Insights lado a lado */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        <NRHSByOwner 
          ownerStats={ownerStats}
          isLoading={isLoading}
          onFilterOwner={handleFilterOwner}
        />
        <NRHSInsightsPanel 
          insights={insights}
          isLoading={isLoading}
          onViewDeals={handleViewInsightDeals}
        />
      </div>

      {/* Seção 7: Governance */}
      <NRHSGovernanceBox />
    </div>
    </TooltipProvider>
  );
}
