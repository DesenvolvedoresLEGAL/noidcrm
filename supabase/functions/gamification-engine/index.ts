import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Level progression system
const LEVELS = [
  { level: 1, xp: 0, title: 'Iniciante' },
  { level: 2, xp: 100, title: 'Aprendiz' },
  { level: 3, xp: 300, title: 'Vendedor Jr.' },
  { level: 4, xp: 600, title: 'Vendedor' },
  { level: 5, xp: 1000, title: 'Vendedor Sr.' },
  { level: 6, xp: 1500, title: 'Especialista' },
  { level: 7, xp: 2200, title: 'Expert' },
  { level: 8, xp: 3000, title: 'Mestre' },
  { level: 9, xp: 4000, title: 'Campeão' },
  { level: 10, xp: 5500, title: 'Lenda de Vendas' },
];

function getLevelFromXP(xp: number): { level: number; title: string; nextLevelXP: number; progress: number } {
  let currentLevel = LEVELS[0];
  let nextLevel = LEVELS[1];
  
  for (let i = LEVELS.length - 1; i >= 0; i--) {
    if (xp >= LEVELS[i].xp) {
      currentLevel = LEVELS[i];
      nextLevel = LEVELS[i + 1] || LEVELS[i];
      break;
    }
  }
  
  const xpForCurrentLevel = xp - currentLevel.xp;
  const xpNeededForNext = nextLevel.xp - currentLevel.xp;
  const progress = xpNeededForNext > 0 ? (xpForCurrentLevel / xpNeededForNext) * 100 : 100;
  
  return {
    level: currentLevel.level,
    title: currentLevel.title,
    nextLevelXP: nextLevel.xp,
    progress: Math.min(progress, 100)
  };
}

