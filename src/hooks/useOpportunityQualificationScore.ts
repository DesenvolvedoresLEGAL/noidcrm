import { useQuery } from '@tanstack/react-query';
import { useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useCustomFormsByPipeline } from '@/hooks/useCustomForms';
import { useCustomFormValues } from '@/hooks/useCustomFormValues';
import {
  computeQualificationScore,
  QualificationScoreResult,
} from '@/lib/qualification/qualificationScore';

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
    for (const [fieldId, value] of Object.entries(raw)) {
      const key = fieldMap[fieldId];
      if (key) valuesByKey[key] = value;
    }
    const hasAccount = !!(
      account?.id ||
      account?.nome_fantasia ||
      account?.razao_social
    );
    const hasContact = !!(contact?.id || contact?.nome || contact?.first_name);
    return computeQualificationScore(valuesByKey, { hasAccount, hasContact });
  }, [savedValues, fieldMap, account, contact]);

  return {
    ...result,
    isLoading: loadingForms || loadingValues || loadingFields,
    formId: form?.id,
    hasForm: !!form,
  };
}
