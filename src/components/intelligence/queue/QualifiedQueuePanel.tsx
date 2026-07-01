import { useState } from 'react';
import { QualifiedQueueKpiBar } from './QualifiedQueueKpiBar';
import { QualifiedQueueFiltersBar } from './QualifiedQueueFilters';
import { QualifiedQueueTable } from './QualifiedQueueTable';
import { ApproachBriefDrawer } from './ApproachBriefDrawer';
import { AcquisitionPipelineCard } from './AcquisitionPipelineCard';
import { useQualifiedQueue } from '@/hooks/intelligence/useQualifiedQueue';
import { ModuleHeader, TableSkeleton, PremiumEmpty } from '@/components/intelligence/kairos/premium';
import { Inbox, ListChecks } from 'lucide-react';
import type { QualifiedQueueFilters, QualifiedQueueItem } from '@/services/intelligence/qualifiedQueue';

export function QualifiedQueuePanel() {
  const [filters, setFilters] = useState<QualifiedQueueFilters>({});
  const [activeBrief, setActiveBrief] = useState<QualifiedQueueItem | null>(null);
  const { data, isLoading } = useQualifiedQueue(filters);

  return (
    <div className="space-y-5">
      <ModuleHeader
        icon={Inbox}
        eyebrow="Kairós · Operação"
        title="Qualified Queue"
        description="Prospects capturados, enriquecidos e prontos para SDR. Priorize e promova ao CRM."
        accent="violet"
      />
      <QualifiedQueueKpiBar />
      <AcquisitionPipelineCard />
      <QualifiedQueueFiltersBar value={filters} onChange={setFilters} />
      {isLoading ? (
        <TableSkeleton rows={6} cols={8} />
      ) : (data?.length ?? 0) === 0 ? (
        <PremiumEmpty
          icon={ListChecks}
          title="Nenhum item na fila"
          description="Ajuste os filtros ou execute um Autopilot para capturar e qualificar novos prospects."
        />
      ) : (
        <QualifiedQueueTable items={data ?? []} onOpenBrief={setActiveBrief} />
      )}
      <ApproachBriefDrawer item={activeBrief} onClose={() => setActiveBrief(null)} />
    </div>
  );
}
