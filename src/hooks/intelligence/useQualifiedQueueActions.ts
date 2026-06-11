import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import {
  discardQueueItem,
  sendToHumanReview,
  updateQueueItem,
  type QualifiedQueueItem,
} from '@/services/intelligence/qualifiedQueue';
import { opportunityKeys, accountKeys, contactKeys } from '@/lib/query-keys';

function invalidate(qc: ReturnType<typeof useQueryClient>) {
  qc.invalidateQueries({ queryKey: ['kairos-qualified-queue'] });
  qc.invalidateQueries({ queryKey: ['kairos-qualified-queue-kpis'] });
}

export function useEnqueueProspect() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (prospectId: string) => {
      const { data, error } = await supabase.functions.invoke('kairos-enqueue-prospect', {
        body: { prospect_id: prospectId },
      });
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      invalidate(qc);
      toast.success('Enviado para Qualified Queue');
    },
    onError: (e: Error) => toast.error(e.message || 'Erro ao enviar para fila'),
  });
}

export function useGenerateApproachBrief() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (item: QualifiedQueueItem) => {
      const { data, error } = await supabase.functions.invoke('kairos-generate-approach-brief', {
        body: { queue_id: item.id, prospect_id: item.prospect_id },
      });
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      invalidate(qc);
      toast.success('Brief de abordagem gerado');
    },
    onError: (e: Error) => toast.error(e.message || 'Erro ao gerar brief'),
  });
}

export function usePromoteToCrm() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (item: QualifiedQueueItem) => {
      const { data, error } = await supabase.functions.invoke('kairos-promote-to-crm', {
        body: { queue_id: item.id },
      });
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      invalidate(qc);
      qc.invalidateQueries({ queryKey: opportunityKeys.lists() });
      qc.invalidateQueries({ queryKey: accountKeys.lists() });
      qc.invalidateQueries({ queryKey: contactKeys.lists() });
      toast.success('Promovido ao CRM com task para SDR');
    },
    onError: (e: Error) => toast.error(e.message || 'Erro ao promover para CRM'),
  });
}

export function useDiscardQueueItem() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, reason }: { id: string; reason: string }) => discardQueueItem(id, reason),
    onSuccess: () => {
      invalidate(qc);
      toast.success('Descartado');
    },
  });
}

export function useSendToReview() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, reason }: { id: string; reason: string }) => sendToHumanReview(id, reason),
    onSuccess: () => {
      invalidate(qc);
      toast.success('Enviado para revisão');
    },
  });
}

export function useRunEnrichment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (item: QualifiedQueueItem) => {
      const { error } = await supabase.functions.invoke('enrich-prospect-identity', {
        body: { prospect_id: item.prospect_id },
      });
      if (error) throw error;
      await updateQueueItem(item.id, { enrichment_status: 'enriched' });
    },
    onSuccess: () => {
      invalidate(qc);
      toast.success('Enriquecimento executado');
    },
    onError: (e: Error) => toast.error(e.message || 'Erro no enriquecimento'),
  });
}

export function useFindDecisionMakers() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (item: QualifiedQueueItem) => {
      const { error } = await supabase.functions.invoke('apollo-find-decision-makers', {
        body: { prospect_id: item.prospect_id },
      });
      if (error) throw error;
      await updateQueueItem(item.id, { decision_maker_status: 'found' });
    },
    onSuccess: () => {
      invalidate(qc);
      toast.success('Decisores localizados');
    },
    onError: (e: Error) => toast.error(e.message || 'Erro ao buscar decisores'),
  });
}
