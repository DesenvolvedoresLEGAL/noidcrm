import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Layout } from '@/components/Layout';
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
import SkillsLibraryPage from '@/pages/intelligence/skills/SkillsLibraryPage';
import { Command as CommandIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { KairosPremiumNavigation } from '@/components/intelligence/kairos/KairosPremiumNavigation';
import { KairosExecutiveHeader } from '@/components/intelligence/kairos/KairosExecutiveHeader';
import { KairosCommandPalette } from '@/components/intelligence/kairos/KairosCommandPalette';
import {
  resolveKairosTab,
  type KairosTabId,
} from '@/components/intelligence/kairos/kairosNavigationConfig';
import {
  KairosOverviewPanel,
  KairosSmartCoverageOverview,
} from '@/components/intelligence/kairos/KairosOverviewPanel';

export default function KairosHub() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<KairosTabId>(() =>
    resolveKairosTab(searchParams.get('tab')),
  );

  useEffect(() => {
    const next = resolveKairosTab(searchParams.get('tab'));
    if (next !== activeTab) setActiveTab(next);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);

  const handleTabChange = (next: KairosTabId) => {
    setActiveTab(next);
    const params = new URLSearchParams(searchParams);
    if (next === 'overview') params.delete('tab');
    else params.set('tab', next);
    setSearchParams(params, { replace: true });
  };

  return (
    <Layout pageTitle="Kairós">
      <div className="p-4 md:p-6 space-y-4 md:space-y-6">
        <KairosExecutiveHeader />

        <div className="flex justify-end">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setPaletteOpen(true)}
            className="gap-2 h-9"
            aria-label="Abrir Command Palette"
          >
            <CommandIcon className="h-3.5 w-3.5" aria-hidden />
            <span className="hidden sm:inline">Buscar…</span>
            <kbd className="ml-1 hidden sm:inline-flex items-center gap-0.5 rounded border bg-muted px-1.5 py-0.5 text-[10px] font-mono text-muted-foreground">
              ⌘K
            </kbd>
          </Button>
        </div>

        <KairosPremiumNavigation activeTab={activeTab} onTabChange={handleTabChange} />

        <KairosCommandPalette
          open={paletteOpen}
          onOpenChange={setPaletteOpen}
          onNavigate={handleTabChange}
        />


        <div className="space-y-4 md:space-y-6">
          {activeTab === 'overview' && <KairosOverviewPanel onNavigate={handleTabChange} />}
          {activeTab === 'icp' && <IcpIntelligencePanel />}
          {activeTab === 'coverage' && (
            <KairosSmartCoverageOverview onNavigate={handleTabChange} />
          )}
          {activeTab === 'skills' && <SkillsLibraryPage />}
          {activeTab === 'sourcing' && <LeadSourcingEngine />}
          {activeTab === 'queue' && <QualifiedQueuePanel />}
          {activeTab === 'autopilot' && <AutopilotPanel />}
          {activeTab === 'sdr-copilot' && <SDRCopilotPanel />}
          {activeTab === 'revenue-attribution' && <RevenueAttributionPanel />}
          {activeTab === 'gtm-performance' && <GtmPerformancePanel />}
          {activeTab === 'optimization' && (
            <>
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
            </>
          )}
          {activeTab === 'experiments' && (
            <>
              <ExperimentImpactSummary />
              <div className="grid gap-4 md:gap-6 lg:grid-cols-3">
                <div className="lg:col-span-2">
                  <ExperimentsFeed />
                </div>
                <div className="space-y-4 md:space-y-6">
                  <GuardrailsCard />
                </div>
              </div>
            </>
          )}
          {activeTab === 'performance' && <PlaybookPerformance />}
        </div>
      </div>
    </Layout>
  );
}
