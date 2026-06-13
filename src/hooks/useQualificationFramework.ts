import { useQuery } from '@tanstack/react-query';
import {
  getActiveFramework,
  getFrameworkBundle,
  listFrameworks,
} from '@/services/qualification/frameworksService';

export function useQualificationFrameworks() {
  return useQuery({
    queryKey: ['qualification-frameworks'],
    queryFn: listFrameworks,
    staleTime: 60_000,
  });
}

export function useActiveQualificationFramework() {
  return useQuery({
    queryKey: ['qualification-framework', 'active'],
    queryFn: getActiveFramework,
    staleTime: 5 * 60_000,
  });
}

export function useQualificationFrameworkBundle(frameworkId: string | undefined) {
  return useQuery({
    queryKey: ['qualification-framework-bundle', frameworkId],
    queryFn: () => (frameworkId ? getFrameworkBundle(frameworkId) : Promise.resolve(null)),
    enabled: !!frameworkId,
    staleTime: 30_000,
  });
}
