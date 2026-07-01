import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Rocket } from 'lucide-react';
import { AutopilotKpiBar } from './AutopilotKpiBar';
import { AutopilotRunsTable } from './AutopilotRunsTable';
import { AutopilotConfigModal } from './AutopilotConfigModal';
import { ApolloKpiBar } from './ApolloKpiBar';
import { ApolloInvisibleSettingsCard } from './ApolloInvisibleSettingsCard';
import { ModuleHeader } from '@/components/intelligence/kairos/premium';

export function AutopilotPanel() {
  const [modalOpen, setModalOpen] = useState(false);
  return (
    <div className="space-y-5">
      <ModuleHeader
        icon={Rocket}
        eyebrow="Kairós · Operação"
        title="Autopilot"
        description="Processa lotes inteiros automaticamente. Saída = Qualified Queue (nunca cria oportunidade ou conta)."
        accent="blue"
        actions={
          <Button onClick={() => setModalOpen(true)} disabled className="gap-2">
            <Rocket className="h-4 w-4" /> Executar Autopilot
          </Button>
        }
      />
      <p className="text-xs text-muted-foreground -mt-2">
        Dica: para iniciar um lote, abra <strong>Sourcing</strong>, execute uma busca e clique em{' '}
        <strong>🚀 Executar Autopilot</strong> nos resultados.
      </p>
      <AutopilotKpiBar />
      <ApolloKpiBar />
      <ApolloInvisibleSettingsCard />
      <AutopilotRunsTable />
      <AutopilotConfigModal open={modalOpen} onClose={() => setModalOpen(false)} />
    </div>
  );
}
