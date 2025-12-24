import { Layout } from '@/components/Layout';
import { GraphInsightsDashboard } from '@/components/graph/GraphInsightsDashboard';
import { PageHeader } from '@/components/ui/page-header';
import { Network, Sparkles } from 'lucide-react';

export default function KnowledgeGraph() {
  return (
    <Layout>
      <div className="container max-w-7xl py-6 space-y-6">
        <PageHeader
          icon={Network}
          title="Revenue Knowledge Graph"
          subtitle="Visualize relacionamentos, identifique lacunas e fortaleça sua rede de vendas"
          badge={{ label: "Beta", icon: Sparkles }}
          variant="purple"
        />

        <GraphInsightsDashboard />
      </div>
    </Layout>
  );
}
