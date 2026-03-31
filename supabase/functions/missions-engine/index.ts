import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Map seller_role_type enum values to mission target_roles values
function mapSellerRoleToTargetRole(sellerRole: string | null): string[] {
  if (!sellerRole) return ['sales']; // default fallback
  const roleMap: Record<string, string[]> = {
    'Closer': ['closer', 'sales'],
    'SDR': ['sdr', 'sales'],
    'BDR': ['bdr', 'sales'],
    'AE': ['ae', 'sales'],
    'Farmer': ['farmer', 'sales'],
    'CS': ['cs'],
    'AM': ['am', 'sales'],
    'Hunter': ['hunter', 'sales'],
  };
  return roleMap[sellerRole] || ['sales'];
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { sellerId, action, metadata } = await req.json();

    if (!sellerId) {
      throw new Error('sellerId is required');
    }

    console.log(`[missions-engine] Processing action: ${action} for seller: ${sellerId}`);

    // Get seller's organization and role
    const { data: seller } = await supabase
      .from('sellers')
      .select('organization_id, role')
      .eq('id', sellerId)
      .single();

    if (!seller) {
      throw new Error('Seller not found');
    }

    const sellerRoles = mapSellerRoleToTargetRole(seller.role);
    console.log(`[missions-engine] Seller role: ${seller.role}, mapped target roles: ${sellerRoles.join(', ')}`);

    const today = new Date().toISOString().split('T')[0];
    const weekStart = getWeekStart(new Date()).toISOString().split('T')[0];

    // Ensure seller has mission entries for today/this week (filtered by role)
    await ensureMissionEntries(supabase, sellerId, today, weekStart, sellerRoles);

    // Handle specific action
    if (action === 'claim') {
      const { missionId } = metadata || {};
      return await handleClaimMission(supabase, sellerId, missionId, corsHeaders);
    }

    // Update progress based on action type
    const updatedMissions = await updateMissionProgress(supabase, sellerId, action, metadata, today, weekStart);

    console.log(`[missions-engine] Updated ${updatedMissions.length} missions`);

    return new Response(
      JSON.stringify({ 
        success: true, 
        updatedMissions,
        message: `Processed ${action} for seller ${sellerId}`
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('[missions-engine] Error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ success: false, error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

function getWeekStart(date: Date): Date {
  const d = new Date(date);
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1); // Monday as first day
  return new Date(d.setDate(diff));
}

async function ensureMissionEntries(supabase: any, sellerId: string, today: string, weekStart: string, sellerRoles: string[]) {
  // Get active missions that match the seller's role
  const { data: missions } = await supabase
    .from('missions')
    .select('id, type, target_roles')
    .eq('is_active', true);

  if (!missions?.length) return;

  // Filter missions by target_roles matching seller's roles
  const filteredMissions = missions.filter((m: any) => {
    if (!m.target_roles || m.target_roles.length === 0) return true; // no restriction
    return m.target_roles.some((tr: string) => sellerRoles.includes(tr));
  });

  console.log(`[missions-engine] Filtered ${filteredMissions.length}/${missions.length} missions for roles: ${sellerRoles.join(', ')}`);

  // Get existing entries
  const { data: existing } = await supabase
    .from('seller_missions')
    .select('mission_id, period_start')
    .eq('seller_id', sellerId)
    .in('period_start', [today, weekStart]);

  const existingSet = new Set(existing?.map((e: any) => `${e.mission_id}-${e.period_start}`) || []);

  // Create missing entries
  const toInsert = filteredMissions
    .filter((m: any) => {
      const periodStart = m.type === 'daily' ? today : weekStart;
      return !existingSet.has(`${m.id}-${periodStart}`);
    })
    .map((m: any) => ({
      seller_id: sellerId,
      mission_id: m.id,
      period_start: m.type === 'daily' ? today : weekStart,
      current_progress: 0,
      completed: false,
      claimed: false
    }));

  if (toInsert.length > 0) {
    await supabase.from('seller_missions').insert(toInsert);
    console.log(`[missions-engine] Created ${toInsert.length} mission entries for seller`);
  }
}

async function updateMissionProgress(
  supabase: any, 
  sellerId: string, 
  action: string, 
  metadata: any, 
  today: string, 
  weekStart: string
) {
  // Map actions to target types
  const actionToTargetType: Record<string, string[]> = {
    'login': ['login', 'login_days'],
    'roleplay_complete': ['roleplay_complete'],
    'roleplay_pass': ['roleplay_pass', 'roleplay_complete'],
    'activity_create': ['activity_create'],
    'proposal_create': ['proposal_create'],
    'proposal_send': ['proposal_create'],
  };

  const targetTypes = actionToTargetType[action] || [];
  if (targetTypes.length === 0) {
    console.log(`[missions-engine] No target types for action: ${action}`);
    return [];
  }

  // Get missions that match these target types
  const { data: missions } = await supabase
    .from('missions')
    .select('id, type, target_type, target_value, code')
    .eq('is_active', true)
    .in('target_type', targetTypes);

  if (!missions?.length) return [];

  const updatedMissions: any[] = [];

  for (const mission of missions) {
    const periodStart = mission.type === 'daily' ? today : weekStart;

    // Get current progress
    const { data: sellerMission } = await supabase
      .from('seller_missions')
      .select('*')
      .eq('seller_id', sellerId)
      .eq('mission_id', mission.id)
      .eq('period_start', periodStart)
      .single();

    if (!sellerMission || sellerMission.completed) continue;

    let newProgress = sellerMission.current_progress;

    // Handle special cases
    if (mission.target_type === 'roleplay_avg_score' && metadata?.score) {
      newProgress = Math.round(metadata.score * 10);
    } else if (mission.target_type === 'login_days') {
      const { count } = await supabase
        .from('seller_missions')
        .select('*', { count: 'exact', head: true })
        .eq('seller_id', sellerId)
        .eq('mission_id', mission.id)
        .eq('period_start', periodStart);
      
      newProgress = sellerMission.current_progress + 1;
    } else {
      newProgress = sellerMission.current_progress + 1;
    }

    const isCompleted = newProgress >= mission.target_value;

    const { error } = await supabase
      .from('seller_missions')
      .update({
        current_progress: newProgress,
        completed: isCompleted,
        completed_at: isCompleted ? new Date().toISOString() : null
      })
      .eq('id', sellerMission.id);

    if (!error) {
      updatedMissions.push({
        missionId: mission.id,
        code: mission.code,
        newProgress,
        isCompleted
      });
    }
  }

  return updatedMissions;
}

async function handleClaimMission(supabase: any, sellerId: string, missionId: string, corsHeaders: any) {
  if (!missionId) {
    return new Response(
      JSON.stringify({ success: false, error: 'missionId is required for claim' }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  const today = new Date().toISOString().split('T')[0];
  const weekStart = getWeekStart(new Date()).toISOString().split('T')[0];

  const { data: sellerMissions } = await supabase
    .from('seller_missions')
    .select('*, missions(*)')
    .eq('seller_id', sellerId)
    .eq('mission_id', missionId)
    .eq('completed', true)
    .eq('claimed', false)
    .in('period_start', [today, weekStart]);

  const sellerMission = sellerMissions?.[0];

  if (!sellerMission) {
    console.log(`[missions-engine] No claimable mission found for mission_id: ${missionId}, seller: ${sellerId}`);
    return new Response(
      JSON.stringify({ success: false, error: 'Mission not found or already claimed' }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  const xpReward = sellerMission.missions.xp_reward;

  await supabase
    .from('seller_missions')
    .update({ 
      claimed: true, 
      claimed_at: new Date().toISOString() 
    })
    .eq('id', sellerMission.id);

  const { data: seller } = await supabase
    .from('sellers')
    .select('total_xp')
    .eq('id', sellerId)
    .single();

  const newXP = (seller?.total_xp || 0) + xpReward;

  await supabase
    .from('sellers')
    .update({ total_xp: newXP })
    .eq('id', sellerId);

  await supabase.from('notifications').insert({
    user_id: (await supabase.from('sellers').select('user_id').eq('id', sellerId).single()).data?.user_id,
    organization_id: (await supabase.from('sellers').select('organization_id').eq('id', sellerId).single()).data?.organization_id,
    type: 'mission_completed',
    title: 'Missão Completa!',
    message: `Você completou "${sellerMission.missions.name}" e ganhou ${xpReward} XP!`,
    metadata: { 
      mission_id: missionId, 
      mission_name: sellerMission.missions.name,
      xp_earned: xpReward 
    }
  });

  console.log(`[missions-engine] Claimed mission ${missionId}, awarded ${xpReward} XP`);

  return new Response(
    JSON.stringify({ 
      success: true, 
      xpEarned: xpReward,
      missionName: sellerMission.missions.name,
      newTotalXP: newXP
    }),
    { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  );
}
