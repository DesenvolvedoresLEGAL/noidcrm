import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useCurrentUser } from './useCurrentUser';
import { toast } from 'sonner';

export interface ConversionBenchmark {
  id: string;
  organization_id: string;
  channel: string;
  metric: string;
  min_threshold: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface ConversionAlert {
  id: string;
  organization_id: string;
  benchmark_id: string | null;
  channel: string;
  metric: string;
  current_value: number;
  threshold_value: number;
  previous_value: number | null;
  trend_direction: 'up' | 'down' | 'stable' | null;
  trend_percentage: number | null;
  severity: 'info' | 'warning' | 'critical';
  status: 'active' | 'acknowledged' | 'resolved';
  acknowledged_by: string | null;
  acknowledged_at: string | null;
  resolved_at: string | null;
  created_at: string;
}

export function useConversionBenchmarks() {
  const { organization } = useCurrentUser();
  const queryClient = useQueryClient();
  
  const { data: benchmarks, isLoading } = useQuery({
    queryKey: ['conversion-benchmarks', organization?.id],
    queryFn: async () => {
      if (!organization?.id) return [];
      
      const { data, error } = await supabase
        .from('conversion_benchmarks')
        .select('*')
        .eq('organization_id', organization.id)
        .order('channel', { ascending: true });
      
      if (error) throw error;
      return data as ConversionBenchmark[];
    },
    enabled: !!organization?.id,
  });
  
  const { mutateAsync: updateBenchmark } = useMutation({
    mutationFn: async ({ id, min_threshold, is_active }: { id: string; min_threshold?: number; is_active?: boolean }) => {
      const updates: any = { updated_at: new Date().toISOString() };
      if (min_threshold !== undefined) updates.min_threshold = min_threshold;
      if (is_active !== undefined) updates.is_active = is_active;
      
      const { data, error } = await supabase
        .from('conversion_benchmarks')
        .update(updates)
        .eq('id', id)
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['conversion-benchmarks'] });
      toast.success('Benchmark atualizado');
    },
    onError: (error) => {
      toast.error('Erro ao atualizar benchmark');
      console.error(error);
    },
  });
  
  const { mutateAsync: createBenchmark } = useMutation({
    mutationFn: async ({ channel, metric, min_threshold }: { channel: string; metric: string; min_threshold: number }) => {
      if (!organization?.id) throw new Error('No organization');
      
      const { data, error } = await supabase
        .from('conversion_benchmarks')
        .upsert({
          organization_id: organization.id,
          channel,
          metric,
          min_threshold,
          is_active: true,
        })
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['conversion-benchmarks'] });
      toast.success('Benchmark criado');
    },
  });
  
  return {
    benchmarks,
    isLoading,
    updateBenchmark,
    createBenchmark,
  };
}

export function useConversionAlerts() {
  const { organization } = useCurrentUser();
  const queryClient = useQueryClient();
  
  const { data: alerts, isLoading } = useQuery({
    queryKey: ['conversion-alerts', organization?.id],
    queryFn: async () => {
      if (!organization?.id) return [];
      
      const { data, error } = await supabase
        .from('conversion_alerts')
        .select('*')
        .eq('organization_id', organization.id)
        .eq('status', 'active')
        .order('created_at', { ascending: false })
        .limit(10);
      
      if (error) throw error;
      return data as ConversionAlert[];
    },
    enabled: !!organization?.id,
  });
  
  const { mutateAsync: acknowledgeAlert } = useMutation({
    mutationFn: async (alertId: string) => {
      const { data: userData } = await supabase.auth.getUser();
      
      const { data, error } = await supabase
        .from('conversion_alerts')
        .update({
          status: 'acknowledged',
          acknowledged_by: userData.user?.id,
          acknowledged_at: new Date().toISOString(),
        })
        .eq('id', alertId)
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['conversion-alerts'] });
      toast.success('Alerta reconhecido');
    },
  });
  
  const { mutateAsync: resolveAlert } = useMutation({
    mutationFn: async (alertId: string) => {
      const { data, error } = await supabase
        .from('conversion_alerts')
        .update({
          status: 'resolved',
          resolved_at: new Date().toISOString(),
        })
        .eq('id', alertId)
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['conversion-alerts'] });
      toast.success('Alerta resolvido');
    },
  });
  
  const { mutateAsync: createAlert } = useMutation({
    mutationFn: async (alert: {
      channel: string;
      metric: string;
      current_value: number;
      threshold_value: number;
      previous_value?: number;
      trend_direction?: string;
      trend_percentage?: number;
      severity: string;
      benchmark_id?: string;
    }) => {
      if (!organization?.id) throw new Error('No organization');
      
      const { data, error } = await supabase
        .from('conversion_alerts')
        .insert({
          organization_id: organization.id,
          ...alert,
        })
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['conversion-alerts'] });
    },
  });
  
  return {
    alerts,
    isLoading,
    acknowledgeAlert,
    resolveAlert,
    createAlert,
  };
}

// Hook to check rates against benchmarks and create alerts if needed
export function useCheckConversionAlerts() {
  const { organization } = useCurrentUser();
  const { benchmarks } = useConversionBenchmarks();
  const { createAlert, alerts } = useConversionAlerts();
  
  const checkAndCreateAlerts = async (rates: {
    overall: { winRate: number };
    byChannel: Array<{ channel: string; winRate: number; proposalToSale: number }>;
    trends: {
      overall: { current: number; previous: number; change: number; direction: string };
      byChannel: Array<{ channel: string; winRate: { current: number; previous: number; change: number; direction: string } }>;
    };
  }) => {
    if (!organization?.id || !benchmarks?.length) return;
    
    const activeBenchmarks = benchmarks.filter(b => b.is_active);
    
    for (const benchmark of activeBenchmarks) {
      let currentValue = 0;
      let trend = rates.trends.overall;
      
      if (benchmark.channel === 'overall') {
        if (benchmark.metric === 'win_rate') {
          currentValue = rates.overall.winRate;
        }
      } else {
        const channelData = rates.byChannel.find(c => c.channel === benchmark.channel);
        const channelTrend = rates.trends.byChannel.find(c => c.channel === benchmark.channel);
        
        if (channelData) {
          if (benchmark.metric === 'win_rate') {
            currentValue = channelData.winRate;
            if (channelTrend) trend = channelTrend.winRate as any;
          } else if (benchmark.metric === 'proposal_to_sale') {
            currentValue = channelData.proposalToSale;
            if (channelTrend) trend = channelTrend.winRate as any;
          }
        }
      }
      
      // Check if below threshold
      if (currentValue < benchmark.min_threshold && currentValue > 0) {
        // Check if alert already exists for this benchmark
        const existingAlert = alerts?.find(
          a => a.channel === benchmark.channel && 
               a.metric === benchmark.metric && 
               a.status === 'active'
        );
        
        if (!existingAlert) {
          // Determine severity
          const deficit = benchmark.min_threshold - currentValue;
          let severity: 'info' | 'warning' | 'critical' = 'info';
          if (deficit > 20) severity = 'critical';
          else if (deficit > 10) severity = 'warning';
          
          await createAlert({
            channel: benchmark.channel,
            metric: benchmark.metric,
            current_value: currentValue,
            threshold_value: benchmark.min_threshold,
            previous_value: trend.previous,
            trend_direction: trend.direction,
            trend_percentage: trend.change,
            severity,
            benchmark_id: benchmark.id,
          });
        }
      }
    }
  };
  
  return { checkAndCreateAlerts };
}
