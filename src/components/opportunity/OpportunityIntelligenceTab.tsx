import { AIFieldSuggestions } from '../ai/AIFieldSuggestions';
import { LeadEmotionalMemoryCard } from './LeadEmotionalMemoryCard';
import { VibeNarrativeCard } from './VibeNarrativeCard';
import { VibeAlertsCard } from './VibeAlertsCard';
import { VibeAdvisorChat } from './VibeAdvisorChat';
import { OpportunityScoreCard } from '@/components/scoring/OpportunityScoreCard';
import { NRHSSidebarCard } from '@/components/nrhs/NRHSSidebarCard';
import { DealGapsCard } from '@/components/graph/DealGapsCard';
import { useOpportunityScoring } from '@/hooks/useOpportunityScoring';
import { useLeadEmotionalMemory } from '@/hooks/useLeadEmotionalMemory';

interface OpportunityIntelligenceTabProps {
  opportunityId: string;
  opportunityTitle: string;
  organizationId?: string;
}

export function OpportunityIntelligenceTab({ 
  opportunityId, 
  opportunityTitle,
  organizationId 
}: OpportunityIntelligenceTabProps) {
  const { scoring, recalculate, isRecalculating } = useOpportunityScoring(opportunityId);
  const { data: emotionalMemory } = useLeadEmotionalMemory(opportunityId);

  return (
    <div className="space-y-6">
      {/* AI Suggestions */}
      <AIFieldSuggestions opportunityId={opportunityId} />
      
      {/* Scoring Detalhado - 3 colunas */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="border rounded-lg p-4 bg-card">
          <h3 className="text-sm font-medium mb-3">Score do Deal</h3>
          <OpportunityScoreCard
            opportunityId={opportunityId}
            opportunityName={opportunityTitle}
            opportunityScore={scoring?.opportunity_score}
            engagementScore={scoring?.engagement_score}
            velocityScore={scoring?.velocity_score}
            riskScore={scoring?.risk_score}
            winProbabilityAi={scoring?.win_probability_ai}
            scoringFactors={scoring?.scoring_factors}
            variant="compact"
            onRecalculate={recalculate}
            isRecalculating={isRecalculating}
          />
        </div>

        {organizationId && (
          <div className="border rounded-lg p-4 bg-card">
            <h3 className="text-sm font-medium mb-3">Revenue Hygiene (NRHS)</h3>
            <NRHSSidebarCard
              opportunityId={opportunityId}
              organizationId={organizationId}
            />
          </div>
        )}

        <div className="border rounded-lg p-4 bg-card">
          <h3 className="text-sm font-medium mb-3">Lacunas do Deal</h3>
          <DealGapsCard opportunityId={opportunityId} />
        </div>
      </div>

      {/* Inteligência de Vibe */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <LeadEmotionalMemoryCard opportunityId={opportunityId} />
        <VibeNarrativeCard 
          vibeState={emotionalMemory?.last_emotional_state || undefined} 
          riskLevel={emotionalMemory?.risk_of_vibe_break}
        />
      </div>

      {/* Alertas e Conselheiro */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <VibeAlertsCard opportunityId={opportunityId} />
        <VibeAdvisorChat opportunityId={opportunityId} opportunityTitle={opportunityTitle} />
      </div>
    </div>
  );
}
