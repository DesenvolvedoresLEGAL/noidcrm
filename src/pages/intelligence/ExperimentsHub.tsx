import { Layout } from '@/components/Layout';
import { PageHeader } from '@/components/ui/page-header';
import { FlaskConical, Sparkles } from 'lucide-react';
import { ExperimentsFeed } from '@/components/intelligence/experiments/ExperimentsFeed';
import { GuardrailsCard } from '@/components/intelligence/experiments/GuardrailsCard';
import { ExperimentImpactSummary } from '@/components/intelligence/experiments/ExperimentImpactSummary';

export default function ExperimentsHub() {
  return (
    <Layout pageTitle="Experiments">
      <div className="p-4 md:p-6 space-y-4 md:space-y-6">
        <PageHeader
          icon={FlaskConical}
          title="Experiments"
          subtitle="Hipóteses, variantes e aprendizado contínuo — sob seus guardrails"
          badge={{ label: 'Inteligência', icon: Sparkles }}
          variant="indigo"
        />

        <ExperimentImpactSummary />

        <div className="grid gap-4 md:gap-6 lg:grid-cols-3">
          <div className="lg:col-span-2">
            <ExperimentsFeed />
          </div>
          <div className="space-y-4 md:space-y-6">
            <GuardrailsCard />
          </div>
        </div>
      </div>
    </Layout>
  );
}
