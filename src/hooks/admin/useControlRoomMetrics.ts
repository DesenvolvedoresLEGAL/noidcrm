import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface StatusCardMetrics {
  id: string;
  label: string;
  value: string | number;
  subValue: string;
  status: 'online' | 'degraded' | 'offline' | 'busy';
  trend?: number;
  icon: string;
}

export interface RecentExecution {
  id: string;
  timestamp: string;
  type: 'user' | 'ai' | 'automation' | 'system';
  action: string;
  entityType: string;
  entityId: string;
  status: 'success' | 'failed' | 'pending';
  latencyMs?: number;
  traceId: string;
}

export function useControlRoomMetrics() {
  const metricsQuery = useQuery({
    queryKey: ['control-room-metrics'],
    queryFn: async () => {
      const now = new Date();
      const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);

      // Fetch events count 24h
      const { count: eventsCount24h } = await supabase
        .from('system_events')
        .select('*', { count: 'exact', head: true })
        .gte('created_at', yesterday.toISOString());

      // Fetch total events
      const { count: totalEvents } = await supabase
        .from('system_events')
        .select('*', { count: 'exact', head: true });

      // Fetch last event
      const { data: lastEvent } = await supabase
        .from('system_events')
        .select('created_at')
        .order('created_at', { ascending: false })
        .limit(1)
        .single();

      // Fetch AI runs 24h
      const { count: aiRuns24h } = await supabase
        .from('ai_runs')
        .select('*', { count: 'exact', head: true })
        .gte('created_at', yesterday.toISOString());

      // Fetch running AI runs
      const { count: runningAiRuns } = await supabase
        .from('ai_runs')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'running');

      // Fetch total AI runs
      const { count: totalAiRuns } = await supabase
        .from('ai_runs')
        .select('*', { count: 'exact', head: true });

      // Fetch workflow executions 24h
      const { count: workflows24h } = await supabase
        .from('workflow_executions')
        .select('*', { count: 'exact', head: true })
        .gte('created_at', yesterday.toISOString());

      // Fetch active playbooks
      const { count: activePlaybooks } = await supabase
        .from('ai_playbooks')
        .select('*', { count: 'exact', head: true })
        .eq('is_active', true);

      // Calculate metrics
      const cards: StatusCardMetrics[] = [
        {
          id: 'events',
          label: 'Events',
          value: totalEvents || 0,
          subValue: `+${eventsCount24h || 0} 24h`,
          status: 'online',
          icon: 'Activity',
        },
        {
          id: 'graph',
          label: 'Graph',
          value: 'Active',
          subValue: '100%',
          status: 'online',
          icon: 'Share2',
        },
        {
          id: 'memory',
          label: 'Memory',
          value: '2.1GB',
          subValue: 'Ready',
          status: 'online',
          icon: 'Database',
        },
        {
          id: 'agents',
          label: 'Agents',
          value: `${runningAiRuns || 0}/${totalAiRuns || 0}`,
          subValue: `+${aiRuns24h || 0} 24h`,
          status: runningAiRuns && runningAiRuns > 0 ? 'busy' : 'online',
          icon: 'Bot',
        },
        {
          id: 'playbooks',
          label: 'Playbooks',
          value: activePlaybooks || 0,
          subValue: `${workflows24h || 0} execuções 24h`,
          status: 'online',
          icon: 'BookOpen',
        },
      ];

      return {
        cards,
        lastEventAt: lastEvent?.created_at,
      };
    },
    refetchInterval: 60000, // Fase 1A: 30s → 60s
  });

  const recentExecutionsQuery = useQuery({
    queryKey: ['control-room-recent-executions'],
    queryFn: async (): Promise<RecentExecution[]> => {
      // Fetch recent system events
      const { data: events } = await supabase
        .from('system_events')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(20);

      if (!events) return [];

      return events.map((event) => ({
        id: event.id,
        timestamp: event.created_at,
        type: event.actor_type as 'user' | 'ai' | 'automation' | 'system',
        action: event.event_type,
        entityType: event.entity_type || 'system',
        entityId: event.entity_id || '',
        status: 'success' as const,
        traceId: event.trace_id,
      }));
    },
    refetchInterval: 30000, // Fase 1A: 10s → 30s
  });

  return {
    metrics: metricsQuery.data,
    isLoadingMetrics: metricsQuery.isLoading,
    recentExecutions: recentExecutionsQuery.data || [],
    isLoadingExecutions: recentExecutionsQuery.isLoading,
    refetch: () => {
      metricsQuery.refetch();
      recentExecutionsQuery.refetch();
    },
  };
}
