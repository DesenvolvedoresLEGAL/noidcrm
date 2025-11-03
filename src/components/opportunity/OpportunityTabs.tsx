import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { OpportunityActivitiesTab } from './OpportunityActivitiesTab';
import { OpportunityNotesTab } from './OpportunityNotesTab';
import { OpportunityProposalsTab } from './OpportunityProposalsTab';
import { OpportunityEmailsTab } from './OpportunityEmailsTab';
import { OpportunityFilesTab } from './OpportunityFilesTab';
import { OpportunityHistoryTab } from './OpportunityHistoryTab';

interface OpportunityTabsProps {
  opportunityId: string;
}

export function OpportunityTabs({ opportunityId }: OpportunityTabsProps) {
  return (
    <Tabs defaultValue="historico" className="flex-1">
      <TabsList className="grid w-full grid-cols-6 mb-4">
        <TabsTrigger value="historico">Histórico</TabsTrigger>
        <TabsTrigger value="notas">Notas</TabsTrigger>
        <TabsTrigger value="atividades">Atividades</TabsTrigger>
        <TabsTrigger value="arquivos">Arquivos</TabsTrigger>
        <TabsTrigger value="emails">E-mails</TabsTrigger>
        <TabsTrigger value="propostas">Propostas</TabsTrigger>
      </TabsList>

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
    </Tabs>
  );
}
