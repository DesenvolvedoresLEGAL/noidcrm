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

export function usePipelineMetrics() {
  return useQuery<PipelineMetrics[]>({
    queryKey: ['pipeline-metrics'],
    queryFn: getPipelineMetrics,
  });
}

export function useSalesPipelineMetrics() {
  return useQuery<PipelineMetrics[]>({
    queryKey: ['sales-pipeline-metrics'],
    queryFn: getSalesPipelineMetrics,
  });
}

export function useQualificationPipelineMetrics() {
  return useQuery<PipelineMetrics[]>({
    queryKey: ['qualification-pipeline-metrics'],
    queryFn: getQualificationPipelineMetrics,
  });
}

export function useSDRPerformance() {
  return useQuery<SDRPerformance[]>({
    queryKey: ['sdr-performance'],
    queryFn: getSDRPerformance,
  });
}

export function useCloserPerformance() {
  return useQuery<CloserPerformance[]>({
    queryKey: ['closer-performance'],
    queryFn: getCloserPerformance,
  });
}

export function useStageConversionMetrics() {
  return useQuery<StageConversionMetrics[]>({
    queryKey: ['stage-conversion-metrics'],
    queryFn: getStageConversionMetrics,
  });
}

export function useHandoffMetrics() {
  return useQuery<HandoffMetrics[]>({
    queryKey: ['handoff-metrics'],
    queryFn: getHandoffMetrics,
  });
}

export function useDashboardMetrics() {
  return useQuery({
    queryKey: ['dashboard-metrics'],
    queryFn: getDashboardMetrics,
  });
}
