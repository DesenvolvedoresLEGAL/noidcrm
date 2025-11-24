import { Layout } from '@/components/Layout';
import { EmailSyncCard } from '@/components/settings/EmailSyncCard';
import { CalendarSyncCard } from '@/components/settings/CalendarSyncCard';

export default function Integrations() {
  return (
    <Layout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Integrações</h1>
          <p className="text-muted-foreground mt-2">
            Conecte suas ferramentas favoritas para automatizar seu fluxo de trabalho
          </p>
        </div>

        <div className="grid gap-6 md:grid-cols-2">
          <EmailSyncCard />
          <CalendarSyncCard />
        </div>
      </div>
    </Layout>
  );
}