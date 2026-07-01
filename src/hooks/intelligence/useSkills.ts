import { useQuery, useMutation } from '@tanstack/react-query';
import {
  listSkills, getSkill, listSkillMetrics, listSkillRuns,
  runSkill, routeSkill, submitSkillFeedback,
} from '@/services/intelligence/skills';

export function useSkills() {
  return useQuery({ queryKey: ['noid-skills'], queryFn: listSkills, staleTime: 60_000 });
}
export function useSkill(id: string | undefined) {
  return useQuery({
    queryKey: ['noid-skill', id],
    queryFn: () => getSkill(id!),
    enabled: !!id,
  });
}
export function useSkillMetrics() {
  return useQuery({ queryKey: ['noid-skill-metrics'], queryFn: listSkillMetrics, staleTime: 30_000 });
}
export function useSkillRuns(skillId: string | undefined) {
  return useQuery({
    queryKey: ['noid-skill-runs', skillId],
    queryFn: () => listSkillRuns(skillId!),
    enabled: !!skillId,
  });
}
export function useRunSkill() {
  return useMutation({ mutationFn: runSkill });
}
export function useRouteSkill() {
  return useMutation({ mutationFn: routeSkill });
}
export function useSkillFeedback() {
  return useMutation({ mutationFn: submitSkillFeedback });
}
