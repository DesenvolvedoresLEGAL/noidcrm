import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import {
  submitDynamicDashboardFeedback,
  type SubmitFeedbackInput,
} from '@/services/crm/dynamicDashboardFeedback';

export function useDynamicDashboardFeedback(tenantId: string | null | undefined) {
  const qc = useQueryClient();
  const [submitted, setSubmitted] = useState(false);

  const mutation = useMutation({
    mutationFn: (input: SubmitFeedbackInput) => submitDynamicDashboardFeedback(input),
    onSuccess: () => {
      setSubmitted(true);
      if (tenantId) {
        qc.invalidateQueries({ queryKey: ['closer-observability', 'feedback-summary', tenantId] });
        qc.invalidateQueries({ queryKey: ['closer-observability', 'feedback-list', tenantId] });
      }
    },
  });

  return {
    submitFeedback: mutation.mutate,
    submitFeedbackAsync: mutation.mutateAsync,
    isSubmitting: mutation.isPending,
    submitted,
    error: mutation.error,
    reset: () => {
      setSubmitted(false);
      mutation.reset();
    },
  };
}
