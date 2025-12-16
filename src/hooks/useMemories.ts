import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import { toast } from 'sonner';

export type MemoryType = 
  | 'objection' 
  | 'win_pattern' 
  | 'loss_pattern' 
  | 'churn_signal' 
  | 'converting_language' 
  | 'countermeasure';

export interface Memory {
  id: string;
  organization_id: string;
  memory_type: MemoryType;
  title: string;
  content: string;
  keywords: string[];
  source_type: string;
  source_id: string | null;
  source_metadata: Record<string, any>;
  industry: string | null;
  deal_size: string | null;
  persona: string | null;
  stage: string | null;
  pipeline_id: string | null;
  confidence_score: number;
  success_rate: number | null;
  usage_count: number;
  positive_outcomes: number;
  negative_outcomes: number;
  last_used_at: string | null;
  validated: boolean;
  validated_by: string | null;
  validated_at: string | null;
  status: string;
  expires_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface MemoryRead {
  id: string;
  organization_id: string;
  memory_id: string;
  read_context: string;
  entity_type: string | null;
  entity_id: string | null;
  triggered_by: string;
  user_id: string | null;
  ai_function: string | null;
  outcome: string | null;
  outcome_reason: string | null;
  effectiveness_score: number | null;
  created_at: string;
}

interface UseMemoriesOptions {
  memoryTypes?: MemoryType[];
  industry?: string;
  stage?: string;
  pipelineId?: string;
  status?: string;
  limit?: number;
}

export function useMemories(options: UseMemoriesOptions = {}) {
  const { data: currentUser } = useCurrentUser();
  const organizationId = currentUser?.profile?.organization_id;

  return useQuery({
    queryKey: ['memories', organizationId, options],
    queryFn: async () => {
      if (!organizationId) return [];

      let query = supabase
        .from('memories')
        .select('*')
        .eq('organization_id', organizationId)
        .order('usage_count', { ascending: false })
        .order('created_at', { ascending: false });

      if (options.memoryTypes?.length) {
        query = query.in('memory_type', options.memoryTypes);
      }
      if (options.industry) {
        query = query.eq('industry', options.industry);
      }
      if (options.stage) {
        query = query.eq('stage', options.stage);
      }
      if (options.pipelineId) {
        query = query.eq('pipeline_id', options.pipelineId);
      }
      if (options.status) {
        query = query.eq('status', options.status);
      } else {
        query = query.eq('status', 'active');
      }
      if (options.limit) {
        query = query.limit(options.limit);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data as Memory[];
    },
    enabled: !!organizationId
  });
}

export function useRelevantMemories(context: {
  memoryTypes?: MemoryType[];
  industry?: string | null;
  stage?: string;
  pipelineId?: string;
  keywords?: string[];
  limit?: number;
}) {
  const { data: currentUser } = useCurrentUser();
  const organizationId = currentUser?.profile?.organization_id;

  return useQuery({
    queryKey: ['relevant-memories', organizationId, context],
    queryFn: async () => {
      if (!organizationId) return [];

      const { data, error } = await supabase.rpc('get_relevant_memories', {
        p_organization_id: organizationId,
        p_context: 'deal_analysis',
        p_memory_types: context.memoryTypes || null,
        p_industry: context.industry || null,
        p_stage: context.stage || null,
        p_pipeline_id: context.pipelineId || null,
        p_keywords: context.keywords || null,
        p_limit: context.limit || 10
      });

      if (error) throw error;
      return data as (Memory & { relevance_score: number })[];
    },
    enabled: !!organizationId
  });
}

export function useMemoryStats() {
  const { data: currentUser } = useCurrentUser();
  const organizationId = currentUser?.profile?.organization_id;

  return useQuery({
    queryKey: ['memory-stats', organizationId],
    queryFn: async () => {
      if (!organizationId) return null;

      const { data: memories, error } = await supabase
        .from('memories')
        .select('memory_type, status, usage_count, success_rate')
        .eq('organization_id', organizationId);

      if (error) throw error;

      const stats = {
        total: memories?.length || 0,
        byType: {} as Record<string, number>,
        active: 0,
        totalUsage: 0,
        avgSuccessRate: 0
      };

      let successRateSum = 0;
      let successRateCount = 0;

      memories?.forEach(m => {
        stats.byType[m.memory_type] = (stats.byType[m.memory_type] || 0) + 1;
        if (m.status === 'active') stats.active++;
        stats.totalUsage += m.usage_count || 0;
        if (m.success_rate !== null) {
          successRateSum += m.success_rate;
          successRateCount++;
        }
      });

      stats.avgSuccessRate = successRateCount > 0 
        ? successRateSum / successRateCount 
        : 0;

      return stats;
    },
    enabled: !!organizationId
  });
}

export function useMemoryReads(memoryId?: string) {
  const { data: currentUser } = useCurrentUser();
  const organizationId = currentUser?.profile?.organization_id;

  return useQuery({
    queryKey: ['memory-reads', organizationId, memoryId],
    queryFn: async () => {
      if (!organizationId) return [];

      let query = supabase
        .from('memory_reads')
        .select('*')
        .eq('organization_id', organizationId)
        .order('created_at', { ascending: false })
        .limit(100);

      if (memoryId) {
        query = query.eq('memory_id', memoryId);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data as MemoryRead[];
    },
    enabled: !!organizationId
  });
}

export function useCreateMemory() {
  const queryClient = useQueryClient();
  const { data: currentUser } = useCurrentUser();

  return useMutation({
    mutationFn: async (memory: Partial<Memory>) => {
      const orgId = currentUser?.profile?.organization_id;
      if (!orgId) throw new Error('No organization');

      const { data, error } = await supabase
        .from('memories')
        .insert({
          organization_id: orgId,
          memory_type: memory.memory_type!,
          title: memory.title!,
          content: memory.content!,
          keywords: memory.keywords || [],
          source_type: memory.source_type || 'manual',
          source_id: memory.source_id,
          source_metadata: memory.source_metadata || {},
          industry: memory.industry,
          deal_size: memory.deal_size,
          persona: memory.persona,
          stage: memory.stage,
          pipeline_id: memory.pipeline_id,
          confidence_score: memory.confidence_score || 0.5
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['memories'] });
      queryClient.invalidateQueries({ queryKey: ['memory-stats'] });
      toast.success('Memória criada com sucesso');
    },
    onError: () => {
      toast.error('Erro ao criar memória');
    }
  });
}

export function useUpdateMemory() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, ...updates }: Partial<Memory> & { id: string }) => {
      const { data, error } = await supabase
        .from('memories')
        .update(updates as any)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['memories'] });
      queryClient.invalidateQueries({ queryKey: ['memory-stats'] });
      toast.success('Memória atualizada');
    },
    onError: () => {
      toast.error('Erro ao atualizar memória');
    }
  });
}

