import { Target, RefreshCw, Sparkles, Brain } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { recalculateAllScores } from '@/services/crm/scoring';
import { useOpportunityScoreAnalytics } from '@/hooks/useOpportunityScoreAnalytics';
import { OpportunityScoreKPIs } from './OpportunityScoreKPIs';
import { OpportunityScoreDistribution } from './OpportunityScoreDistribution';
import { OpportunityWinPredictions } from './OpportunityWinPredictions';
import { OpportunityScoreTable } from './OpportunityScoreTable';
import { OpportunityRiskAnalysis } from './OpportunityRiskAnalysis';
import { OpportunityScoreInsights } from './OpportunityScoreInsights';

export function OpportunityScoreDashboard() {
  const queryClient = useQueryClient();
  const {
    opportunities,
    allOpportunities,
    kpis,
    scoreDistribution,
    topByWinProbability,
    riskAnalysis,
    filters,
    setFilters,
    isLoading,
  } = useOpportunityScoreAnalytics();

  const recalculateMutation = useMutation({
    mutationFn: () => recalculateAllScores('opportunity'),
    onSuccess: () => {
      toast.success('Scores de oportunidades recalculados com sucesso!');
      queryClient.invalidateQueries({ queryKey: ['opportunity-score-analytics'] });
    },
    onError: () => {
      toast.error('Erro ao recalcular scores');
    }
  });

  const handleFilterScore = (range: 'high' | 'medium' | 'low' | null) => {
    setFilters(prev => ({ ...prev, scoreRange: range }));
  };

  return (
    <TooltipProvider>
      <div className="space-y-6">
        {/* Header */}
        <div className="relative overflow-hidden rounded-xl bg-gradient-to-r from-emerald-500/10 via-emerald-500/5 to-transparent border p-6">
          <div className="absolute top-0 right-0 w-64 h-64 bg-emerald-500/5 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2" />
          <div className="relative flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="h-14 w-14 rounded-xl bg-emerald-500/10 flex items-center justify-center">
                <Target className="h-7 w-7 text-emerald-500" />
              </div>
              <div>
                <h2 className="text-2xl font-bold flex items-center gap-2">
                  Opportunity Scoring
                  <Badge variant="secondary" className="ml-2 bg-emerald-500/10 text-emerald-600">
                    <Brain className="h-3 w-3 mr-1" />
                    AI Win Probability
                  </Badge>
                </h2>
                <p className="text-muted-foreground">
                  Probabilidade de fechamento com machine learning preditivo
                </p>
              </div>
            </div>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button 
                  variant="outline" 
                  onClick={() => recalculateMutation.mutate()}
                  disabled={recalculateMutation.isPending}
                  className="bg-background/50 backdrop-blur-sm"
                >
                  <RefreshCw className={cn("h-4 w-4 mr-2", recalculateMutation.isPending && "animate-spin")} />
                  Recalcular Opps
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                <p>Recalcula Engagement, Velocity, Risk e AI Win Probability</p>
              </TooltipContent>
            </Tooltip>
          </div>
        </div>

        {/* KPIs */}
        <OpportunityScoreKPIs 
          kpis={kpis} 
          onFilterScore={handleFilterScore}
          activeRange={filters.scoreRange}
          isLoading={isLoading}
        />

        {/* Charts */}
        <OpportunityScoreDistribution 
          scoreDistribution={scoreDistribution}
          averageScore={kpis.averageScore}
          averageWinProbability={kpis.averageWinProbability}
          isLoading={isLoading}
        />

        {/* Top by Win Probability */}
        <OpportunityWinPredictions 
          topOpportunities={topByWinProbability}
          isLoading={isLoading}
        />

        {/* Table */}
        <OpportunityScoreTable 
          opportunities={opportunities}
          filters={filters}
          setFilters={setFilters}
          isLoading={isLoading}
        />

        {/* Bottom section */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <OpportunityRiskAnalysis 
            riskAnalysis={riskAnalysis}
            isLoading={isLoading}
          />
          <OpportunityScoreInsights 
            opportunities={allOpportunities}
            kpis={kpis}
            isLoading={isLoading}
          />
        </div>
      </div>
    </TooltipProvider>
  );
}
