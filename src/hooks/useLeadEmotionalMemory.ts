import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface LeadEmotionalMemory {
  id: string;
  organization_id: string;
  opportunity_id: string | null;
  contact_id: string | null;
  account_id: string | null;
  positive_triggers: string[];
  negative_triggers: string[];
  ideal_tone: 'direto' | 'tecnico' | 'provocativo' | 'humano' | 'acolhedor' | 'formal' | null;
  response_rhythm: 'rapido' | 'reflexivo' | 'lento' | null;
  preferred_channel: string | null;
  best_contact_time: string | null;
  dominant_objection_type: 'preco' | 'tempo' | 'autoridade' | 'necessidade' | 'concorrencia' | 'confianca' | null;
  past_objections: any[];
  last_interaction_summary: string | null;
  last_emotional_state: string | null;
  risk_of_vibe_break: 'low' | 'medium' | 'high' | 'critical' | null;
  vibe_break_reason: string | null;
  communication_patterns: any;
  decision_style: string | null;
  buying_signals: string[];
  ai_confidence: number | null;
  last_ai_analysis_at: string | null;
  analysis_version: number;
  created_at: string;
  updated_at: string;
}

export function useLeadEmotionalMemory(opportunityId: string | undefined) {
  return useQuery({
    queryKey: ['lead-emotional-memory', opportunityId],
    queryFn: async (): Promise<LeadEmotionalMemory | null> => {
      if (!opportunityId) return null;
      
      const { data, error } = await supabase
        .from('lead_emotional_memory')
        .select('*')
        .eq('opportunity_id', opportunityId)
        .maybeSingle();

      if (error) {
        console.error('Erro ao buscar memória emocional:', error);
        throw error;
      }

      return data as LeadEmotionalMemory | null;
    },
    enabled: !!opportunityId,
    staleTime: 1000 * 60 * 5, // 5 minutos
  });
}

export function useUpdateEmotionalMemory() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ opportunityId, forceAnalysis = false }: { opportunityId: string; forceAnalysis?: boolean }) => {
      const { data, error } = await supabase.functions.invoke('update-emotional-memory', {
        body: { opportunityId, forceAnalysis },
      });

      if (error) {
        // Surface edge function JSON errors when available
        const details = (error as any)?.context?.body?.error || (error as any)?.message;
        throw new Error(details || 'Falha ao executar update-emotional-memory');
      }

      return data;
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['lead-emotional-memory', variables.opportunityId] });
    },
  });
}

// Hook para buscar memórias emocionais com risco alto
export function useHighRiskMemories(organizationId: string | undefined) {
  return useQuery({
    queryKey: ['high-risk-memories', organizationId],
    queryFn: async () => {
      if (!organizationId) return [];
      
      const { data, error } = await supabase
        .from('lead_emotional_memory')
        .select(`
          *,
          opportunity:opportunities(id, title, value, owner_user_id, account:accounts(razao_social))
        `)
        .eq('organization_id', organizationId)
        .in('risk_of_vibe_break', ['high', 'critical'])
        .order('updated_at', { ascending: false })
        .limit(20);

      if (error) throw error;
      return data;
    },
    enabled: !!organizationId,
    staleTime: 1000 * 60 * 2, // 2 minutos
  });
}
