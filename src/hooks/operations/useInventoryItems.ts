import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useCurrentOrganization } from '@/hooks/useCurrentOrganization';
import { useSupabaseAuth } from '@/hooks/useSupabaseAuth';
import {
  createSerializedItem,
  listSerializedItems,
  updateSerializedItem,
  updateSerializedItemStatus,
  type SerializedItemInput,
  listQuantityItems,
  createQuantityItem,
  updateQuantityItem,
  updateQuantityItemStatus,
  type QuantityItemInput,
} from '@/services/operations/inventoryItems';
import type { InventoryItemStatus } from '@/lib/operations/inventoryLabels';

export function useInventoryItems() {
  const { organization } = useCurrentOrganization();
  const orgId = organization?.id;
  return useQuery({
    queryKey: ['inventory-items', orgId],
    queryFn: () => listSerializedItems(orgId as string),
    enabled: !!orgId,
  });
}

export function useInventoryItemMutations() {
  const { organization } = useCurrentOrganization();
  const { user } = useSupabaseAuth();
  const orgId = organization?.id;
  const qc = useQueryClient();

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ['inventory-items', orgId] });
    qc.invalidateQueries({ queryKey: ['inventory-status-history'] });
  };

  const create = useMutation({
    mutationFn: (input: SerializedItemInput) =>
      createSerializedItem(orgId as string, user?.id, input),
    onSuccess: invalidate,
  });

  const update = useMutation({
    mutationFn: ({ id, input }: { id: string; input: Partial<SerializedItemInput> }) =>
      updateSerializedItem(id, user?.id, input),
    onSuccess: invalidate,
  });

  const updateStatus = useMutation({
    mutationFn: ({ id, status }: { id: string; status: InventoryItemStatus }) =>
      updateSerializedItemStatus(id, status, user?.id),
    onSuccess: invalidate,
  });

  return { create, update, updateStatus };
}