// Calculate weighted XP: base_xp * activity_weight * gap_correction_multiplier
function calculateWeightedXP(baseXP: number, activityWeight: number = 1.0, isGapCorrection: boolean = false): number {
  return baseXP * activityWeight * (isGapCorrection ? 1.5 : 1.0);
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { sellerId, sessionId } = await req.json();
    
    if (!sellerId) {
      throw new Error('sellerId is required');
    }

    console.log(`[gamification-engine] Processing for seller: ${sellerId}`);

    // Get seller stats
    const { data: seller } = await supabase
      .from('sellers')
      .select('id, total_xp, current_level, organization_id, current_streak')
      .eq('id', sellerId)
      .single();

    if (!seller) {
      throw new Error('Seller not found');
    }

    // Get all completed sessions for this seller
    const { data: sessions } = await supabase
      .from('roleplay_sessions')
      .select('id, score_overall, passed, started_at, finished_at, archetype_id')
      .eq('seller_id', sellerId)
      .not('finished_at', 'is', null)
      .gte('exchanges_count', 5);

    const totalSessions = sessions?.length || 0;
    const passedSessions = sessions?.filter(s => s.passed)?.length || 0;
    const passRate = totalSessions > 0 ? (passedSessions / totalSessions) * 100 : 0;
    const avgScore = totalSessions > 0 
      ? sessions!.reduce((sum, s) => sum + (s.score_overall || 0), 0) / totalSessions 
      : 0;
    const perfectScores = sessions?.filter(s => s.score_overall === 10)?.length || 0;

    // Get today's sessions
    const today = new Date().toISOString().split('T')[0];
    const todaySessions = sessions?.filter(s => 
      s.started_at?.startsWith(today)
    )?.length || 0;

    // Calculate streak
    const uniqueDates = [...new Set(
      sessions?.map(s => new Date(s.started_at).toISOString().split('T')[0]) || []
    )].sort((a, b) => new Date(b).getTime() - new Date(a).getTime());

    let currentStreak = 0;
    const todayDate = new Date().toISOString().split('T')[0];
    const yesterdayDate = new Date(Date.now() - 86400000).toISOString().split('T')[0];
    
    if (uniqueDates[0] === todayDate || uniqueDates[0] === yesterdayDate) {
      const todayTime = new Date(todayDate).getTime();
      for (let i = 0; i < uniqueDates.length; i++) {
        const expectedDate = new Date(todayTime - (currentStreak * 86400000)).toISOString().split('T')[0];
        if (uniqueDates[i] === expectedDate) {
          currentStreak++;
        } else {
          break;
        }
      }
    }

    // Update seller's current_streak
    await supabase
      .from('sellers')
      .update({ current_streak: currentStreak })
      .eq('id', sellerId);

    // Get unique archetypes used
    const uniqueArchetypes = [...new Set(sessions?.map(s => s.archetype_id).filter(Boolean))];

    // Get total archetypes available
    const { count: totalArchetypes } = await supabase
      .from('client_archetypes')
      .select('id', { count: 'exact', head: true })
      .eq('organization_id', seller.organization_id);

    // Check for special session criteria (if sessionId provided)
    let sessionDuration = 0;
    let sessionHour = 12;
    let sessionPassed = false;
    let sessionScore = 0;
    
    if (sessionId) {
      const currentSession = sessions?.find(s => s.id === sessionId);
      if (currentSession && currentSession.finished_at && currentSession.started_at) {
        const start = new Date(currentSession.started_at);
        const end = new Date(currentSession.finished_at);
        sessionDuration = (end.getTime() - start.getTime()) / 60000; // minutes
        sessionHour = start.getHours();
        sessionPassed = currentSession.passed || false;
        sessionScore = currentSession.score_overall || 0;
      }
    }

    // Get all badges and seller's unlocked badges
    const { data: allBadges } = await supabase
      .from('badges')
      .select('*')
      .eq('is_active', true);

    const { data: unlockedBadges } = await supabase
      .from('seller_badges')
      .select('badge_id')
      .eq('seller_id', sellerId);

    const unlockedBadgeIds = new Set(unlockedBadges?.map(b => b.badge_id) || []);

    // Check each badge for unlock
    const newlyUnlockedBadges: any[] = [];
    let xpEarned = 0;
    let weightedXpEarned = 0;

    const stats = {
      totalSessions,
      passedSessions,
      passRate,
      avgScore,
      perfectScores,
      todaySessions,
      currentStreak,
      uniqueArchetypes: uniqueArchetypes.length,
      totalArchetypes: totalArchetypes || 0,
      sessionDuration,
      sessionHour,
      sessionPassed,
      sessionScore,
    };

    for (const badge of allBadges || []) {
      if (unlockedBadgeIds.has(badge.id)) continue;

      const criteria = badge.criteria as { type: string; value: number };
      let unlocked = false;

      switch (criteria.type) {
        case 'sessions_count':
          unlocked = stats.totalSessions >= criteria.value;
          break;
        case 'streak_days':
          unlocked = stats.currentStreak >= criteria.value;
          break;
        case 'avg_score':
          unlocked = stats.avgScore >= criteria.value && stats.totalSessions >= 5;
          break;
        case 'perfect_score':
          unlocked = stats.perfectScores >= criteria.value;
          break;
        case 'daily_sessions':
          unlocked = stats.todaySessions >= criteria.value;
          break;
        case 'pass_rate':
          unlocked = stats.passRate >= criteria.value && stats.totalSessions >= 10;
          break;
        case 'early_training':
          unlocked = stats.sessionHour < criteria.value && sessionId;
          break;
        case 'late_training':
          unlocked = stats.sessionHour >= criteria.value && sessionId;
          break;
        case 'first_pass':
          unlocked = stats.passedSessions >= criteria.value;
          break;
        case 'quick_pass':
          unlocked = stats.sessionDuration > 0 && stats.sessionDuration < criteria.value && stats.sessionPassed;
          break;
        case 'long_session':
          unlocked = stats.sessionDuration >= criteria.value;
          break;
        case 'all_archetypes':
          unlocked = stats.uniqueArchetypes >= stats.totalArchetypes && stats.totalArchetypes > 0;
          break;
      }

      if (unlocked) {
        // Calculate weighted XP for badge (badges use standard weight)
        const badgeXP = badge.xp_reward;
        const badgeWeightedXP = calculateWeightedXP(badgeXP, 1.0, false);
        
        // Insert badge
        await supabase
          .from('seller_badges')
          .insert({
            seller_id: sellerId,
            badge_id: badge.id,
            metadata: { stats, unlockedBy: sessionId || 'check', weightedXP: badgeWeightedXP }
          });

        newlyUnlockedBadges.push(badge);
        xpEarned += badgeXP;
        weightedXpEarned += badgeWeightedXP;

        // Create notification
        await supabase
          .from('notifications')
          .insert({
            user_id: (await supabase.from('sellers').select('user_id').eq('id', sellerId).single()).data?.user_id,
            organization_id: seller.organization_id,
            type: 'badge_unlocked',
            title: `🏆 Badge Desbloqueado: ${badge.name}`,
            message: badge.description,
            metadata: { badge_id: badge.id, badge_code: badge.code, xp_earned: badgeXP, weighted_xp: badgeWeightedXP }
          });
      }
    }

    // Check and complete dynamic missions
    console.log(`[gamification-engine] Checking dynamic missions for seller: ${sellerId}`);
    const { data: completedMissions } = await supabase.rpc('check_dynamic_mission_completion', {
      p_seller_id: sellerId
    });

    const dynamicMissionsCompleted: any[] = [];
    if (completedMissions && completedMissions.length > 0) {
      for (const mission of completedMissions) {
        dynamicMissionsCompleted.push(mission);
        weightedXpEarned += Number(mission.xp_earned) || 0;
        
        // Get mission details for notification
        const { data: missionDetails } = await supabase
          .from('dynamic_missions')
          .select('description, xp_reward, xp_weighted, is_gap_correction')
          .eq('id', mission.mission_id)
          .single();
        
        if (missionDetails) {
          // Create notification for completed dynamic mission
          const { data: sellerUser } = await supabase
            .from('sellers')
            .select('user_id')
            .eq('id', sellerId)
            .single();
            
          await supabase
            .from('notifications')
            .insert({
              user_id: sellerUser?.user_id,
              organization_id: seller.organization_id,
              type: 'mission_completed',
              title: `🎯 Missão Completa!`,
              message: missionDetails.description,
              metadata: { 
                mission_id: mission.mission_id, 
                mission_type: mission.mission_type,
                xp_earned: missionDetails.xp_reward,
                weighted_xp: missionDetails.xp_weighted,
                is_gap_correction: missionDetails.is_gap_correction
              }
            });
        }
      }
      console.log(`[gamification-engine] Completed ${completedMissions.length} dynamic missions, earned ${weightedXpEarned} weighted XP`);
    }

    // Update seller XP and level (use weighted XP)
    const newTotalXP = (seller.total_xp || 0) + Math.round(weightedXpEarned);
    const newLevelInfo = getLevelFromXP(newTotalXP);
    const previousLevel = seller.current_level || 1;

    await supabase
      .from('sellers')
      .update({
        total_xp: newTotalXP,
        current_level: newLevelInfo.level,
        current_title: newLevelInfo.title
      })
      .eq('id', sellerId);

    // Check for level up and notify
    if (newLevelInfo.level > previousLevel) {
      const { data: sellerUser } = await supabase
        .from('sellers')
        .select('user_id')
        .eq('id', sellerId)
        .single();

      await supabase
        .from('notifications')
        .insert({
          user_id: sellerUser?.user_id,
          organization_id: seller.organization_id,
          type: 'level_up',
          title: `🎉 Level Up! Nível ${newLevelInfo.level}`,
          message: `Parabéns! Você agora é um "${newLevelInfo.title}"!`,
          metadata: { new_level: newLevelInfo.level, new_title: newLevelInfo.title, total_xp: newTotalXP }
        });
    }

    // Update achievement progress
    const { data: allAchievements } = await supabase
      .from('achievements')
      .select('*')
      .eq('is_active', true);

    for (const achievement of allAchievements || []) {
      let progress = 0;
      
      switch (achievement.code) {
        case 'sessions_25':
        case 'sessions_100':
          progress = stats.totalSessions;
          break;
        case 'streak_30':
          progress = stats.currentStreak;
          break;
        case 'avg_score_85':
          progress = Math.round(stats.avgScore * 10);
          break;
        case 'weekly_5':
          // Get this week's sessions
          const weekStart = new Date();
          weekStart.setDate(weekStart.getDate() - weekStart.getDay());
          const weekSessions = sessions?.filter(s => 
            new Date(s.started_at) >= weekStart
          )?.length || 0;
          progress = weekSessions;
          break;
        case 'monthly_20':
          const monthStart = new Date();
          monthStart.setDate(1);
          const monthSessions = sessions?.filter(s => 
            new Date(s.started_at) >= monthStart
          )?.length || 0;
          progress = monthSessions;
          break;
      }

      const completed = progress >= achievement.target_value;

      await supabase
        .from('seller_achievements')
        .upsert({
          seller_id: sellerId,
          achievement_id: achievement.id,
          current_progress: Math.min(progress, achievement.target_value),
          completed,
          completed_at: completed ? new Date().toISOString() : null
        }, { onConflict: 'seller_id,achievement_id' });
    }

    console.log(`[gamification-engine] Completed. New badges: ${newlyUnlockedBadges.length}, XP earned: ${xpEarned}, Weighted XP: ${weightedXpEarned}, Dynamic missions: ${dynamicMissionsCompleted.length}`);

    return new Response(JSON.stringify({
      success: true,
      newBadges: newlyUnlockedBadges,
      xpEarned,
      weightedXpEarned: Math.round(weightedXpEarned),
      totalXP: newTotalXP,
      level: newLevelInfo,
      leveledUp: newLevelInfo.level > previousLevel,
      dynamicMissionsCompleted,
      stats
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('[gamification-engine] Error:', error);
    return new Response(JSON.stringify({ 
      success: false, 
      error: 'Failed to process gamification' 
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});
