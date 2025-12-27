import { Layout } from '@/components/Layout';
import { ScoringDashboard } from '@/components/scoring/ScoringDashboard';
import { RevenueHygieneDashboard } from '@/components/scoring/nrhs/RevenueHygieneDashboard';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Target, Shield } from 'lucide-react';

export default function Scoring() {
  return (
    <Layout>
      <div className="p-6">
        <Tabs defaultValue="opportunity-score" className="space-y-6">
          <TabsList className="bg-muted/50">
            <TabsTrigger value="opportunity-score" className="gap-2">
              <Target className="h-4 w-4" />
              Opportunity Score
            </TabsTrigger>
            <TabsTrigger value="revenue-hygiene" className="gap-2">
              <Shield className="h-4 w-4" />
              Revenue Hygiene (NRHS)
            </TabsTrigger>
          </TabsList>
          <TabsContent value="opportunity-score">
            <ScoringDashboard />
          </TabsContent>
          <TabsContent value="revenue-hygiene">
            <RevenueHygieneDashboard />
          </TabsContent>
        </Tabs>
      </div>
    </Layout>
  );
}
