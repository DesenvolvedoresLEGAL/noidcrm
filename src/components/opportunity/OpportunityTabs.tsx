import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { OpportunityActivitiesTab } from './OpportunityActivitiesTab';
import { OpportunityNotesTab } from './OpportunityNotesTab';
import { OpportunityProposalsTab } from './OpportunityProposalsTab';
import { OpportunityEmailsTab } from './OpportunityEmailsTab';
import { OpportunityFilesTab } from './OpportunityFilesTab';
import { OpportunityHistoryTab } from './OpportunityHistoryTab';
import { DealParticipantsManager } from './DealParticipantsManager';
import { UnifiedTimeline } from './UnifiedTimeline';
import { AIDealScoreCard } from '../ai/AIDealScoreCard';
import { AINextActionCard } from '../ai/AINextActionCard';
import { AIFieldSuggestions } from '../ai/AIFieldSuggestions';

interface OpportunityTabsProps {
  opportunityId: string;
}

export function OpportunityTabs({ opportunityId }: OpportunityTabsProps) {
  return (
    <Tabs defaultValue="timeline" className="flex-1">
      <TabsList className="grid w-full grid-cols-9 mb-4">
        <TabsTrigger value="timeline">Timeline</TabsTrigger>
        <TabsTrigger value="ai">AI Insights</TabsTrigger>
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

      <TabsContent value="ai">
        <div className="space-y-6">
          <AIFieldSuggestions opportunityId={opportunityId} />
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <AIDealScoreCard opportunityId={opportunityId} />
            <AINextActionCard opportunityId={opportunityId} />
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
