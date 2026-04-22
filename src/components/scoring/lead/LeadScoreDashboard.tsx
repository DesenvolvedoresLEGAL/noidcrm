import { useEffect, useRef, useState } from 'react';
import { Users, RefreshCw, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { supabase } from '@/integrations/supabase/client';
import { useLeadScoreAnalytics } from '@/hooks/useLeadScoreAnalytics';
import { useCurrentOrganization } from '@/hooks/useCurrentOrganization';
import { leadScoreKeys } from '@/lib/query-keys';
import { LeadScoreOverviewKPIs } from './LeadScoreOverviewKPIs';
import { LeadGradeDistribution } from './LeadGradeDistribution';
import { LeadScoreTable } from './LeadScoreTable';
import { LeadScoreBySegment } from './LeadScoreBySegment';
import { LeadScoreInsights } from './LeadScoreInsights';
import { LeadScoreFormulaInfo } from './LeadScoreFormulaInfo';

export function LeadScoreDashboard() {
  const queryClient = useQueryClient();
  const { organization } = useCurrentOrganization();
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

  const [activeJobId, setActiveJobId] = useState<string | null>(null);
  const [jobProgress, setJobProgress] = useState<{ processed: number; total: number } | null>(null);
  const pollRef = useRef<number | null>(null);

  const recalculateMutation = useMutation({
    mutationFn: async () => {
      if (!organization?.id) throw new Error('Organização não encontrada');
      const { data, error } = await supabase.functions.invoke('calculate-account-scores', {
        body: { recalculateAll: true, organizationId: organization.id },
      });
      if (error) throw error;
      return data as { jobId: string; status: string };
    },
    onSuccess: (data) => {
      setActiveJobId(data.jobId);
      setJobProgress({ processed: 0, total: 0 });
      toast.info('Recálculo iniciado em segundo plano…');
    },
    onError: (e: any) => {
      toast.error('Erro ao iniciar recálculo', { description: e?.message });
    },
  });

  // Poll job status while recalculation runs
  useEffect(() => {
    if (!activeJobId) return;

    const tick = async () => {
      const { data, error } = await supabase
        .from('score_recalc_jobs')
        .select('status, total_count, processed_count, error_count, last_error')
        .eq('id', activeJobId)
        .maybeSingle();

      if (error || !data) return;

      setJobProgress({ processed: data.processed_count || 0, total: data.total_count || 0 });

      if (data.status === 'completed') {
        toast.success(`Recálculo concluído: ${data.processed_count} contas processadas`, {
          description: data.error_count ? `${data.error_count} com erro` : undefined,
        });
        queryClient.invalidateQueries({ queryKey: leadScoreKeys.all });
        setActiveJobId(null);
        setJobProgress(null);
      } else if (data.status === 'failed') {
        toast.error('Recálculo falhou', { description: data.last_error || undefined });
        setActiveJobId(null);
        setJobProgress(null);
      }
    };

    tick();
    pollRef.current = window.setInterval(tick, 3000);
    return () => {
      if (pollRef.current) window.clearInterval(pollRef.current);
      pollRef.current = null;
    };
  }, [activeJobId, queryClient]);

  const isRecalculating = recalculateMutation.isPending || !!activeJobId;
  const progressLabel = jobProgress && jobProgress.total > 0
    ? `Processando ${jobProgress.processed.toLocaleString('pt-BR')} / ${jobProgress.total.toLocaleString('pt-BR')}`
    : 'Recalcular Leads';

  const handleFilterGrade = (grade: string | null) => {
    setFilters((prev) => ({ ...prev, grade, grades: null, custom: null }));
  };

  return (
    <TooltipProvider>
      <div className="space-y-6">
        {/* Header */}
        <div className="relative overflow-hidden rounded-xl bg-gradient-to-r from-blue-500/10 via-blue-500/5 to-transparent border p-6">
          <div className="absolute top-0 right-0 w-64 h-64 bg-blue-500/5 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2" />
          <div className="relative flex items-center justify-between gap-4 flex-wrap">
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
            <div className="flex items-center gap-2">
              <LeadScoreFormulaInfo />
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="outline"
                    onClick={() => recalculateMutation.mutate()}
                    disabled={isRecalculating}
                    className="bg-background/50 backdrop-blur-sm"
                  >
                    <RefreshCw className={cn('h-4 w-4 mr-2', isRecalculating && 'animate-spin')} />
                    {isRecalculating ? progressLabel : 'Recalcular Leads'}
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  <p>Recalcula FIT, INTENT e Lead Score de todas as contas (em segundo plano)</p>
                </TooltipContent>
              </Tooltip>
            </div>
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
        <div id="lead-score-table">
          <LeadScoreTable
            leads={leads}
            filters={filters}
            setFilters={setFilters}
            filterOptions={filterOptions}
            isLoading={isLoading}
          />
        </div>

        {/* Bottom section */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <LeadScoreBySegment segmentStats={segmentStats} isLoading={isLoading} />
          <LeadScoreInsights
            leads={allLeads}
            kpis={kpis}
            isLoading={isLoading}
            setFilters={setFilters}
          />
        </div>
      </div>
    </TooltipProvider>
  );
}
