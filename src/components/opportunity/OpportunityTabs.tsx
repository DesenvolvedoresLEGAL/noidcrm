import { useState } from 'react';
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

/**
 * Lazy-mount tabs: each TabsContent only renders (and therefore fires its
 * underlying queries) once the user has actually visited it. The Timeline
 * is pre-visited so the initial paint is identical to before.
 *
 * This dramatically reduces the number of parallel Supabase queries fired
 * when the opportunity detail page opens, which was a major contributor
 * to slow loads under DB pressure.
 */
export function OpportunityTabs({ opportunityId }: OpportunityTabsProps) {
  const [visited, setVisited] = useState<Set<string>>(() => new Set(['timeline']));
  const markVisited = (tab: string) =>
    setVisited((prev) => (prev.has(tab) ? prev : new Set(prev).add(tab)));

  const intelligenceMounted = visited.has('inteligencia');
  const { scoring, recalculate, isRecalculating } = useOpportunityScoring(
    intelligenceMounted ? opportunityId : undefined,
  );
  const { data: emotionalMemory } = useLeadEmotionalMemory(
    intelligenceMounted ? opportunityId : '',
  );
  // Opportunity details are needed for the breadcrumbs/header area in the
  // Inteligência tab — keep a single shared cache (already throttled with
  // staleTime 5min) so it does not refire across tabs.
  const { data: opportunity } = useOpportunityDetails(opportunityId);

  return (
    <Tabs defaultValue="timeline" className="flex-1" onValueChange={markVisited}>
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
        {visited.has('timeline') && <UnifiedTimeline opportunityId={opportunityId} />}
      </TabsContent>

      <TabsContent value="analytics">
        {visited.has('analytics') && <OpportunityAnalyticsTab opportunityId={opportunityId} />}
      </TabsContent>

      <TabsContent value="inteligencia">
        {intelligenceMounted && (
          <div className="space-y-6">
            <AIFieldSuggestions opportunityId={opportunityId} />

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <AIDealScoreCard opportunityId={opportunityId} />
              <AINextActionCard opportunityId={opportunityId} />
            </div>

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

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <LeadEmotionalMemoryCard opportunityId={opportunityId} />
              <VibeNarrativeCard vibeState={emotionalMemory?.last_emotional_state || undefined} />
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <VibeAlertsCard opportunityId={opportunityId} />
              <VibeAdvisorChat opportunityId={opportunityId} opportunityTitle={opportunity?.title || ''} />
            </div>
          </div>
        )}
      </TabsContent>

      <TabsContent value="historico">
        {visited.has('historico') && <OpportunityHistoryTab opportunityId={opportunityId} />}
      </TabsContent>

      <TabsContent value="notas">
        {visited.has('notas') && <OpportunityNotesTab opportunityId={opportunityId} />}
      </TabsContent>

      <TabsContent value="atividades">
        {visited.has('atividades') && <OpportunityActivitiesTab opportunityId={opportunityId} />}
      </TabsContent>

      <TabsContent value="arquivos">
        {visited.has('arquivos') && <OpportunityFilesTab opportunityId={opportunityId} />}
      </TabsContent>

      <TabsContent value="emails">
        {visited.has('emails') && <OpportunityEmailsTab opportunityId={opportunityId} />}
      </TabsContent>

      <TabsContent value="propostas">
        {visited.has('propostas') && <OpportunityProposalsTab opportunityId={opportunityId} />}
      </TabsContent>

      <TabsContent value="equipe">
        {visited.has('equipe') && <DealParticipantsManager opportunityId={opportunityId} />}
      </TabsContent>
    </Tabs>
  );
}
