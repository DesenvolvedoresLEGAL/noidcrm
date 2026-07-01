import { SDRCopilotKpiBar } from './SDRCopilotKpiBar';
import { SDRCopilotTaskList } from './SDRCopilotTaskList';
import { ModuleHeader } from '@/components/intelligence/kairos/premium';
import { Headphones } from 'lucide-react';

export function SDRCopilotPanel() {
  return (
    <div className="space-y-5">
      <ModuleHeader
        icon={Headphones}
        eyebrow="Kairós · Operação"
        title="SDR Copilot"
        description="Fila operacional de pré-vendas. Sistema prepara brief, canal e mensagem — o humano decide."
        accent="emerald"
      />
      <SDRCopilotKpiBar />
      <SDRCopilotTaskList />
    </div>
  );
}
