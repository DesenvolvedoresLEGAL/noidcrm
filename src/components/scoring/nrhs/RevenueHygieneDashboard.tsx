// Revenue Hygiene Dashboard - Página principal NRHS

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
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-foreground">Revenue Hygiene (NRHS)</h1>
        <p className="text-muted-foreground mt-1">
          Qualidade e confiabilidade dos dados do pipeline
        </p>
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
  );
}
