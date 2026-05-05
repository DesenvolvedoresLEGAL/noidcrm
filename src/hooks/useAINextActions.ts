import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { getNextActions, type NextAction } from '@/services/crm/ai-sales';
import { useToast } from '@/hooks/use-toast';

interface StoredAction {
  id: string;
  action: NextAction;
  created_at: string;
}

interface UseAINextActionsReturn {
  actions: StoredAction[];
  overallStrategy: string | null;
  urgencyLevel: string | null;
  loading: boolean;
  generating: boolean;
  generate: () => Promise<void>;
  acceptAction: (actionId: string) => Promise<void>;
  dismissAction: (actionId: string) => Promise<void>;
}

export function useAINextActions(opportunityId: string): UseAINextActionsReturn {
  const [actions, setActions] = useState<StoredAction[]>([]);
  const [overallStrategy, setOverallStrategy] = useState<string | null>(null);
  const [urgencyLevel, setUrgencyLevel] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const { toast } = useToast();

  // Load existing pending suggestions from database (NO AI call).
  const fetchSavedActions = useCallback(async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('ai_suggestions')
        .select('*')
        .eq('opportunity_id', opportunityId)
        .eq('suggestion_type', 'next_action')
        .eq('status', 'pending')
        .order('created_at', { ascending: true });

      if (error) throw error;

      if (data && data.length > 0) {
        const storedActions: StoredAction[] = data.map((row) => ({
          id: row.id,
          action: row.suggested_value as unknown as NextAction,
          created_at: row.created_at,
        }));
        setActions(storedActions);

        const firstSuggestion = data[0];
        if (firstSuggestion.current_value) {
          const metadata = firstSuggestion.current_value as { overall_strategy?: string; urgency_level?: string };
          setOverallStrategy(metadata.overall_strategy || null);
          setUrgencyLevel(metadata.urgency_level || null);
        } else {
          setOverallStrategy(null);
          setUrgencyLevel(null);
        }
      } else {
        setActions([]);
        setOverallStrategy(null);
        setUrgencyLevel(null);
      }
    } catch (error) {
      console.error('Error fetching saved actions:', error);
    } finally {
      setLoading(false);
    }
  }, [opportunityId]);

  useEffect(() => {
    fetchSavedActions();
  }, [fetchSavedActions]);

  // Manually trigger AI generation. The edge function decides cache vs regenerate
  // based on the opportunity's context signature; we pass force_refresh=true so a
  // user click always forces a fresh analysis.
  const generate = async () => {
    try {
      setGenerating(true);
      await getNextActions(opportunityId, true);
      // Edge function persists results; just reload from DB.
      await fetchSavedActions();
      toast({
        title: 'Ações geradas',
        description: 'Próximas ações sugeridas atualizadas.',
      });
    } catch (error) {
      console.error('Error generating actions:', error);
      toast({
        title: 'Erro ao gerar ações',
        description: 'Não foi possível gerar as próximas ações. Tente novamente.',
        variant: 'destructive',
      });
    } finally {
      setGenerating(false);
    }
  };

  const acceptAction = async (actionId: string) => {
    try {
      const { error } = await supabase
        .from('ai_suggestions')
        .update({
          status: 'accepted',
          action_taken_at: new Date().toISOString(),
        })
        .eq('id', actionId);

      if (error) throw error;
      setActions((prev) => prev.filter((a) => a.id !== actionId));
    } catch (error) {
      console.error('Error accepting action:', error);
    }
  };

  const dismissAction = async (actionId: string) => {
    try {
      const { error } = await supabase
        .from('ai_suggestions')
        .update({
          status: 'dismissed',
          action_taken_at: new Date().toISOString(),
        })
        .eq('id', actionId);

      if (error) throw error;
      setActions((prev) => prev.filter((a) => a.id !== actionId));
      toast({
        title: 'Ação ignorada',
        description: 'A sugestão foi removida da lista.',
      });
    } catch (error) {
      console.error('Error dismissing action:', error);
      toast({
        title: 'Erro',
        description: 'Não foi possível ignorar a ação.',
        variant: 'destructive',
      });
    }
  };

  return {
    actions,
    overallStrategy,
    urgencyLevel,
    loading,
    generating,
    generate,
    acceptAction,
    dismissAction,
  };
}
