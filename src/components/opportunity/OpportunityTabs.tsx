import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { OpportunityActivitiesTab } from './OpportunityActivitiesTab';
import { OpportunityNotesTab } from './OpportunityNotesTab';
import { OpportunityProposalsTab } from './OpportunityProposalsTab';
import { OpportunityEmailsTab } from './OpportunityEmailsTab';
import { OpportunityFilesTab } from './OpportunityFilesTab';
import { OpportunityHistoryTab } from './OpportunityHistoryTab';
import { OpportunityAnalyticsTab } from './OpportunityAnalyticsTab';
import { DealParticipantsManager } from './DealParticipantsManager';
import { UnifiedTimeline } from './UnifiedTimeline';
import { AIDealScoreCard } from '../ai/AIDealScoreCard';
import { AINextActionCard } from '../ai/AINextActionCard';
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
import { useOpportunityDetails } from '@/hooks/useOpportunityDetails';

interface OpportunityTabsProps {
  opportunityId: string;
}

export function OpportunityTabs({ opportunityId }: OpportunityTabsProps) {
  const { scoring, recalculate, isRecalculating } = useOpportunityScoring(opportunityId);
  const { data: emotionalMemory } = useLeadEmotionalMemory(opportunityId);
  const { data: opportunity } = useOpportunityDetails(opportunityId);

  return (
    <Tabs defaultValue="timeline" className="flex-1">
      <TabsList className="flex flex-wrap h-auto gap-1 mb-4">
        <TabsTrigger value="timeline">Timeline</TabsTrigger>
        <TabsTrigger value="analytics">Analytics</TabsTrigger>
        <TabsTrigger value="inteligencia">Inteligência</TabsTrigger>
        <TabsTrigger value="historico">Histórico</TabsTrigger>
        <TabsTrigger value="notas">Notas</TabsTrigger>
        <TabsTrigger value="atividades">Atividades</TabsTrigger>
        <TabsTrigger value="arquivos">Arquivos</TabsTrigger>
        <TabsTrigger value="emails">E-mails</TabsTrigger>
        <TabsTrigger value="propostas">Propostas</TabsTrigger>
        <TabsTrigger value="equipe">Equipe</TabsTrigger>
      </TabsList>

      <TabsContent value="timeline">
        <UnifiedTimeline opportunityId={opportunityId} />
      </TabsContent>

      <TabsContent value="analytics">
        <OpportunityAnalyticsTab opportunityId={opportunityId} />
      </TabsContent>

      <TabsContent value="inteligencia">
        <div className="space-y-6">
          {/* AI Suggestions */}
          <AIFieldSuggestions opportunityId={opportunityId} />
          
          {/* AI Cards - Score e Next Action */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <AIDealScoreCard opportunityId={opportunityId} />
            <AINextActionCard opportunityId={opportunityId} />
          </div>

          {/* Scoring Detalhado */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="border rounded-lg p-4">
              <h3 className="text-sm font-medium mb-3">Score do Deal</h3>
              <OpportunityScoreCard
                opportunityId={opportunityId}
                opportunityName={opportunity?.title || ''}
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

            {(opportunity as any)?.organization_id && (
              <div className="border rounded-lg p-4">
                <h3 className="text-sm font-medium mb-3">Revenue Hygiene (NRHS)</h3>
                <NRHSSidebarCard
                  opportunityId={opportunityId}
                  organizationId={(opportunity as any).organization_id}
                />
              </div>
            )}

            <div className="border rounded-lg p-4">
              <h3 className="text-sm font-medium mb-3">Lacunas do Deal</h3>
              <DealGapsCard opportunityId={opportunityId} />
            </div>
          </div>

          {/* Inteligência de Vibe */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <LeadEmotionalMemoryCard opportunityId={opportunityId} />
            <VibeNarrativeCard vibeState={emotionalMemory?.last_emotional_state || undefined} />
          </div>

          {/* Alertas e Conselheiro */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <VibeAlertsCard opportunityId={opportunityId} />
            <VibeAdvisorChat opportunityId={opportunityId} opportunityTitle={opportunity?.title || ''} />
          </div>
        </div>
      </TabsContent>

      <TabsContent value="historico">
        <OpportunityHistoryTab opportunityId={opportunityId} />
      </TabsContent>

      <TabsContent value="notas">
        <OpportunityNotesTab opportunityId={opportunityId} />
      </TabsContent>

      <TabsContent value="atividades">
        <OpportunityActivitiesTab opportunityId={opportunityId} />
      </TabsContent>

      <TabsContent value="arquivos">
        <OpportunityFilesTab opportunityId={opportunityId} />
      </TabsContent>

      <TabsContent value="emails">
        <OpportunityEmailsTab opportunityId={opportunityId} />
      </TabsContent>

      <TabsContent value="propostas">
        <OpportunityProposalsTab opportunityId={opportunityId} />
      </TabsContent>

      <TabsContent value="equipe">
        <DealParticipantsManager opportunityId={opportunityId} />
      </TabsContent>
    </Tabs>
  );
}
