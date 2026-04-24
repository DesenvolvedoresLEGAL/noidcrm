import { Layout } from '@/components/Layout';
import { PageHeader } from '@/components/ui/page-header';
import { LeadSourcingEngine } from '@/components/playbook/LeadSourcingEngine';
import { Compass, Sparkles } from 'lucide-react';

export default function KairosHub() {
  return (
    <Layout pageTitle="Kairós">
      <div className="p-4 md:p-6 space-y-4 md:space-y-6">
        <PageHeader
          icon={Compass}
          title="Kairós"
          subtitle="Captura inteligente de leads e enriquecimento de dados no momento certo"
          badge={{ label: 'Inteligência', icon: Sparkles }}
          variant="indigo"
        />

        <LeadSourcingEngine />
      </div>
    </Layout>
  );
}
