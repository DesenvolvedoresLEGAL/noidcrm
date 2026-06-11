import { useState } from 'react';
import { QualifiedQueueKpiBar } from './QualifiedQueueKpiBar';
import { QualifiedQueueFiltersBar } from './QualifiedQueueFilters';
import { QualifiedQueueTable } from './QualifiedQueueTable';
import { ApproachBriefDrawer } from './ApproachBriefDrawer';
import { AcquisitionPipelineCard } from './AcquisitionPipelineCard';
import { useQualifiedQueue } from '@/hooks/intelligence/useQualifiedQueue';
import { Skeleton } from '@/components/ui/skeleton';
import type { QualifiedQueueFilters, QualifiedQueueItem } from '@/services/intelligence/qualifiedQueue';

export function QualifiedQueuePanel() {
  const [filters, setFilters] = useState<QualifiedQueueFilters>({});
  const [activeBrief, setActiveBrief] = useState<QualifiedQueueItem | null>(null);
  const { data, isLoading } = useQualifiedQueue(filters);

  return (
    <div className="space-y-4">
      <QualifiedQueueKpiBar />
      <AcquisitionPipelineCard />
      <QualifiedQueueFiltersBar value={filters} onChange={setFilters} />
      {isLoading ? (
        <Skeleton className="h-64 w-full" />
      ) : (
        <QualifiedQueueTable items={data ?? []} onOpenBrief={setActiveBrief} />
      )}
      <ApproachBriefDrawer item={activeBrief} onClose={() => setActiveBrief(null)} />
    </div>
  );
}
