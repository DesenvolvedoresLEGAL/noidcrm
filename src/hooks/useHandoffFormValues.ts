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
}

/**
 * P0.4: Loads custom_form_values rows attached to this VENDAS opportunity
 * that were cloned from PRÉ VENDAS via the handoff (is_readonly_handoff=true),
 * plus the original form definitions so the renderer can show them read-only.
 */
export function useHandoffFormValues(opportunityId: string | undefined) {
  return useQuery({
    queryKey: ['handoff-form-values', opportunityId],
    enabled: !!opportunityId,
    queryFn: async (): Promise<HandoffFormBundle[]> => {
      if (!opportunityId) return [];

      const { data: valuesRows, error } = await supabase
        .from('custom_form_values')
        .select('id, custom_form_id, entity_id, values, filled_by, filled_at, source_opportunity_id, is_readonly_handoff')
        .eq('entity_id', opportunityId)
        .eq('is_readonly_handoff', true);

      if (error) throw error;
      if (!valuesRows || valuesRows.length === 0) return [];

      const formIds = Array.from(new Set(valuesRows.map((r: any) => r.custom_form_id)));
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

      return valuesRows
        .map((row: any) => {
          const form = formById.get(row.custom_form_id);
          if (!form) return null;
          return {
            valuesRow: {
              ...row,
              values: (row.values || {}) as Record<string, any>,
            },
            form,
          } as HandoffFormBundle;
        })
        .filter(Boolean) as HandoffFormBundle[];
    },
  });
}
