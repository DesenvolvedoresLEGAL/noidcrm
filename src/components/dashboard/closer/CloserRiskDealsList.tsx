import { CloserSectionList } from './CloserSectionList';
import type { CloserListItem } from '@/types/dashboard/closer';

export function CloserRiskDealsList({ deals }: { deals: CloserListItem[] }) {
  return (
    <CloserSectionList
      title="Deals em risco"
      description="Oportunidades que podem escapar se ninguém agir."
      items={deals}
      emptyText="Nenhum deal em risco no momento."
    />
  );
}
