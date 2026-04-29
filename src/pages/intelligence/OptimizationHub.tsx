import { Layout } from '@/components/Layout';
import { PageHeader } from '@/components/ui/page-header';
import { Sparkles, Zap } from 'lucide-react';
import { InsightsFeed } from '@/components/intelligence/optimization/InsightsFeed';
import { RecommendationsPanel } from '@/components/intelligence/optimization/RecommendationsPanel';
import { AutoModeToggle } from '@/components/intelligence/optimization/AutoModeToggle';
import { ActionsHistoryTable } from '@/components/intelligence/optimization/ActionsHistoryTable';

export default function OptimizationHub() {
  return (
    <Layout pageTitle="Optimization">
      <div className="p-4 md:p-6 space-y-4 md:space-y-6">
        <PageHeader
          icon={Zap}
          title="Optimization"
          subtitle="Insights e recomendações automáticas para o sistema se ajustar com base em resultados reais"
          badge={{ label: 'Inteligência', icon: Sparkles }}
          variant="indigo"
        />

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
      </div>
    </Layout>
  );
}
