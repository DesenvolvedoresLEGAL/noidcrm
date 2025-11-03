import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent } from '@/components/ui/card';
import { OpportunityActivitiesTab } from './OpportunityActivitiesTab';
import { OpportunityNotesTab } from './OpportunityNotesTab';
import { OpportunityProposalsTab } from './OpportunityProposalsTab';

interface OpportunityTabsProps {
  opportunityId: string;
}

export function OpportunityTabs({ opportunityId }: OpportunityTabsProps) {
  return (
    <Tabs defaultValue="detalhes" className="flex-1">
      <TabsList className="grid w-full grid-cols-7 mb-4">
        <TabsTrigger value="detalhes">Detalhes</TabsTrigger>
        <TabsTrigger value="historico">Histórico</TabsTrigger>
        <TabsTrigger value="notas">Notas</TabsTrigger>
        <TabsTrigger value="atividades">Atividades</TabsTrigger>
        <TabsTrigger value="emails">E-mails</TabsTrigger>
        <TabsTrigger value="propostas">Propostas</TabsTrigger>
        <TabsTrigger value="arquivos">Arquivos</TabsTrigger>
      </TabsList>

      <TabsContent value="detalhes">
        <Card>
          <CardContent className="p-6">
            <p className="text-sm text-muted-foreground">
              Informações detalhadas estão disponíveis na barra lateral.
            </p>
          </CardContent>
        </Card>
      </TabsContent>

      <TabsContent value="historico">
        <Card>
          <CardContent className="p-6">
            <p className="text-sm text-muted-foreground">
              Histórico de atividades será implementado na Fase 3.
            </p>
          </CardContent>
        </Card>
      </TabsContent>

      <TabsContent value="notas">
        <OpportunityNotesTab opportunityId={opportunityId} />
      </TabsContent>

      <TabsContent value="atividades">
        <OpportunityActivitiesTab opportunityId={opportunityId} />
      </TabsContent>

      <TabsContent value="emails">
        <Card>
          <CardContent className="p-6">
            <p className="text-sm text-muted-foreground">
              Histórico de e-mails será implementado na Fase 6.
            </p>
          </CardContent>
        </Card>
      </TabsContent>

      <TabsContent value="propostas">
        <OpportunityProposalsTab opportunityId={opportunityId} />
      </TabsContent>

      <TabsContent value="arquivos">
        <Card>
          <CardContent className="p-6">
            <p className="text-sm text-muted-foreground">
              Gerenciador de arquivos será implementado na Fase 7.
            </p>
          </CardContent>
        </Card>
      </TabsContent>
    </Tabs>
  );
}
