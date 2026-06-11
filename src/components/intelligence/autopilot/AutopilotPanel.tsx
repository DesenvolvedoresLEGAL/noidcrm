import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Rocket } from 'lucide-react';
import { AutopilotKpiBar } from './AutopilotKpiBar';
import { AutopilotRunsTable } from './AutopilotRunsTable';
import { AutopilotConfigModal } from './AutopilotConfigModal';

export function AutopilotPanel() {
  const [modalOpen, setModalOpen] = useState(false);
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h2 className="text-lg font-semibold">Autopilot</h2>
          <p className="text-sm text-muted-foreground">
            Processa lotes inteiros automaticamente. Saída = Qualified Queue (nunca cria oportunidade/conta).
          </p>
        </div>
        <Button onClick={() => setModalOpen(true)} disabled>
          <Rocket className="h-4 w-4 mr-1" /> Executar Autopilot
        </Button>
      </div>
      <p className="text-xs text-muted-foreground -mt-3">
        Dica: para iniciar um lote, abra <strong>Sourcing</strong>, execute uma busca e clique em <strong>🚀 Executar Autopilot</strong> nos resultados.
      </p>
      <AutopilotKpiBar />
      <AutopilotRunsTable />
      <AutopilotConfigModal open={modalOpen} onClose={() => setModalOpen(false)} />
    </div>
  );
}
