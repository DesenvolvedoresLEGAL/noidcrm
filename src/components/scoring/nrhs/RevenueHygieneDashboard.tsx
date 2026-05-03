// Revenue Hygiene Dashboard - Página principal NRHS

import { Shield, RefreshCw, Sparkles, AlertTriangle } from 'lucide-react';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { useNRHSAnalytics } from '@/hooks/useNRHSAnalytics';
import { useCurrentOrganization } from '@/hooks/useCurrentOrganization';
import { useNRHSAnalyticsRealtime } from '@/hooks/scoring/useNRHSAnalyticsRealtime';
import { NRHSTier } from '@/services/crm/nrhs-calculator';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useQueryClient } from '@tanstack/react-query';
import { NRHSOverviewKPIs } from './NRHSOverviewKPIs';
import { NRHSDistributionCharts } from './NRHSDistributionCharts';
import { NRHSDealsTable } from './NRHSDealsTable';
import { NRHSByOwner } from './NRHSByOwner';
import { NRHSCorrelations } from './NRHSCorrelations';
import { NRHSInsightsPanel } from './NRHSInsightsPanel';
import { NRHSGovernanceBox } from './NRHSGovernanceBox';
import { NRHSFilterBar } from './NRHSFilterBar';

export function RevenueHygieneDashboard() {
  const { organization, loading: orgLoading } = useCurrentOrganization();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [isRecalcing, setIsRecalcing] = useState(false);

  const {
    deals,
    kpis,
    tierDistribution,
    pillarAverages,
    ownerStats,
    insights,
    correlations,
    isLoading,
    error,
    filters,
    setFilters,
    clearFilters,
    filteredDeals,
  } = useNRHSAnalytics();

  useNRHSAnalyticsRealtime(organization?.id);

  // AUTH.1.3: gate visual após hooks. Evita renderizar a árvore privada
  // sem contexto de organização (queries internas já são gateadas, mas o
  // skeleton aqui evita flicker e UX confusa).
  if (orgLoading || !organization?.id) {
    return (
      <div className="min-h-[400px] flex items-center justify-center">
        <div className="text-center space-y-3">
          <div className="h-8 w-8 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="text-muted-foreground text-sm">Aguardando contexto da organização...</p>
        </div>
      </div>
    );
  }

  const handleFilterTier = (tier: NRHSTier | 'at_risk_or_below') => {
    if (tier === 'at_risk_or_below') {
      setFilters({ ...filters, tier: 'critical' });
    } else {
      setFilters({ ...filters, tier });
    }
  };

  const handleFilterOwner = (ownerId: string) => {
    setFilters({ ...filters, ownerId });
  };

  const handleViewInsightDeals = (insightId: string, pillar: string) => {
    setFilters({ ...filters, hasBlocker: true });
  };

  const handleRecalcAll = async () => {
    if (!organization?.id || isRecalcing) return;
    setIsRecalcing(true);
    try {
      // HOTFIX 1.4.2: usa RPC dedicada com os mesmos filtros da tela.
      const { data, error } = await (supabase as any).rpc('enqueue_nrhs_recalc_for_filters', {
        p_org_id: organization.id,
        p_owner_id: filters.ownerId ?? null,
      });
      if (error) throw error;
      const enqueued = data?.enqueued ?? 0;
      const skipped = data?.skipped ?? 0;
      toast({
        title: 'Atualização enfileirada',
        description: `${enqueued} deals serão recalculados${skipped > 0 ? ` (${skipped} já estavam na fila)` : ''}.`,
      });
      // Trigger immediate processing (best-effort, non-blocking)
      supabase.functions.invoke('process-nrhs-queue', {
        body: { organization_id: organization.id },
      }).catch(() => undefined);
      queryClient.invalidateQueries({ queryKey: ['nrhs-analytics'] });
    } catch (e: any) {
      toast({
        title: 'Falha ao enfileirar',
        description: e?.message || 'Tente novamente em instantes.',
        variant: 'destructive',
      });
    } finally {
      setIsRecalcing(false);
    }
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
                  disabled={isLoading || isRecalcing}
                  onClick={handleRecalcAll}
                  className="bg-background/50 backdrop-blur-sm"
                >
                  <RefreshCw className={`h-4 w-4 mr-2 ${isRecalcing ? 'animate-spin' : ''}`} />
                  {isRecalcing ? 'Enfileirando...' : 'Atualizar NRHS'}
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                <p>Recalcula NRHS para os {deals.length} deals visíveis</p>
              </TooltipContent>
            </Tooltip>
          </div>
        </div>

      {error ? (
        <div className="rounded-xl border border-destructive/40 bg-destructive/5 p-4 flex items-start gap-3">
          <AlertTriangle className="h-5 w-5 text-destructive mt-0.5" />
          <div className="flex-1">
            <p className="font-medium text-foreground">Não foi possível carregar os dados de Revenue Hygiene agora.</p>
            <p className="text-sm text-muted-foreground mt-1">
              {error.message || 'Erro inesperado ao consultar oportunidades.'}
            </p>
            <Button
              size="sm"
              variant="outline"
              className="mt-3"
              onClick={() => queryClient.invalidateQueries({ queryKey: ['nrhs-analytics'] })}
            >
              <RefreshCw className="h-3 w-3 mr-2" /> Tentar novamente
            </Button>
          </div>
        </div>
      ) : null}

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
