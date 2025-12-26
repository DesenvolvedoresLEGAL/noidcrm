import { supabase } from '@/integrations/supabase/client';

export type AlgorithmType = 'CS' | 'BS' | 'DS' | 'RAS' | 'GAMIFICATION' | 'XP';

export interface AlgorithmVersion {
  id: string;
  organization_id: string | null;
  algorithm_type: AlgorithmType;
  version: string;
  description: string | null;
  weights: Record<string, number>;
  inputs: string[];
  data_sources: string[];
  is_active: boolean;
  is_default: boolean;
  created_at: string;
  created_by: string | null;
  deprecated_at: string | null;
  deprecated_reason: string | null;
}

export interface ScoreCalculationHistory {
  id: string;
  organization_id: string;
  seller_id: string;
  score_type: AlgorithmType;
  algorithm_version_id: string | null;
  version_number: string;
  score_value: number;
  inputs_snapshot: Record<string, any>;
  weights_snapshot: Record<string, number>;
  breakdown: Record<string, any>;
  calculated_at: string;
  period_start: string | null;
  period_end: string | null;
  is_official: boolean;
}

// Get active algorithm version for a specific type
export async function getActiveAlgorithmVersion(
  algorithmType: AlgorithmType,
  organizationId?: string
): Promise<AlgorithmVersion | null> {
  // First try organization-specific version
  if (organizationId) {
    const { data: orgVersion } = await supabase
      .from('algorithm_versions')
      .select('*')
      .eq('algorithm_type', algorithmType)
      .eq('organization_id', organizationId)
      .eq('is_active', true)
      .single();

    if (orgVersion) {
      return orgVersion as unknown as AlgorithmVersion;
    }
  }

  // Fall back to global default
  const { data: defaultVersion } = await supabase
    .from('algorithm_versions')
    .select('*')
    .eq('algorithm_type', algorithmType)
    .is('organization_id', null)
    .eq('is_default', true)
    .single();

  return defaultVersion as unknown as AlgorithmVersion | null;
}

// Get all versions for an algorithm type
export async function getAllAlgorithmVersions(
  algorithmType: AlgorithmType,
  organizationId?: string
): Promise<AlgorithmVersion[]> {
  let query = supabase
    .from('algorithm_versions')
    .select('*')
    .eq('algorithm_type', algorithmType)
    .order('created_at', { ascending: false });

  if (organizationId) {
    query = query.or(`organization_id.eq.${organizationId},organization_id.is.null`);
  }

  const { data, error } = await query;

  if (error) {
    console.error('Error fetching algorithm versions:', error);
    return [];
  }

  return (data || []) as unknown as AlgorithmVersion[];
}

// Create a new algorithm version
export async function createAlgorithmVersion(
  version: Omit<AlgorithmVersion, 'id' | 'created_at'>
): Promise<AlgorithmVersion | null> {
  const { data, error } = await supabase
    .from('algorithm_versions')
    .insert(version as any)
    .select()
    .single();

  if (error) {
    console.error('Error creating algorithm version:', error);
    return null;
  }

  return data as unknown as AlgorithmVersion;
}

// Activate a specific version (deactivates others of same type)
export async function activateAlgorithmVersion(
  versionId: string,
  organizationId: string
): Promise<boolean> {
  // Get the version to activate
  const { data: version } = await supabase
    .from('algorithm_versions')
    .select('algorithm_type')
    .eq('id', versionId)
    .single();

  if (!version) return false;

  // Deactivate other versions of same type for this org
  await supabase
    .from('algorithm_versions')
    .update({ is_active: false } as any)
    .eq('algorithm_type', version.algorithm_type)
    .eq('organization_id', organizationId);

  // Activate the selected version
  const { error } = await supabase
    .from('algorithm_versions')
    .update({ is_active: true } as any)
    .eq('id', versionId);

  return !error;
}

// Deprecate a version
export async function deprecateAlgorithmVersion(
  versionId: string,
  reason: string
): Promise<boolean> {
  const { error } = await supabase
    .from('algorithm_versions')
    .update({
      deprecated_at: new Date().toISOString(),
      deprecated_reason: reason,
      is_active: false
    } as any)
    .eq('id', versionId);

  return !error;
}

// Record score calculation with version tracking
export async function recordScoreCalculation(
  record: Omit<ScoreCalculationHistory, 'id' | 'calculated_at'>
): Promise<ScoreCalculationHistory | null> {
  const { data, error } = await supabase
    .from('score_calculation_history')
    .insert(record as any)
    .select()
    .single();

  if (error) {
    console.error('Error recording score calculation:', error);
    return null;
  }

  return data as unknown as ScoreCalculationHistory;
}

// Get score history for a seller
export async function getSellerScoreHistory(
  sellerId: string,
  scoreType?: AlgorithmType,
  limit: number = 30
): Promise<ScoreCalculationHistory[]> {
  let query = supabase
    .from('score_calculation_history')
    .select('*')
    .eq('seller_id', sellerId)
    .order('calculated_at', { ascending: false })
    .limit(limit);

  if (scoreType) {
    query = query.eq('score_type', scoreType);
  }

  const { data, error } = await query;

  if (error) {
    console.error('Error fetching score history:', error);
    return [];
  }

  return (data || []) as unknown as ScoreCalculationHistory[];
}

// Rollback to a previous version (creates a new activation, doesn't delete)
export async function rollbackToVersion(
  versionId: string,
  organizationId: string
): Promise<boolean> {
  return activateAlgorithmVersion(versionId, organizationId);
}

// Compare two versions
export async function compareVersions(
  versionId1: string,
  versionId2: string
): Promise<{ version1: AlgorithmVersion; version2: AlgorithmVersion; differences: string[] } | null> {
  const { data: versions } = await supabase
    .from('algorithm_versions')
    .select('*')
    .in('id', [versionId1, versionId2]);

  if (!versions || versions.length !== 2) return null;

  const v1 = versions.find(v => v.id === versionId1) as unknown as AlgorithmVersion;
  const v2 = versions.find(v => v.id === versionId2) as unknown as AlgorithmVersion;

  const differences: string[] = [];

  // Compare weights
  const allWeightKeys = new Set([
    ...Object.keys(v1.weights || {}),
    ...Object.keys(v2.weights || {})
  ]);

  for (const key of allWeightKeys) {
    const w1 = (v1.weights as any)?.[key];
    const w2 = (v2.weights as any)?.[key];
    if (w1 !== w2) {
      differences.push(`Peso "${key}": ${w1 ?? 'N/A'} → ${w2 ?? 'N/A'}`);
    }
  }

  // Compare inputs
  const inputs1 = new Set(v1.inputs || []);
  const inputs2 = new Set(v2.inputs || []);
  
  for (const input of inputs1) {
    if (!inputs2.has(input)) {
      differences.push(`Input removido: ${input}`);
    }
  }
  for (const input of inputs2) {
    if (!inputs1.has(input)) {
      differences.push(`Input adicionado: ${input}`);
    }
  }

  return { version1: v1, version2: v2, differences };
}
