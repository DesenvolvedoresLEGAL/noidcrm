import { Layout } from '@/components/Layout';
import { GraphInsightsDashboard } from '@/components/graph/GraphInsightsDashboard';
import { PageHeader } from '@/components/ui/page-header';
import { Network, Sparkles } from 'lucide-react';

export default function KnowledgeGraph() {
  return (
    <Layout>
      <div className="p-4 md:p-6 space-y-4 md:space-y-6">
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
