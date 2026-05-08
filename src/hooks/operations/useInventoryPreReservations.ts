import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useCurrentOrganization } from '@/hooks/useCurrentOrganization';
import { useSupabaseAuth } from '@/hooks/useSupabaseAuth';
import {
  cancelPreReservation,
  checkAvailabilityForPeriod,
  createPreReservation,
  getItemPreReservationSummary,
  getPreReservation,
  getPreReservationsOverview,
  listPreReservations,
  listPreReservationsByProposal,
  recalculatePreReservation,
  updatePreReservation,
  type CreatePreReservationPayload,
  type PreReservationFilters,
} from '@/services/operations/inventoryPreReservations';
import { generatePreReservationFromProposal } from '@/services/operations/inventoryProposalBridge';

const baseKey = ['inventory', 'pre-reservations'] as const;

export function useInventoryPreReservations(filters: PreReservationFilters = {}) {
  const { organization } = useCurrentOrganization();
  const orgId = organization?.id;
  return useQuery({
    queryKey: [...baseKey, orgId, filters],
    queryFn: () => listPreReservations(orgId as string, filters),
    enabled: !!orgId,
  });
}

export function useInventoryPreReservation(id?: string | null) {
  return useQuery({
    queryKey: [...baseKey, 'detail', id],
    queryFn: () => getPreReservation(id as string),
    enabled: !!id,
  });
}

export function useInventoryPreReservationsOverview() {
  const { organization } = useCurrentOrganization();
  return useQuery({
    queryKey: [...baseKey, 'overview', organization?.id],
    queryFn: getPreReservationsOverview,
    enabled: !!organization?.id,
  });
}

export function useInventoryItemPreReservationSummary(input: {
  inventory_item_type: 'serialized' | 'quantity';
  serialized_item_id?: string | null;
  quantity_item_id?: string | null;
}) {
  const id = input.serialized_item_id ?? input.quantity_item_id ?? null;
  return useQuery({
    queryKey: [...baseKey, 'summary', input.inventory_item_type, id],
    queryFn: () => getItemPreReservationSummary(input),
    enabled: !!id,
  });
}

function useInvalidate() {
  const qc = useQueryClient();
  return () => {
    qc.invalidateQueries({ queryKey: baseKey });
    qc.invalidateQueries({ queryKey: ['inventory', 'overview'] });
    qc.invalidateQueries({ queryKey: ['inventory-items'] });
  };
}

export function useCreateInventoryPreReservation() {
  const { organization } = useCurrentOrganization();
  const { user } = useSupabaseAuth();
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: (input: Omit<CreatePreReservationPayload, 'organization_id' | 'user_id'>) =>
      createPreReservation({
        ...input,
        organization_id: organization?.id as string,
        user_id: user?.id ?? null,
      }),
    onSuccess: invalidate,
  });
}

export function useUpdateInventoryPreReservation() {
  const { user } = useSupabaseAuth();
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: ({
      id,
      patch,
    }: {
      id: string;
      patch: Parameters<typeof updatePreReservation>[1];
    }) => updatePreReservation(id, patch, user?.id ?? null),
    onSuccess: invalidate,
  });
}

export function useCancelInventoryPreReservation() {
  const { user } = useSupabaseAuth();
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: (id: string) => cancelPreReservation(id, user?.id ?? null),
    onSuccess: invalidate,
  });
}

export function useRecalculateInventoryPreReservation() {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: (id: string) => recalculatePreReservation(id),
    onSuccess: invalidate,
  });
}

export function useGeneratePreReservationFromProposal() {
  const { organization } = useCurrentOrganization();
  const { user } = useSupabaseAuth();
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: (input: {
      proposal_id: string;
      event_start_date: string;
      event_end_date: string;
      notes?: string | null;
    }) =>
      generatePreReservationFromProposal({
        organization_id: organization?.id as string,
        user_id: user?.id ?? null,
        ...input,
      }),
    onSuccess: invalidate,
  });
}

export function useProposalPreReservations(proposalId?: string | null) {
  const { organization } = useCurrentOrganization();
  return useQuery({
    queryKey: [...baseKey, 'by-proposal', organization?.id, proposalId],
    queryFn: () => listPreReservationsByProposal(organization!.id, proposalId as string),
    enabled: !!organization?.id && !!proposalId,
  });
}

export { checkAvailabilityForPeriod };
