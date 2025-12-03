import { Layout } from '@/components/Layout';
import { ScoringDashboard } from '@/components/scoring/ScoringDashboard';

export default function Scoring() {
  return (
    <Layout>
      <div className="p-6">
        <ScoringDashboard />
      </div>
    </Layout>
  );
}
