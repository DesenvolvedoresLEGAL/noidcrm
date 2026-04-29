import { Layout } from '@/components/Layout';
import { LeadScoreDashboard } from '@/components/scoring/lead/LeadScoreDashboard';
import { OpportunityScoreDashboard } from '@/components/scoring/opportunity/OpportunityScoreDashboard';
import { RevenueHygieneDashboard } from '@/components/scoring/nrhs/RevenueHygieneDashboard';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Users, Target, Shield } from 'lucide-react';
import { useScoringRealtime } from '@/hooks/scoring/useScoringRealtime';
import { useCurrentUser } from '@/hooks/useCurrentUser';

export default function Scoring() {
  const { organization } = useCurrentUser();
  // Sprint Scoring 1.1 — keep dashboards in sync when scores recalc anywhere.
  useScoringRealtime(organization?.id ?? null);


  return (
    <Layout>
      <div className="p-6">
        <Tabs defaultValue="lead-score" className="space-y-6">
          <TabsList className="bg-muted/50">
            <TabsTrigger value="lead-score" className="gap-2">
              <Users className="h-4 w-4" />
              Lead Score
            </TabsTrigger>
            <TabsTrigger value="opportunity-score" className="gap-2">
              <Target className="h-4 w-4" />
              Opportunity Score
            </TabsTrigger>
            <TabsTrigger value="revenue-hygiene" className="gap-2">
              <Shield className="h-4 w-4" />
              Revenue Hygiene (NRHS)
            </TabsTrigger>
          </TabsList>
          <TabsContent value="lead-score">
            <LeadScoreDashboard />
          </TabsContent>
          <TabsContent value="opportunity-score">
            <OpportunityScoreDashboard />
          </TabsContent>
          <TabsContent value="revenue-hygiene">
            <RevenueHygieneDashboard />
          </TabsContent>
        </Tabs>
      </div>
    </Layout>
  );
}
