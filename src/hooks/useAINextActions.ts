import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { getNextActions, type NextAction } from '@/services/crm/ai-sales';
import { useToast } from '@/hooks/use-toast';
import type { Json } from '@/integrations/supabase/types';

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

  // Fetch existing pending suggestions from database
  const fetchSavedActions = useCallback(async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('ai_suggestions')
        .select('*')
        .eq('opportunity_id', opportunityId)
        .eq('suggestion_type', 'next_action')
        .eq('status', 'pending')
        .order('created_at', { ascending: false });

      if (error) throw error;

      if (data && data.length > 0) {
        // Extract actions from suggested_value JSONB
        const storedActions: StoredAction[] = data.map((row) => ({
          id: row.id,
          action: row.suggested_value as unknown as NextAction,
          created_at: row.created_at,
        }));
        setActions(storedActions);

        // Get strategy from the first suggestion's current_value (we store it there)
        const firstSuggestion = data[0];
        if (firstSuggestion.current_value) {
          const metadata = firstSuggestion.current_value as { overall_strategy?: string; urgency_level?: string };
          setOverallStrategy(metadata.overall_strategy || null);
          setUrgencyLevel(metadata.urgency_level || null);
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

  // Generate new actions and save to database
  const generate = async () => {
    try {
      setGenerating(true);

      // Call AI to generate actions
      const result = await getNextActions(opportunityId);

      // Delete existing pending suggestions for this opportunity
      await supabase
        .from('ai_suggestions')
        .delete()
        .eq('opportunity_id', opportunityId)
        .eq('suggestion_type', 'next_action')
        .eq('status', 'pending');

      // Get user and organization info
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('User not authenticated');

      const { data: orgData } = await supabase.rpc('get_user_organization_id');
      if (!orgData) throw new Error('Organization not found');

      // Calculate expiration (7 days from now)
      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + 7);

      // Save each action as a separate suggestion
      const inserts = result.actions.map((action, index) => ({
        opportunity_id: opportunityId,
        organization_id: orgData,
        user_id: user.id,
        suggestion_type: 'next_action',
        suggested_value: action as unknown as Json,
        current_value: index === 0 ? { overall_strategy: result.overall_strategy, urgency_level: result.urgency_level } as Json : null,
        reasoning: action.reason,
        status: 'pending',
        expires_at: expiresAt.toISOString(),
      }));

      const { error: insertError } = await supabase
        .from('ai_suggestions')
        .insert(inserts);

      if (insertError) throw insertError;

      // Refresh the list
      await fetchSavedActions();

      toast({
        title: 'Ações geradas',
        description: `${result.actions.length} próximas ações sugeridas.`,
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

  // Accept action (mark as accepted when creating activity)
  const acceptAction = async (actionId: string) => {
    try {
      const { error } = await supabase
        .from('ai_suggestions')
        .update({ 
          status: 'accepted', 
          action_taken_at: new Date().toISOString() 
        })
        .eq('id', actionId);

      if (error) throw error;

      // Remove from local state
      setActions((prev) => prev.filter((a) => a.id !== actionId));
    } catch (error) {
      console.error('Error accepting action:', error);
    }
  };

  // Dismiss action (mark as dismissed)
  const dismissAction = async (actionId: string) => {
    try {
      const { error } = await supabase
        .from('ai_suggestions')
        .update({ 
          status: 'dismissed', 
          action_taken_at: new Date().toISOString() 
        })
        .eq('id', actionId);

      if (error) throw error;

      // Remove from local state
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
