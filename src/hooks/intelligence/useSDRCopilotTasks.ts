import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  listSDRCopilotTasks,
  createSDRCopilotTask,
  generateSDRMessage,
  updateSDRCopilotTaskStatus,
  type SDRCopilotFilters,
  type SDRCopilotStatus,
  type SDRCopilotChannel,
  type SDRCopilotTask,
} from '@/services/intelligence/sdrCopilot';

const KEY = ['kairos-sdr-copilot-tasks'] as const;

export function useSDRCopilotTasks(filters: SDRCopilotFilters = {}) {
  return useQuery({
    queryKey: [...KEY, filters],
    queryFn: () => listSDRCopilotTasks(filters),
    staleTime: 30_000,
  });
}

export function useCreateSDRCopilotTask() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ queueId, assignedTo }: { queueId: string; assignedTo?: string | null }) =>
      createSDRCopilotTask(queueId, assignedTo),
    onSuccess: () => qc.invalidateQueries({ queryKey: KEY }),
  });
}

export function useGenerateSDRMessage() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ taskId, channel, force }: { taskId: string; channel: SDRCopilotChannel; force?: boolean }) =>
      generateSDRMessage(taskId, channel, force),
    onSuccess: () => qc.invalidateQueries({ queryKey: KEY }),
  });
}

export function useUpdateSDRCopilotStatus() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ taskId, status, patch }: { taskId: string; status: SDRCopilotStatus; patch?: Partial<SDRCopilotTask> }) =>
      updateSDRCopilotTaskStatus(taskId, status, patch ?? {}),
    onSuccess: () => qc.invalidateQueries({ queryKey: KEY }),
  });
}
