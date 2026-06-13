import { useQuery } from '@tanstack/react-query';
import { useEffect, useMemo, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useCustomFormsByPipeline } from '@/hooks/useCustomForms';
import { useCustomFormValues } from '@/hooks/useCustomFormValues';
import {
  computeQualificationScore,
  QualificationScoreResult,
} from '@/lib/qualification/qualificationScore';
import { logQualificationScoreEvent } from '@/services/crm/timeline-logger';

/** Module-level dedupe across multiple hook instances rendering the same opp. */
const qualScoreLastSignatureByOpp = new Map<
  string,
  { score: number; tier: string }
>();

const QUALIFICATION_KEYS = [
  'nome_evento',
  'data_evento',
  'local_evento',
  'conexoes_simultaneas',
  'equipamentos',
  'finalidade_uso',
  'urgencia_real',
  'poder_decisao',
  'proximo_passo',
  'permissao_proposta',
] as const;

interface UseQualOpts {
  opportunityId: string | undefined;
  pipelineId: string | undefined;
  account?: { id?: string | null; nome_fantasia?: string | null; razao_social?: string | null } | null;
  contact?: { id?: string | null; nome?: string | null; first_name?: string | null } | null;
}

export interface UseQualificationScoreReturn extends QualificationScoreResult {
  isLoading: boolean;
  formId: string | undefined;
  hasForm: boolean;
}

export function useOpportunityQualificationScore({
  opportunityId,
  pipelineId,
  account,
  contact,
}: UseQualOpts): UseQualificationScoreReturn {
  const { data: forms = [], isLoading: loadingForms } =
    useCustomFormsByPipeline(pipelineId);

  // Pick the qualification checklist: prefer the Sprint 1 form by name, else first opportunity-typed.
  const form = useMemo(() => {
    const norm = (s?: string) => (s || '').toLowerCase();
    const byName = forms.find((f) =>
      norm(f.name).startsWith('checklist obrigatório de qualificação') ||
      norm(f.name).startsWith('checklist obrigatorio de qualificacao')
    );
    if (byName) return byName;
    return forms.find((f) => f.entity_type === 'opportunity');
  }, [forms]);

  const { data: savedValues, isLoading: loadingValues } = useCustomFormValues(
    form?.id,
    opportunityId
  );

  // Fetch the qualification custom_fields metadata so we can map field UUIDs → field_key.
  const { data: fieldMap = {}, isLoading: loadingFields } = useQuery({
    queryKey: ['qualification-field-ids'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('custom_fields')
        .select('id, field_key')
        .eq('entity_type', 'opportunity')
        .in('field_key', QUALIFICATION_KEYS as unknown as string[]);
      if (error) throw error;
      const map: Record<string, string> = {};
      for (const row of data || []) map[row.id] = row.field_key;
      return map;
    },
    staleTime: 5 * 60 * 1000,
  });

  const result = useMemo<QualificationScoreResult>(() => {
    const raw = (savedValues?.values || {}) as Record<string, unknown>;
    const valuesByKey: Record<string, unknown> = {};
    // CustomFormRenderer saves custom-field keys as `custom-<entity>-<fieldUuid>`
    // (e.g. "custom-opportunity-<uuid>"). Strip the prefix before mapping to field_key.
    // Also accept bare UUIDs as a fallback for any legacy payloads.
    for (const [rawKey, value] of Object.entries(raw)) {
      let uuid: string | undefined;
      if (rawKey.startsWith('custom-opportunity-')) {
        uuid = rawKey.slice('custom-opportunity-'.length);
      } else if (rawKey.startsWith('custom-')) {
        // custom-<entity>-<uuid>
        const parts = rawKey.split('-');
        uuid = parts.slice(2).join('-');
      } else if (fieldMap[rawKey]) {
        uuid = rawKey;
      }
      if (!uuid) continue;
      const key = fieldMap[uuid];
      if (!key) continue;
      // Normalize: numeric strings → number for `conexoes_simultaneas`.
      if (key === 'conexoes_simultaneas' && typeof value === 'string') {
        const n = Number(value);
        valuesByKey[key] = Number.isFinite(n) ? n : value;
      } else {
        valuesByKey[key] = value;
      }
    }
    const hasAccount = !!(
      account?.id ||
      account?.nome_fantasia ||
      account?.razao_social
    );
    const hasContact = !!(contact?.id || contact?.nome || contact?.first_name);
    return computeQualificationScore(valuesByKey, { hasAccount, hasContact });
  }, [savedValues, fieldMap, account, contact]);

  const isLoading = loadingForms || loadingValues || loadingFields;

  // Sprint 4 — log relevant score changes (tier change or |delta| ≥ 10)
  const initializedRef = useRef(false);
  useEffect(() => {
    if (!opportunityId || isLoading) return;
    const signature = { score: result.total, tier: result.classification.tier };
    const last = qualScoreLastSignatureByOpp.get(opportunityId);
    if (!last) {
      qualScoreLastSignatureByOpp.set(opportunityId, signature);
      initializedRef.current = true;
      return;
    }
    const tierChanged = last.tier !== signature.tier;
    const deltaSig = Math.abs(signature.score - last.score) >= 10;
    if (!tierChanged && !deltaSig) return;
    qualScoreLastSignatureByOpp.set(opportunityId, signature);
    logQualificationScoreEvent(opportunityId, {
      previousScore: last.score,
      nextScore: signature.score,
      previousTier: last.tier,
      nextTier: signature.tier,
      nextTierLabel: result.classification.label,
      pendingBlockers: result.blockers,
    }).catch((err) => console.error('[qualScore] log failed', err));
  }, [opportunityId, isLoading, result.total, result.classification.tier, result.classification.label, result.blockers]);

  return {
    ...result,
    isLoading,
    formId: form?.id,
    hasForm: !!form,
  };
}
