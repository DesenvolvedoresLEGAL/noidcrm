import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Layout } from '@/components/Layout';
import { PageHeader } from '@/components/ui/page-header';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { LeadSourcingEngine } from '@/components/playbook/LeadSourcingEngine';
import { PlaybookPerformance } from '@/components/playbook/PlaybookPerformance';
import { ImpactSummaryCard } from '@/components/intelligence/optimization/ImpactSummaryCard';
import { RecommendationsPanel } from '@/components/intelligence/optimization/RecommendationsPanel';
import { InsightsFeed } from '@/components/intelligence/optimization/InsightsFeed';
import { AutoModeToggle } from '@/components/intelligence/optimization/AutoModeToggle';
import { ActionsHistoryTable } from '@/components/intelligence/optimization/ActionsHistoryTable';
import { ExperimentImpactSummary } from '@/components/intelligence/experiments/ExperimentImpactSummary';
import { ExperimentsFeed } from '@/components/intelligence/experiments/ExperimentsFeed';
import { GuardrailsCard } from '@/components/intelligence/experiments/GuardrailsCard';
import { IcpIntelligencePanel } from '@/components/intelligence/icp/IcpIntelligencePanel';
import { QualifiedQueuePanel } from '@/components/intelligence/queue/QualifiedQueuePanel';
import { AutopilotPanel } from '@/components/intelligence/autopilot/AutopilotPanel';
import { RevenueAttributionPanel } from '@/components/intelligence/revenue/RevenueAttributionPanel';
import { GtmPerformancePanel } from '@/components/intelligence/gtm/GtmPerformancePanel';
import { SDRCopilotPanel } from '@/components/intelligence/sdr-copilot/SDRCopilotPanel';
import { Compass, Sparkles } from 'lucide-react';

const VALID_TABS = ['icp', 'queue', 'autopilot', 'revenue', 'gtm', 'sdr', 'sourcing', 'optimization', 'experiments', 'performance'] as const;
type KairosTab = (typeof VALID_TABS)[number];

export default function KairosHub() {
  const [searchParams, setSearchParams] = useSearchParams();
  const initialTab = (searchParams.get('tab') as KairosTab) ?? 'icp';
  const [activeTab, setActiveTab] = useState<KairosTab>(
    VALID_TABS.includes(initialTab) ? initialTab : 'icp'
  );

  useEffect(() => {
    const t = searchParams.get('tab') as KairosTab | null;
    if (t && VALID_TABS.includes(t) && t !== activeTab) setActiveTab(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);

  const handleTabChange = (value: string) => {
    const next = value as KairosTab;
    setActiveTab(next);
    const params = new URLSearchParams(searchParams);
    if (next === 'icp') params.delete('tab');
    else params.set('tab', next);
    setSearchParams(params, { replace: true });
  };

  return (
    <Layout pageTitle="Kairós">
      <div className="p-4 md:p-6 space-y-4 md:space-y-6">
        <PageHeader
          icon={Compass}
          title="Kairós"
          subtitle="Sourcing, otimização, experimentos e performance — no momento certo"
          badge={{ label: 'Inteligência', icon: Sparkles }}
          variant="indigo"
        />

        <Tabs value={activeTab} onValueChange={handleTabChange}>
          <div className="w-full overflow-x-auto -mx-4 px-4 md:mx-0 md:px-0 md:overflow-visible">
            <TabsList className="inline-flex w-max md:grid md:w-full md:grid-cols-9 md:max-w-6xl gap-1">
              <TabsTrigger value="icp" className="whitespace-nowrap">🎯 ICP Intelligence</TabsTrigger>
              <TabsTrigger value="queue" className="whitespace-nowrap">📥 Qualified Queue</TabsTrigger>
              <TabsTrigger value="autopilot" className="whitespace-nowrap">🚀 Autopilot</TabsTrigger>
              <TabsTrigger value="revenue" className="whitespace-nowrap">💰 Revenue Attribution</TabsTrigger>
              <TabsTrigger value="gtm" className="whitespace-nowrap">📊 GTM Performance</TabsTrigger>
              <TabsTrigger value="sourcing" className="whitespace-nowrap">🧭 Sourcing</TabsTrigger>
              <TabsTrigger value="optimization" className="whitespace-nowrap">⚡ Optimization</TabsTrigger>
              <TabsTrigger value="experiments" className="whitespace-nowrap">🧪 Experiments</TabsTrigger>
              <TabsTrigger value="performance" className="whitespace-nowrap">📊 Performance</TabsTrigger>
            </TabsList>
          </div>

          <TabsContent value="icp" className="space-y-4 md:space-y-6 mt-4">
            <IcpIntelligencePanel />
          </TabsContent>

          <TabsContent value="queue" className="space-y-4 md:space-y-6 mt-4">
            <QualifiedQueuePanel />
          </TabsContent>

          <TabsContent value="autopilot" className="space-y-4 md:space-y-6 mt-4">
            <AutopilotPanel />
          </TabsContent>

          <TabsContent value="revenue" className="space-y-4 md:space-y-6 mt-4">
            <RevenueAttributionPanel />
          </TabsContent>

          <TabsContent value="gtm" className="space-y-4 md:space-y-6 mt-4">
            <GtmPerformancePanel />
          </TabsContent>




          <TabsContent value="sourcing" className="space-y-4 md:space-y-6 mt-4">
            <LeadSourcingEngine />
          </TabsContent>

          <TabsContent value="optimization" className="space-y-4 md:space-y-6 mt-4">
            <ImpactSummaryCard />
            <div className="grid gap-4 md:gap-6 lg:grid-cols-3">
              <div className="lg:col-span-2 space-y-4 md:space-y-6">
                <RecommendationsPanel />
                <InsightsFeed />
              </div>
              <div className="space-y-4 md:space-y-6">
                <AutoModeToggle />
                <ActionsHistoryTable />
              </div>
            </div>
          </TabsContent>

          <TabsContent value="experiments" className="space-y-4 md:space-y-6 mt-4">
            <ExperimentImpactSummary />
            <div className="grid gap-4 md:gap-6 lg:grid-cols-3">
              <div className="lg:col-span-2">
                <ExperimentsFeed />
              </div>
              <div className="space-y-4 md:space-y-6">
                <GuardrailsCard />
              </div>
            </div>
          </TabsContent>

          <TabsContent value="performance" className="space-y-4 md:space-y-6 mt-4">
            <PlaybookPerformance />
          </TabsContent>
        </Tabs>
      </div>
    </Layout>
  );
}
