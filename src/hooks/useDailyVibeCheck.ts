import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useCurrentUser } from './useCurrentUser';
import { vibeKeys } from '@/lib/query-keys';

export interface DailyVibeItem {
  id: string;
  title: string;
  accountName: string;
  vibeState: string;
  energyScore: number;
  recommendation: string;
  priority: 'hot' | 'stuck' | 'silent' | 'nudge' | 'normal';
  lastInteraction: string | null;
  riskLevel: 'low' | 'medium' | 'high' | 'critical' | null;
}

export interface DailyVibeCheck {
  date: string;
  hottestLead: DailyVibeItem | null;
  stuckDeals: DailyVibeItem[];
  silentDeals: DailyVibeItem[];
  nudgeOpportunities: DailyVibeItem[];
  totalDeals: number;
  requiresAttention: number;
}

export function useDailyVibeCheck() {
  const { user, profile } = useCurrentUser();
  const userId = user?.id;
  const organizationId = profile?.organization_id;

  return useQuery({
    queryKey: vibeKeys.dailyCheck(userId, organizationId),
    queryFn: async (): Promise<DailyVibeCheck> => {
      if (!userId || !organizationId) {
        return getEmptyCheck();
      }

      // Buscar oportunidades abertas do usuário com memória emocional
      const { data: opportunities, error: oppError } = await supabase
        .from('opportunities')
        .select(`
          id,
          title,
          status,
          valor_previsto,
          account:accounts(razao_social, nome_fantasia)
        `)
        .eq('organization_id', organizationId)
        .eq('owner_user_id', userId)
        .eq('status', 'open')
        .is('deleted_at', null)
        .limit(50);

      if (oppError) throw oppError;

      // Buscar memórias emocionais
      const oppIds = opportunities?.map(o => o.id) || [];
      
      if (oppIds.length === 0) {
        return getEmptyCheck();
      }

      const { data: memories, error: memError } = await supabase
        .from('lead_emotional_memory')
        .select('*')
        .in('opportunity_id', oppIds);

      if (memError) throw memError;

      // Mapear memórias por opportunity_id
      const memoryMap = new Map(memories?.map(m => [m.opportunity_id, m]) || []);

      // Processar oportunidades
      const items: DailyVibeItem[] = (opportunities?.map(opp => {
        const memory = memoryMap.get(opp.id);
        const accountName = opp.account?.nome_fantasia || opp.account?.razao_social || 'Sem conta';
        
        let priority: DailyVibeItem['priority'] = 'normal';
        let recommendation = 'Acompanhe normalmente';
        let energyScore = 50;

        const vibeState = memory?.last_emotional_state || 'desconhecido';
        const rawRisk = memory?.risk_of_vibe_break;
        const riskLevel: DailyVibeItem['riskLevel'] = 
          (rawRisk === 'low' || rawRisk === 'medium' || rawRisk === 'high' || rawRisk === 'critical') 
            ? rawRisk 
            : null;

        // Determinar prioridade e recomendação
        if (vibeState === 'em_decisao' || vibeState === 'pronto_inseguro') {
          priority = 'hot';
          energyScore = 85 + Math.random() * 15;
          recommendation = 'Lead quente! Momento favorável para fechar.';
        } else if (vibeState === 'travado') {
          priority = 'stuck';
          energyScore = 25 + Math.random() * 20;
          recommendation = 'Considere acolher e remover barreiras.';
        } else if (vibeState === 'quente_silencioso') {
          priority = 'silent';
          energyScore = 60 + Math.random() * 20;
          recommendation = 'Não mexa agora. Aguarde timing.';
        } else if (vibeState === 'curioso' || vibeState === 'exploratorio') {
          priority = 'nudge';
          energyScore = 55 + Math.random() * 20;
          recommendation = 'Movimento sutil pode avançar a conversa.';
        } else if (riskLevel === 'high' || riskLevel === 'critical') {
          priority = 'stuck';
          energyScore = 20 + Math.random() * 20;
          recommendation = 'Atenção! Risco de perder o deal.';
        }

        return {
          id: opp.id,
          title: opp.title,
          accountName,
          vibeState,
          energyScore: Math.round(energyScore),
          recommendation,
          priority,
          lastInteraction: memory?.last_interaction_summary || null,
          riskLevel
        };
      })) || [];

      // Categorizar
      const hottestLead = items
        .filter(i => i.priority === 'hot')
        .sort((a, b) => b.energyScore - a.energyScore)[0] || null;

      const stuckDeals = items.filter(i => i.priority === 'stuck').slice(0, 3);
      const silentDeals = items.filter(i => i.priority === 'silent').slice(0, 3);
      const nudgeOpportunities = items.filter(i => i.priority === 'nudge').slice(0, 3);

      const requiresAttention = items.filter(i => 
        i.priority !== 'normal' && i.priority !== 'nudge'
      ).length;

      return {
        date: new Date().toISOString(),
        hottestLead,
        stuckDeals,
        silentDeals,
        nudgeOpportunities,
        totalDeals: items.length,
        requiresAttention
      };
    },
    enabled: !!userId && !!organizationId,
    staleTime: 1000 * 60 * 10 // 10 minutos
  });
}

function getEmptyCheck(): DailyVibeCheck {
  return {
    date: new Date().toISOString(),
    hottestLead: null,
    stuckDeals: [],
    silentDeals: [],
    nudgeOpportunities: [],
    totalDeals: 0,
    requiresAttention: 0
  };
}
