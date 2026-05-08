import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useCurrentOrganization } from '@/hooks/useCurrentOrganization';
import {
  countCategories,
  countLocations,
  listCriticalItems,
  listOverviewItems,
  listRecentItems,
  listRecentStatusHistory,
  type OverviewItemSummary,
} from '@/services/operations/inventoryOverview';

const INDISPONIVEIS = ['blocked', 'maintenance', 'damaged', 'retired', 'lost'] as const;

function aggregate(items: OverviewItemSummary[]) {
  const totals = {
    serialized: 0,
    quantity: 0,
    available: 0,
    unavailable: 0,
  };
  const health = {
    blocked: 0,
    maintenance: 0,
    damaged: 0,
    lost: 0,
    retired: 0,
  };
  const alerts = {
    below: 0,
    zeroed: 0,
    maintenance: 0,
    damagedOrLost: 0,
  };

  for (const it of items) {
    if (it.item_kind === 'serialized') totals.serialized += 1;
    else if (it.item_kind === 'quantity') totals.quantity += 1;

    if (it.status === 'available') totals.available += 1;
    if ((INDISPONIVEIS as readonly string[]).includes(it.status)) totals.unavailable += 1;

    if (it.status in health) (health as any)[it.status] += 1;

    if (it.item_kind === 'quantity') {
      const a = Number(it.quantity_available ?? 0);
      if (a === 0) alerts.zeroed += 1;
      else if (
        it.quantity_minimum !== null &&
        it.quantity_minimum !== undefined &&
        a < Number(it.quantity_minimum)
      ) {
        alerts.below += 1;
      }
    }
    if (it.status === 'maintenance') alerts.maintenance += 1;
    if (it.status === 'damaged' || it.status === 'lost') alerts.damagedOrLost += 1;
  }

  return { totals, health, alerts, totalItems: items.length };
}

export function useInventoryOverview() {
  const { organization } = useCurrentOrganization();
  const orgId = organization?.id;
  const enabled = !!orgId;

  const itemsQ = useQuery({
    queryKey: ['inventory-overview', 'items', orgId],
    queryFn: () => listOverviewItems(orgId as string),
    enabled,
  });

  const categoriesCountQ = useQuery({
    queryKey: ['inventory-overview', 'categories-count', orgId],
    queryFn: () => countCategories(orgId as string),
    enabled,
  });

  const locationsCountQ = useQuery({
    queryKey: ['inventory-overview', 'locations-count', orgId],
    queryFn: () => countLocations(orgId as string),
    enabled,
  });

  const criticalQ = useQuery({
    queryKey: ['inventory-overview', 'critical', orgId],
    queryFn: () => listCriticalItems(orgId as string),
    enabled,
  });

  const recentItemsQ = useQuery({
    queryKey: ['inventory-overview', 'recent-items', orgId],
    queryFn: () => listRecentItems(orgId as string),
    enabled,
  });

  const recentHistoryQ = useQuery({
    queryKey: ['inventory-overview', 'recent-history', orgId],
    queryFn: () => listRecentStatusHistory(orgId as string),
    enabled,
  });

  const aggregates = useMemo(() => aggregate(itemsQ.data ?? []), [itemsQ.data]);

  return {
    isLoading:
      itemsQ.isLoading ||
      categoriesCountQ.isLoading ||
      locationsCountQ.isLoading,
    aggregates,
    categoriesCount: categoriesCountQ.data ?? 0,
    locationsCount: locationsCountQ.data ?? 0,
    criticalItems: criticalQ.data ?? [],
    criticalLoading: criticalQ.isLoading,
    recentItems: recentItemsQ.data ?? [],
    recentItemsLoading: recentItemsQ.isLoading,
    recentHistory: recentHistoryQ.data ?? [],
    recentHistoryLoading: recentHistoryQ.isLoading,
  };
}
