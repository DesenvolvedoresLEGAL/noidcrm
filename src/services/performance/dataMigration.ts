import { supabase } from '@/integrations/supabase/client';

export interface ActivityMapping {
  id: string;
  organization_id: string;
  legacy_activity_type: string;
  legacy_activity_code: string | null;
  new_activity_id: string | null;
  mapping_rules: Record<string, any>;
  migrated_count: number;
  last_migrated_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface XPConversionHistory {
  id: string;
  organization_id: string;
  seller_id: string;
  legacy_xp: number;
  legacy_level: number | null;
  converted_xp: number;
  conversion_factor: number;
  conversion_rules: Record<string, any>;
  converted_at: string;
  converted_by: string | null;
}

export interface BadgePreservationHistory {
  id: string;
  organization_id: string | null;
  seller_id: string;
  badge_id: string;
  original_earned_at: string;
  preservation_reason: string;
  legacy_criteria: Record<string, any>;
  new_criteria_met: boolean;
  preserved_at: string;
}

// Legacy activity type mappings to new NOID categories
const LEGACY_ACTIVITY_MAPPINGS: Record<string, { category: string; code: string }> = {
  'call': { category: 'INDIVIDUAL', code: 'IND-01' },
  'email': { category: 'INDIVIDUAL', code: 'IND-02' },
  'meeting': { category: 'INDIVIDUAL', code: 'IND-03' },
  'proposal': { category: 'INDIVIDUAL', code: 'IND-04' },
  'follow_up': { category: 'INDIVIDUAL', code: 'IND-02' },
  'prospecting': { category: 'INDIVIDUAL', code: 'IND-01' },
  'demo': { category: 'INDIVIDUAL', code: 'IND-05' },
  'negotiation': { category: 'INDIVIDUAL', code: 'IND-06' },
  'roleplay': { category: 'INDIVIDUAL', code: 'IND-07' },
  'crm_update': { category: 'COLETIVO', code: 'COL-01' },
  'team_meeting': { category: 'COLETIVO', code: 'COL-02' },
  'training': { category: 'COLETIVO', code: 'COL-03' },
  'forecast': { category: 'COMPANHIA', code: 'CO-02' },
  'report': { category: 'COMPANHIA', code: 'CO-03' }
};

// XP conversion factors based on legacy system
const XP_CONVERSION_RULES = {
  base_multiplier: 1.0,
  level_bonus: 0.1, // 10% bonus per level
  badge_bonus: 50,  // Extra XP per badge
  achievement_bonus: 100
};

// Get all activity mappings for an organization
export async function getActivityMappings(organizationId: string): Promise<ActivityMapping[]> {
  const { data, error } = await supabase
    .from('activity_mappings')
    .select('*')
    .eq('organization_id', organizationId)
    .order('legacy_activity_type');

  if (error) {
    console.error('Error fetching activity mappings:', error);
    return [];
  }

  return (data || []) as unknown as ActivityMapping[];
}

// Create activity mapping
export async function createActivityMapping(
  mapping: Omit<ActivityMapping, 'id' | 'created_at' | 'updated_at' | 'migrated_count' | 'last_migrated_at'>
): Promise<ActivityMapping | null> {
  const { data, error } = await supabase
    .from('activity_mappings')
    .insert(mapping as any)
    .select()
    .single();

  if (error) {
    console.error('Error creating activity mapping:', error);
    return null;
  }

  return data as unknown as ActivityMapping;
}

// Initialize default mappings for an organization
export async function initializeDefaultMappings(organizationId: string): Promise<number> {
  // Get existing performance activities
  const { data: activities } = await supabase
    .from('performance_activities')
    .select('id, code')
    .eq('organization_id', organizationId);

  const activityCodeMap = new Map(
    (activities || []).map(a => [a.code, a.id])
  );

  const mappingsToCreate = Object.entries(LEGACY_ACTIVITY_MAPPINGS).map(([legacyType, { code }]) => ({
    organization_id: organizationId,
    legacy_activity_type: legacyType,
    legacy_activity_code: null,
    new_activity_id: activityCodeMap.get(code) || null,
    mapping_rules: LEGACY_ACTIVITY_MAPPINGS[legacyType]
  }));

  const { data, error } = await supabase
    .from('activity_mappings')
    .insert(mappingsToCreate as any)
    .select();

  if (error) {
    console.error('Error initializing default mappings:', error);
    return 0;
  }

  return data?.length || 0;
}

// Convert legacy XP to new weighted system
export async function convertLegacyXP(
  sellerId: string,
  organizationId: string,
  legacyXP: number,
  legacyLevel: number,
  convertedBy?: string
): Promise<XPConversionHistory | null> {
  // Calculate converted XP with bonuses
  const levelBonus = legacyLevel * XP_CONVERSION_RULES.level_bonus * legacyXP;
  const convertedXP = Math.round(legacyXP * XP_CONVERSION_RULES.base_multiplier + levelBonus);

  const conversionRecord = {
    organization_id: organizationId,
    seller_id: sellerId,
    legacy_xp: legacyXP,
    legacy_level: legacyLevel,
    converted_xp: convertedXP,
    conversion_factor: XP_CONVERSION_RULES.base_multiplier,
    conversion_rules: XP_CONVERSION_RULES,
    converted_by: convertedBy
  };

  const { data, error } = await supabase
    .from('xp_conversion_history')
    .insert(conversionRecord as any)
    .select()
    .single();

  if (error) {
    console.error('Error converting legacy XP:', error);
    return null;
  }

  // Update seller's XP
  await supabase
    .from('sellers')
    .update({ total_xp: convertedXP } as any)
    .eq('id', sellerId);

  return data as unknown as XPConversionHistory;
}

// Preserve badge history during migration
export async function preserveBadgeHistory(
  sellerId: string,
  badgeId: string,
  originalEarnedAt: string,
  legacyCriteria: Record<string, any>,
  organizationId?: string
): Promise<BadgePreservationHistory | null> {
  const preservation = {
    organization_id: organizationId,
    seller_id: sellerId,
    badge_id: badgeId,
    original_earned_at: originalEarnedAt,
    preservation_reason: 'migration',
    legacy_criteria: legacyCriteria,
    new_criteria_met: true
  };

  const { data, error } = await supabase
    .from('badge_preservation_history')
    .insert(preservation as any)
    .select()
    .single();

  if (error) {
    console.error('Error preserving badge history:', error);
    return null;
  }

  return data as unknown as BadgePreservationHistory;
}

// Migrate all seller badges to preservation history
export async function migrateSellerBadges(
  sellerId: string,
  organizationId: string
): Promise<number> {
  // Get all seller badges
  const { data: sellerBadges } = await supabase
    .from('seller_badges')
    .select('*, badges(*)')
    .eq('seller_id', sellerId);

  if (!sellerBadges || sellerBadges.length === 0) return 0;

  let preserved = 0;
  for (const sb of sellerBadges) {
    const result = await preserveBadgeHistory(
      sellerId,
      sb.badge_id,
      sb.unlocked_at,
      { original_badge: sb.badges, earned_context: sb },
      organizationId
    );
    if (result) preserved++;
  }

  return preserved;
}

// Get XP conversion history for a seller
export async function getXPConversionHistory(sellerId: string): Promise<XPConversionHistory[]> {
  const { data, error } = await supabase
    .from('xp_conversion_history')
    .select('*')
    .eq('seller_id', sellerId)
    .order('converted_at', { ascending: false });

  if (error) {
    console.error('Error fetching XP conversion history:', error);
    return [];
  }

  return (data || []) as unknown as XPConversionHistory[];
}

// Get badge preservation history for a seller
export async function getBadgePreservationHistory(sellerId: string): Promise<BadgePreservationHistory[]> {
  const { data, error } = await supabase
    .from('badge_preservation_history')
    .select('*')
    .eq('seller_id', sellerId)
    .order('preserved_at', { ascending: false });

  if (error) {
    console.error('Error fetching badge preservation history:', error);
    return [];
  }

  return (data || []) as unknown as BadgePreservationHistory[];
}

// Run full migration for an organization
export async function runFullMigration(
  organizationId: string,
  convertedBy: string
): Promise<{
  mappingsCreated: number;
  sellersProcessed: number;
  xpConverted: number;
  badgesPreserved: number;
}> {
  const result = {
    mappingsCreated: 0,
    sellersProcessed: 0,
    xpConverted: 0,
    badgesPreserved: 0
  };

  // 1. Initialize activity mappings
  result.mappingsCreated = await initializeDefaultMappings(organizationId);

  // 2. Get all sellers in organization
  const { data: sellers } = await supabase
    .from('sellers')
    .select('id, total_xp, current_level')
    .eq('organization_id', organizationId);

  if (!sellers) return result;

  // 3. Process each seller
  for (const seller of sellers) {
    result.sellersProcessed++;

    // Convert XP if they have any
    if (seller.total_xp && seller.total_xp > 0) {
      const xpResult = await convertLegacyXP(
        seller.id,
        organizationId,
        seller.total_xp,
        seller.current_level || 1,
        convertedBy
      );
      if (xpResult) result.xpConverted++;
    }

    // Preserve badges
    const badgesPreserved = await migrateSellerBadges(seller.id, organizationId);
    result.badgesPreserved += badgesPreserved;
  }

  return result;
}
