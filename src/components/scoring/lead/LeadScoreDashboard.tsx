import { Users, RefreshCw, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { recalculateAllScores } from '@/services/crm/scoring';
import { useLeadScoreAnalytics } from '@/hooks/useLeadScoreAnalytics';
import { leadScoreKeys } from '@/lib/query-keys';
import { LeadScoreOverviewKPIs } from './LeadScoreOverviewKPIs';
import { LeadGradeDistribution } from './LeadGradeDistribution';
import { LeadScoreTable } from './LeadScoreTable';
import { LeadScoreBySegment } from './LeadScoreBySegment';
import { LeadScoreInsights } from './LeadScoreInsights';

export function LeadScoreDashboard() {
  const queryClient = useQueryClient();
  const {
    leads,
    allLeads,
    kpis,
    gradeDistribution,
    segmentStats,
    filterOptions,
    filters,
    setFilters,
    isLoading,
  } = useLeadScoreAnalytics();

  const recalculateMutation = useMutation({
    mutationFn: () => recalculateAllScores('account'),
    onSuccess: () => {
      toast.success('Scores de leads recalculados com sucesso!');
      queryClient.invalidateQueries({ queryKey: leadScoreKeys.all });
    },
    onError: () => {
      toast.error('Erro ao recalcular scores');
    }
  });

  const handleFilterGrade = (grade: string | null) => {
    setFilters(prev => ({ ...prev, grade }));
  };

  return (
    <TooltipProvider>
      <div className="space-y-6">
        {/* Header */}
        <div className="relative overflow-hidden rounded-xl bg-gradient-to-r from-blue-500/10 via-blue-500/5 to-transparent border p-6">
          <div className="absolute top-0 right-0 w-64 h-64 bg-blue-500/5 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2" />
          <div className="relative flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="h-14 w-14 rounded-xl bg-blue-500/10 flex items-center justify-center">
                <Users className="h-7 w-7 text-blue-500" />
              </div>
              <div>
                <h2 className="text-2xl font-bold flex items-center gap-2">
                  Lead Scoring
                  <Badge variant="secondary" className="ml-2 bg-blue-500/10 text-blue-600">
                    <Sparkles className="h-3 w-3 mr-1" />
                    FIT + INTENT
                  </Badge>
                </h2>
                <p className="text-muted-foreground">
                  Qualificação inteligente de contas baseada em perfil (FIT) e engajamento (INTENT)
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
                  Recalcular Leads
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                <p>Recalcula FIT, INTENT e Lead Score de todas as contas</p>
              </TooltipContent>
            </Tooltip>
          </div>
        </div>

        {/* KPIs */}
        <LeadScoreOverviewKPIs 
          kpis={kpis} 
          onFilterGrade={handleFilterGrade}
          activeGrade={filters.grade}
          isLoading={isLoading}
        />

        {/* Charts */}
        <LeadGradeDistribution 
          gradeDistribution={gradeDistribution}
          averageFit={kpis.averageFit}
          averageIntent={kpis.averageIntent}
          isLoading={isLoading}
        />

        {/* Table */}
        <LeadScoreTable 
          leads={leads}
          filters={filters}
          setFilters={setFilters}
          filterOptions={filterOptions}
          isLoading={isLoading}
        />

        {/* Bottom section */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <LeadScoreBySegment 
            segmentStats={segmentStats}
            isLoading={isLoading}
          />
          <LeadScoreInsights 
            leads={allLeads}
            kpis={kpis}
            isLoading={isLoading}
          />
        </div>
      </div>
    </TooltipProvider>
  );
}
