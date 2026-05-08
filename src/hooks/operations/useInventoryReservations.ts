import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useCurrentOrganization } from '@/hooks/useCurrentOrganization';
import { useSupabaseAuth } from '@/hooks/useSupabaseAuth';
import {
  cancelReservation,
  checkReservationConflict,
  convertPreReservationToReservation,
  getReservation,
  getReservationsOverview,
  listReservations,
  listReservationsByProposal,
  updateReservationStatus,
  type ReservationFilters,
} from '@/services/operations/inventoryReservations';
import type { ReservationStatus } from '@/lib/operations/inventoryReservations';

const baseKey = ['inventory', 'reservations'] as const;

function useInvalidate() {
  const qc = useQueryClient();
  return () => {
    qc.invalidateQueries({ queryKey: baseKey });
    qc.invalidateQueries({ queryKey: ['inventory', 'pre-reservations'] });
    qc.invalidateQueries({ queryKey: ['inventory', 'overview'] });
    qc.invalidateQueries({ queryKey: ['inventory-items'] });
  };
}

export function useInventoryReservations(filters: ReservationFilters = {}) {
  const { organization } = useCurrentOrganization();
  const orgId = organization?.id;
  return useQuery({
    queryKey: [...baseKey, orgId, filters],
    queryFn: () => listReservations(orgId as string, filters),
    enabled: !!orgId,
  });
}

export function useInventoryReservation(id?: string | null) {
  return useQuery({
    queryKey: [...baseKey, 'detail', id],
    queryFn: () => getReservation(id as string),
    enabled: !!id,
  });
}

export function useInventoryReservationsOverview() {
  const { organization } = useCurrentOrganization();
  return useQuery({
    queryKey: [...baseKey, 'overview', organization?.id],
    queryFn: getReservationsOverview,
    enabled: !!organization?.id,
  });
}

export function useProposalReservations(proposalId?: string | null) {
  const { organization } = useCurrentOrganization();
  return useQuery({
    queryKey: [...baseKey, 'by-proposal', organization?.id, proposalId],
    queryFn: () => listReservationsByProposal(organization!.id, proposalId as string),
    enabled: !!organization?.id && !!proposalId,
  });
}

export function useConvertPreReservationToReservation() {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: (input: {
      pre_reservation_id: string;
      confirmation_trigger?:
        | 'proposal_approved'
        | 'payment_confirmed'
        | 'manual'
        | 'agent';
    }) => convertPreReservationToReservation(input),
    onSuccess: invalidate,
  });
}

export function useUpdateInventoryReservationStatus() {
  const { user } = useSupabaseAuth();
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: ({
      id,
      status,
      current,
    }: {
      id: string;
      status: ReservationStatus;
      current?: ReservationStatus;
    }) => updateReservationStatus(id, status, current, user?.id ?? null),
    onSuccess: invalidate,
  });
}

export function useCancelInventoryReservation() {
  const { user } = useSupabaseAuth();
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: (id: string) => cancelReservation(id, user?.id ?? null),
    onSuccess: invalidate,
  });
}

export function useCheckInventoryReservationConflict() {
  return useMutation({
    mutationFn: (input: Parameters<typeof checkReservationConflict>[0]) =>
      checkReservationConflict(input),
  });
}