export function useRecordMemoryRead() {
  const queryClient = useQueryClient();
  const { data: currentUser } = useCurrentUser();

  return useMutation({
    mutationFn: async ({
      memoryId,
      context,
      entityType,
      entityId,
      triggeredBy = 'user',
      aiFunction
    }: {
      memoryId: string;
      context: string;
      entityType?: string;
      entityId?: string;
      triggeredBy?: string;
      aiFunction?: string;
    }) => {
      const orgId = currentUser?.profile?.organization_id;
      if (!orgId) throw new Error('No organization');

      const { data, error } = await supabase
        .from('memory_reads')
        .insert({
          organization_id: orgId,
          memory_id: memoryId,
          read_context: context,
          entity_type: entityType,
          entity_id: entityId,
          triggered_by: triggeredBy,
          user_id: currentUser?.user?.id,
          ai_function: aiFunction,
          outcome: 'pending'
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['memories'] });
      queryClient.invalidateQueries({ queryKey: ['memory-reads'] });
    }
  });
}

export function useUpdateMemoryOutcome() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      readId,
      outcome,
      reason,
      effectivenessScore
    }: {
      readId: string;
      outcome: 'applied' | 'ignored' | 'rejected';
      reason?: string;
      effectivenessScore?: number;
    }) => {
      const { data, error } = await supabase
        .from('memory_reads')
        .update({
          outcome,
          outcome_reason: reason,
          effectiveness_score: effectivenessScore
        })
        .eq('id', readId)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['memories'] });
      queryClient.invalidateQueries({ queryKey: ['memory-reads'] });
    }
  });
}
