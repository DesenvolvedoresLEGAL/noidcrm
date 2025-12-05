import { useQuery } from '@tanstack/react-query';
import { 
  getPipelineMetrics, 
  getSalesPipelineMetrics, 
  getQualificationPipelineMetrics,
  getSDRPerformance,
  getCloserPerformance,
  getStageConversionMetrics,
  getHandoffMetrics,
  getDashboardMetrics,
  PipelineMetrics,
  SDRPerformance,
  CloserPerformance,
  StageConversionMetrics,
  HandoffMetrics
} from '@/services/crm/pipeline-metrics';
import { useTeamVisibility } from './useTeamVisibility';

export function usePipelineMetrics() {
  const { visibleUserIds, loading: visibilityLoading } = useTeamVisibility();
  
  return useQuery<PipelineMetrics[]>({
    queryKey: ['pipeline-metrics', visibleUserIds],
    queryFn: () => getPipelineMetrics(visibleUserIds),
    enabled: !visibilityLoading,
  });
}

export function useSalesPipelineMetrics() {
  const { visibleUserIds, loading: visibilityLoading } = useTeamVisibility();
  
  return useQuery<PipelineMetrics[]>({
    queryKey: ['sales-pipeline-metrics', visibleUserIds],
    queryFn: () => getSalesPipelineMetrics(visibleUserIds),
    enabled: !visibilityLoading,
  });
}

export function useQualificationPipelineMetrics() {
  const { visibleUserIds, loading: visibilityLoading } = useTeamVisibility();
  
  return useQuery<PipelineMetrics[]>({
    queryKey: ['qualification-pipeline-metrics', visibleUserIds],
    queryFn: () => getQualificationPipelineMetrics(visibleUserIds),
    enabled: !visibilityLoading,
  });
}

export function useSDRPerformance() {
  const { visibleUserIds, loading: visibilityLoading } = useTeamVisibility();
  
  return useQuery<SDRPerformance[]>({
    queryKey: ['sdr-performance', visibleUserIds],
    queryFn: () => getSDRPerformance(visibleUserIds),
    enabled: !visibilityLoading,
  });
}

export function useCloserPerformance() {
  const { visibleUserIds, loading: visibilityLoading } = useTeamVisibility();
  
  return useQuery<CloserPerformance[]>({
    queryKey: ['closer-performance', visibleUserIds],
    queryFn: () => getCloserPerformance(visibleUserIds),
    enabled: !visibilityLoading,
  });
}

export function useStageConversionMetrics() {
  const { visibleUserIds, loading: visibilityLoading } = useTeamVisibility();
  
  return useQuery<StageConversionMetrics[]>({
    queryKey: ['stage-conversion-metrics', visibleUserIds],
    queryFn: () => getStageConversionMetrics(visibleUserIds),
    enabled: !visibilityLoading,
  });
}

export function useHandoffMetrics() {
  const { visibleUserIds, loading: visibilityLoading } = useTeamVisibility();
  
  return useQuery<HandoffMetrics[]>({
    queryKey: ['handoff-metrics', visibleUserIds],
    queryFn: () => getHandoffMetrics(visibleUserIds),
    enabled: !visibilityLoading,
  });
}

export function useDashboardMetrics() {
  const { visibleUserIds, loading: visibilityLoading } = useTeamVisibility();
  
  return useQuery({
    queryKey: ['dashboard-metrics', visibleUserIds],
    queryFn: () => getDashboardMetrics(visibleUserIds),
    enabled: !visibilityLoading,
  });
}
