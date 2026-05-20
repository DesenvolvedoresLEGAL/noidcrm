// PRICE AUDIT MAY 2026 — Hooks React Query.
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  AuditItem,
  AuditItemFilters,
  applyAuditItem,
  getAuditItem,
  ignoreAuditItem,
  listAuditItems,
  listAuditRuns,
  markAuditItemReview,
  runAudit,
} from '@/services/proposals/proposalFinancialAuditService';

const KEYS = {
  runs: ['price-audit', 'runs'] as const,
  items: (f: AuditItemFilters) => ['price-audit', 'items', f] as const,
  item: (id: string) => ['price-audit', 'item', id] as const,
};

export function useAuditRuns() {
  return useQuery({ queryKey: KEYS.runs, queryFn: listAuditRuns, staleTime: 30_000 });
}

export function useAuditItems(filters: AuditItemFilters, enabled = true) {
  return useQuery({
    queryKey: KEYS.items(filters),
    queryFn: () => listAuditItems(filters),
    enabled: enabled && !!filters.runId,
    staleTime: 30_000,
  });
}

export function useAuditItem(id: string | null) {
  return useQuery({
    queryKey: KEYS.item(id ?? ''),
    queryFn: () => getAuditItem(id!),
    enabled: !!id,
    staleTime: 10_000,
  });
}

export function useRunAudit() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: runAudit,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['price-audit'] });
    },
  });
}

export function useApplyAuditItem() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, mode }: { id: string; mode?: 'safe' | 'mirror_legacy_total' | 'force_with_snapshot' }) =>
      applyAuditItem(id, mode),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['price-audit'] }),
  });
}

export function useIgnoreAuditItem() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, note }: { id: string; note?: string }) => ignoreAuditItem(id, note),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['price-audit'] }),
  });
}

export function useMarkAuditItemReview() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, note }: { id: string; note?: string }) => markAuditItemReview(id, note),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['price-audit'] }),
  });
}

export type { AuditItem };
