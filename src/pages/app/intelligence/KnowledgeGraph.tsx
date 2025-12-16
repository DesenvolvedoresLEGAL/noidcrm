import { Layout } from '@/components/Layout';
import { GraphInsightsDashboard } from '@/components/graph/GraphInsightsDashboard';

export default function KnowledgeGraph() {
  return (
    <Layout>
      <div className="container max-w-7xl py-6 space-y-6">
        <div>
          <h1 className="text-2xl font-bold">Revenue Knowledge Graph</h1>
          <p className="text-muted-foreground">
            Visualize relacionamentos, identifique lacunas e fortaleça sua rede de vendas
          </p>
        </div>

        <GraphInsightsDashboard />
      </div>
    </Layout>
  );
}
