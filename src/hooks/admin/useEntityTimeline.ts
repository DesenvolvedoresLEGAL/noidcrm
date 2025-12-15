import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface TimelineEvent {
  id: string;
  timestamp: string;
  type: 'event' | 'audit' | 'ai_run' | 'workflow';
  source: 'user' | 'system' | 'automation' | 'ai_agent';
  action: string;
  description: string;
  traceId: string;
  metadata?: Record<string, any>;
  status?: 'success' | 'failed' | 'pending' | 'running';
  latencyMs?: number;
  actorName?: string;
}

export function useEntityTimeline(entityType: string, entityId: string) {
  return useQuery({
    queryKey: ['entity-timeline', entityType, entityId],
    queryFn: async (): Promise<TimelineEvent[]> => {
      const timeline: TimelineEvent[] = [];

      // Fetch system events for this entity
      const { data: events } = await supabase
        .from('system_events')
        .select('*')
        .eq('entity_type', entityType)
        .eq('entity_id', entityId)
        .order('created_at', { ascending: false });

      if (events) {
        timeline.push(
          ...events.map((e) => ({
            id: e.id,
            timestamp: e.created_at,
            type: 'event' as const,
            source: e.actor_type as 'user' | 'system' | 'automation' | 'ai_agent',
            action: e.event_type,
            description: `${e.action}: ${e.event_type}`,
            traceId: e.trace_id,
            metadata: e.payload as Record<string, any>,
            actorName: e.actor_name || undefined,
          }))
        );
      }

      // Fetch audit logs for this entity
      const { data: auditLogs } = await supabase
        .from('audit_log')
        .select('*')
        .eq('entity_type', entityType)
        .eq('entity_id', entityId)
        .order('created_at', { ascending: false });

      if (auditLogs) {
        timeline.push(
          ...auditLogs.map((a) => ({
            id: a.id,
            timestamp: a.created_at || new Date().toISOString(),
            type: 'audit' as const,
            source: 'user' as const,
            action: a.action,
            description: a.field_name
              ? `${a.action}: ${a.field_name}`
              : a.action,
            traceId: a.trace_id || '',
            metadata: {
              old_value: a.old_value,
              new_value: a.new_value,
              field_name: a.field_name,
            },
          }))
        );
      }

      // Fetch AI runs for this entity
      const { data: aiRuns } = await supabase
        .from('ai_runs')
        .select('*')
        .eq('entity_type', entityType)
        .eq('entity_id', entityId)
        .order('created_at', { ascending: false });

      if (aiRuns) {
        timeline.push(
          ...aiRuns.map((r) => ({
            id: r.id,
            timestamp: r.created_at,
            type: 'ai_run' as const,
            source: 'ai_agent' as const,
            action: r.feature,
            description: `AI ${r.run_type}: ${r.feature}`,
            traceId: r.trace_id,
            metadata: {
              model: r.model_used,
              tokens: r.tokens_input + r.tokens_output,
              volts: r.volts_consumed,
            },
            status: r.status as 'success' | 'failed' | 'pending' | 'running',
            latencyMs: r.latency_ms || undefined,
          }))
        );
      }

      // Fetch workflow executions for this entity (opportunities)
      if (entityType === 'opportunity') {
        const { data: workflows } = await supabase
          .from('workflow_executions')
          .select('*')
          .eq('opportunity_id', entityId)
          .order('created_at', { ascending: false });

        if (workflows) {
          timeline.push(
            ...workflows.map((w) => ({
              id: w.id,
              timestamp: w.created_at,
              type: 'workflow' as const,
              source: 'automation' as const,
              action: w.trigger_type,
              description: `Workflow: ${w.trigger_type}`,
              traceId: w.trace_id || '',
              metadata: w.trigger_data as Record<string, any>,
              status: w.status as 'success' | 'failed' | 'pending' | 'running',
            }))
          );
        }
      }

      // Sort by timestamp descending
      timeline.sort(
        (a, b) =>
          new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
      );

      return timeline;
    },
    enabled: !!entityType && !!entityId,
  });
}

export function useTraceTimeline(traceId: string) {
  return useQuery({
    queryKey: ['trace-timeline', traceId],
    queryFn: async (): Promise<TimelineEvent[]> => {
      const timeline: TimelineEvent[] = [];

      // Fetch all system events with this trace_id
      const { data: events } = await supabase
        .from('system_events')
        .select('*')
        .eq('trace_id', traceId)
        .order('created_at', { ascending: true });

      if (events) {
        timeline.push(
          ...events.map((e) => ({
            id: e.id,
            timestamp: e.created_at,
            type: 'event' as const,
            source: e.actor_type as 'user' | 'system' | 'automation' | 'ai_agent',
            action: e.event_type,
            description: `${e.action}: ${e.event_type}`,
            traceId: e.trace_id,
            metadata: e.payload as Record<string, any>,
            actorName: e.actor_name || undefined,
          }))
        );
      }

      // Fetch audit logs with this trace_id
      const { data: auditLogs } = await supabase
        .from('audit_log')
        .select('*')
        .eq('trace_id', traceId)
        .order('created_at', { ascending: true });

      if (auditLogs) {
        timeline.push(
          ...auditLogs.map((a) => ({
            id: a.id,
            timestamp: a.created_at || new Date().toISOString(),
            type: 'audit' as const,
            source: 'user' as const,
            action: a.action,
            description: a.field_name
              ? `${a.action}: ${a.field_name}`
              : a.action,
            traceId: a.trace_id || '',
            metadata: {
              old_value: a.old_value,
              new_value: a.new_value,
              field_name: a.field_name,
            },
          }))
        );
      }

      // Fetch AI runs with this trace_id
      const { data: aiRuns } = await supabase
        .from('ai_runs')
        .select('*')
        .eq('trace_id', traceId)
        .order('created_at', { ascending: true });

      if (aiRuns) {
        timeline.push(
          ...aiRuns.map((r) => ({
            id: r.id,
            timestamp: r.created_at,
            type: 'ai_run' as const,
            source: 'ai_agent' as const,
            action: r.feature,
            description: `AI ${r.run_type}: ${r.feature}`,
            traceId: r.trace_id,
            metadata: {
              model: r.model_used,
              tokens: r.tokens_input + r.tokens_output,
              volts: r.volts_consumed,
            },
            status: r.status as 'success' | 'failed' | 'pending' | 'running',
            latencyMs: r.latency_ms || undefined,
          }))
        );
      }

      // Sort by timestamp ascending (chronological order for trace)
      timeline.sort(
        (a, b) =>
          new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
      );

      return timeline;
    },
    enabled: !!traceId,
  });
}
