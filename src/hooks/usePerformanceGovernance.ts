import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import {
  AlgorithmType,
  AlgorithmVersion,
  getActiveAlgorithmVersion,
  getAllAlgorithmVersions,
  createAlgorithmVersion,
  activateAlgorithmVersion,
  deprecateAlgorithmVersion,
  getSellerScoreHistory,
  compareVersions
} from '@/services/performance/algorithmVersioning';
import {
  getActivityMappings,
  initializeDefaultMappings,
  runFullMigration,
  getXPConversionHistory,
  getBadgePreservationHistory
} from '@/services/performance/dataMigration';

// Hook for algorithm versions
export function useAlgorithmVersions(algorithmType: AlgorithmType) {
  const { profile } = useCurrentUser();
  const queryClient = useQueryClient();

  const versionsQuery = useQuery({
    queryKey: ['algorithm-versions', algorithmType, profile?.organization_id],
    queryFn: () => getAllAlgorithmVersions(algorithmType, profile?.organization_id || undefined),
    enabled: !!algorithmType
  });

  const activeVersionQuery = useQuery({
    queryKey: ['active-algorithm-version', algorithmType, profile?.organization_id],
    queryFn: () => getActiveAlgorithmVersion(algorithmType, profile?.organization_id || undefined),
    enabled: !!algorithmType
  });

  const createMutation = useMutation({
    mutationFn: (version: Omit<AlgorithmVersion, 'id' | 'created_at'>) => createAlgorithmVersion(version),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['algorithm-versions', algorithmType] });
    }
  });

  const activateMutation = useMutation({
    mutationFn: (versionId: string) => 
      activateAlgorithmVersion(versionId, profile?.organization_id || ''),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['algorithm-versions', algorithmType] });
      queryClient.invalidateQueries({ queryKey: ['active-algorithm-version', algorithmType] });
    }
  });

  const deprecateMutation = useMutation({
    mutationFn: ({ versionId, reason }: { versionId: string; reason: string }) =>
      deprecateAlgorithmVersion(versionId, reason),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['algorithm-versions', algorithmType] });
    }
  });

  return {
    versions: versionsQuery.data || [],
    activeVersion: activeVersionQuery.data,
    isLoading: versionsQuery.isLoading || activeVersionQuery.isLoading,
    createVersion: createMutation.mutateAsync,
    activateVersion: activateMutation.mutateAsync,
    deprecateVersion: deprecateMutation.mutateAsync,
    isCreating: createMutation.isPending,
    isActivating: activateMutation.isPending
  };
}

// Hook for score history with version tracking
export function useScoreHistory(sellerId: string, scoreType?: AlgorithmType, limit = 30) {
  return useQuery({
    queryKey: ['score-history', sellerId, scoreType, limit],
    queryFn: () => getSellerScoreHistory(sellerId, scoreType, limit),
    enabled: !!sellerId
  });
}

// Hook for version comparison
export function useVersionComparison(versionId1: string, versionId2: string) {
  return useQuery({
    queryKey: ['version-comparison', versionId1, versionId2],
    queryFn: () => compareVersions(versionId1, versionId2),
    enabled: !!versionId1 && !!versionId2
  });
}

// Hook for data migration
export function useDataMigration() {
  const { profile, user } = useCurrentUser();
  const queryClient = useQueryClient();

  const activityMappingsQuery = useQuery({
    queryKey: ['activity-mappings', profile?.organization_id],
    queryFn: () => getActivityMappings(profile?.organization_id || ''),
    enabled: !!profile?.organization_id
  });

  const initializeMappingsMutation = useMutation({
    mutationFn: () => initializeDefaultMappings(profile?.organization_id || ''),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['activity-mappings'] });
    }
  });

  const runMigrationMutation = useMutation({
    mutationFn: () => runFullMigration(profile?.organization_id || '', user?.id || ''),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['activity-mappings'] });
      queryClient.invalidateQueries({ queryKey: ['xp-conversion-history'] });
      queryClient.invalidateQueries({ queryKey: ['badge-preservation-history'] });
    }
  });

  return {
    activityMappings: activityMappingsQuery.data || [],
    isLoadingMappings: activityMappingsQuery.isLoading,
    initializeMappings: initializeMappingsMutation.mutateAsync,
    runFullMigration: runMigrationMutation.mutateAsync,
    isMigrating: runMigrationMutation.isPending
  };
}

// Hook for XP conversion history
export function useXPConversionHistory(sellerId: string) {
  return useQuery({
    queryKey: ['xp-conversion-history', sellerId],
    queryFn: () => getXPConversionHistory(sellerId),
    enabled: !!sellerId
  });
}

// Hook for badge preservation history
export function useBadgePreservationHistory(sellerId: string) {
  return useQuery({
    queryKey: ['badge-preservation-history', sellerId],
    queryFn: () => getBadgePreservationHistory(sellerId),
    enabled: !!sellerId
  });
}

// Combined governance hook
export function usePerformanceGovernance() {
  const { profile } = useCurrentUser();
  
  const csVersions = useAlgorithmVersions('CS');
  const bsVersions = useAlgorithmVersions('BS');
  const dsVersions = useAlgorithmVersions('DS');
  const rasVersions = useAlgorithmVersions('RAS');
  const migration = useDataMigration();

  return {
    algorithmVersions: {
      CS: csVersions,
      BS: bsVersions,
      DS: dsVersions,
      RAS: rasVersions
    },
    migration,
    currentVersions: {
      CS: csVersions.activeVersion,
      BS: bsVersions.activeVersion,
      DS: dsVersions.activeVersion,
      RAS: rasVersions.activeVersion
    },
    isLoading: csVersions.isLoading || bsVersions.isLoading || dsVersions.isLoading || rasVersions.isLoading
  };
}
