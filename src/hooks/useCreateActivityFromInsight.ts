import { useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { createActivity } from '@/services/supabase/activities';
import { updateInsightStatus } from '@/services/crm/knowledge-graph';
import type { GraphInsight } from '@/services/crm/knowledge-graph';

// Map insight types to activity types
const insightTypeToActivityType: Record<string, string> = {
  missing_champion: 'call',
  missing_decision_maker: 'meeting',
  silent_stakeholder: 'call',
  isolated_deal: 'meeting',
  weak_relationship: 'call',
  network_gap: 'email',
  high_centrality: 'meeting',
  engagement_decay: 'call',
};

// Map insight types to task titles
const insightTypeToTaskTitle: Record<string, string> = {
  missing_champion: 'Identificar champion interno',
  missing_decision_maker: 'Mapear decisor econômico',
  silent_stakeholder: 'Reengajar stakeholder silencioso',
  isolated_deal: 'Expandir rede de contatos',
  weak_relationship: 'Fortalecer relacionamento',
  network_gap: 'Preencher lacuna de rede',
  high_centrality: 'Engajar pessoa-chave',
  engagement_decay: 'Retomar contato com stakeholder',
};

interface CreateActivityFromInsightOptions {
  opportunityId: string;
  insight: GraphInsight;
  onSuccess?: () => void;
}

export function useCreateActivityFromInsight() {
  const navigate = useNavigate();

  const createActivityFromInsight = useCallback(async ({
    opportunityId,
    insight,
    onSuccess
  }: CreateActivityFromInsightOptions) => {
    try {
      const activityType = insightTypeToActivityType[insight.insight_type] || 'task';
      const defaultTitle = insightTypeToTaskTitle[insight.insight_type] || insight.title;
      
      // Create the activity
      await createActivity({
        title: defaultTitle,
        type: activityType,
        description: `${insight.description}\n\nAção sugerida: ${insight.suggested_action || 'N/A'}`,
        opportunity_id: opportunityId,
        status: 'pending',
        scheduled_date: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(), // Tomorrow
      });

      // Mark insight as acknowledged
      await updateInsightStatus(insight.id, 'acknowledged');

      toast.success('Tarefa criada', {
        description: `${defaultTitle} foi adicionada às suas atividades.`
      });

      onSuccess?.();
    } catch (error) {
      console.error('Failed to create activity from insight:', error);
      toast.error('Erro ao criar tarefa', {
        description: 'Não foi possível criar a atividade. Tente novamente.'
      });
    }
  }, []);

  const navigateToCreateActivity = useCallback((
    opportunityId: string,
    insight: GraphInsight
  ) => {
    const activityType = insightTypeToActivityType[insight.insight_type] || 'task';
    const defaultTitle = insightTypeToTaskTitle[insight.insight_type] || insight.title;

    navigate('/app/activities', {
      state: {
        createActivity: true,
        prefilledData: {
          opportunity_id: opportunityId,
          type: activityType,
          title: defaultTitle,
          description: `${insight.description}\n\nAção sugerida: ${insight.suggested_action || 'N/A'}`,
        }
      }
    });
  }, [navigate]);

  return {
    createActivityFromInsight,
    navigateToCreateActivity,
  };
}
