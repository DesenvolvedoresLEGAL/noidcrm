import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import type { CustomForm, CustomFormField } from '@/hooks/useCustomForms';

export interface HandoffFormBundle {
  valuesRow: {
    id: string;
    custom_form_id: string;
    entity_id: string;
    values: Record<string, any>;
    filled_by: string | null;
    filled_at: string;
    source_opportunity_id: string | null;
    is_readonly_handoff: boolean;
  };
  form: CustomForm;
  /** True when the bundle is being read directly from the source opportunity
   * (fallback mode) because no cloned read-only row exists on this opportunity. */
  fromSource?: boolean;
}

/**
 * P0.4: Loads custom_form_values rows attached to this VENDAS opportunity
 * that were cloned from PRÉ VENDAS via the handoff (is_readonly_handoff=true),
 * plus the original form definitions so the renderer can show them read-only.
 *
 * Fallback (HOTFIX): when no cloned rows exist but the opportunity carries a
 * `source_opportunity_id`, fetch the form values directly from the source
 * (PRÉ VENDAS) opportunity. This ensures the qualification data shows up in
 * VENDAS even when the execute-workflow clone step was skipped (e.g. handoff
 * created through the RPC path before the cloner ran).
 */
export function useHandoffFormValues(
  opportunityId: string | undefined,
  sourceOpportunityId?: string | null,
) {
  return useQuery({
    queryKey: ['handoff-form-values', opportunityId, sourceOpportunityId ?? null],
    enabled: !!opportunityId,
    queryFn: async (): Promise<HandoffFormBundle[]> => {
      if (!opportunityId) return [];

      // 1) Primary: cloned read-only rows on this opportunity.
      const { data: clonedRows, error } = await supabase
        .from('custom_form_values')
        .select('id, custom_form_id, entity_id, values, filled_by, filled_at, source_opportunity_id, is_readonly_handoff')
        .eq('entity_id', opportunityId)
        .eq('is_readonly_handoff', true);

      if (error) throw error;

      let workingRows: any[] = clonedRows || [];
      let fromSource = false;

      // 2) Fallback: read source opp values directly when no clones exist.
      if ((!workingRows || workingRows.length === 0) && sourceOpportunityId) {
        const { data: sourceRows, error: srcErr } = await supabase
          .from('custom_form_values')
          .select('id, custom_form_id, entity_id, values, filled_by, filled_at, source_opportunity_id, is_readonly_handoff')
          .eq('entity_id', sourceOpportunityId)
          .eq('entity_type', 'opportunity');
        if (srcErr) throw srcErr;
        workingRows = sourceRows || [];
        fromSource = true;
      }

      if (!workingRows || workingRows.length === 0) return [];

      const formIds = Array.from(new Set(workingRows.map((r: any) => r.custom_form_id)));
      const { data: forms, error: formsErr } = await supabase
        .from('custom_forms')
        .select('*')
        .in('id', formIds);
      if (formsErr) throw formsErr;

      const formById = new Map<string, CustomForm>();
      (forms || []).forEach((f: any) => {
        formById.set(f.id, {
          ...f,
          fields: (Array.isArray(f.fields) ? f.fields : []) as CustomFormField[],
          pipeline_ids: f.pipeline_ids || [],
          activity_type_ids: f.activity_type_ids || [],
        } as CustomForm);
      });

      return workingRows
        .map((row: any) => {
          const form = formById.get(row.custom_form_id);
          if (!form) return null;
          return {
            valuesRow: {
              ...row,
              values: (row.values || {}) as Record<string, any>,
              // Normalize: when reading from source as fallback, surface the
              // source id and treat as read-only handoff downstream.
              source_opportunity_id: fromSource
                ? (sourceOpportunityId ?? row.entity_id)
                : row.source_opportunity_id,
              is_readonly_handoff: fromSource ? true : !!row.is_readonly_handoff,
            },
            form,
            fromSource,
          } as HandoffFormBundle;
        })
        .filter(Boolean) as HandoffFormBundle[];
    },
  });
}
