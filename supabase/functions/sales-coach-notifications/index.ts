import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Validate internal secret for CRON calls
    const internalSecret = req.headers.get("x-internal-secret");
    const expectedSecret = Deno.env.get("INTERNAL_WORKFLOW_SECRET");
    if (!expectedSecret || internalSecret !== expectedSecret) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type" },
      });
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    console.log('[sales-coach-notifications] Starting daily notifications check');

    // Get all active sellers
    const { data: sellers } = await supabase
      .from('sellers')
      .select('id, user_id, name, organization_id, total_xp, current_level, current_title')
      .eq('active', true);

    if (!sellers?.length) {
      return new Response(JSON.stringify({ success: true, message: 'No active sellers' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const today = new Date().toISOString().split('T')[0];
    const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0];
    const notificationsSent: string[] = [];

    for (const seller of sellers) {
      // Get seller's recent sessions
      const { data: sessions } = await supabase
        .from('roleplay_sessions')
        .select('started_at, passed')
        .eq('seller_id', seller.id)
        .not('finished_at', 'is', null)
        .gte('exchanges_count', 5)
        .order('started_at', { ascending: false })
        .limit(100);

      const uniqueDates = [...new Set(
        sessions?.map(s => new Date(s.started_at).toISOString().split('T')[0]) || []
      )].sort((a, b) => new Date(b).getTime() - new Date(a).getTime());

      const trainedToday = uniqueDates[0] === today;
      const trainedYesterday = uniqueDates[0] === yesterday;

      // Calculate current streak
      let currentStreak = 0;
      const todayTime = new Date(today).getTime();
      
      if (trainedToday || trainedYesterday) {
        for (let i = 0; i < uniqueDates.length; i++) {
          const expectedDate = new Date(todayTime - (currentStreak * 86400000)).toISOString().split('T')[0];
          if (uniqueDates[i] === expectedDate) {
            currentStreak++;
          } else {
            break;
          }
        }
      }

      // Get badges close to unlock
      const { data: allBadges } = await supabase
        .from('badges')
        .select('*')
        .eq('is_active', true);

      const { data: unlockedBadges } = await supabase
        .from('seller_badges')
        .select('badge_id')
        .eq('seller_id', seller.id);

      const unlockedIds = new Set(unlockedBadges?.map(b => b.badge_id) || []);
      
      // Calculate stats for badge progress
      const totalSessions = sessions?.length || 0;

      // Find badges close to unlock (within 80% progress)
      const closeToBadges = allBadges?.filter(badge => {
        if (unlockedIds.has(badge.id)) return false;
        const criteria = badge.criteria as { type: string; value: number };
        
        if (criteria.type === 'sessions_count') {
          return totalSessions >= criteria.value * 0.8 && totalSessions < criteria.value;
        }
        if (criteria.type === 'streak_days') {
          return currentStreak >= criteria.value * 0.8 && currentStreak < criteria.value;
        }
        return false;
      }) || [];

      // 1. Streak at risk notification
      if (!trainedToday && currentStreak >= 3) {
        await supabase.from('notifications').insert({
          user_id: seller.user_id,
          organization_id: seller.organization_id,
          type: 'streak_at_risk',
          title: `🔥 Seu streak de ${currentStreak} dias está em risco!`,
          message: `Olá ${seller.name?.split(' ')[0]}! Treine hoje para manter seu streak de ${currentStreak} dias consecutivos.`,
          metadata: { streak: currentStreak, seller_id: seller.id }
        });
        notificationsSent.push(`streak_at_risk:${seller.id}`);
      }

      // 2. Training reminder (if didn't train yesterday and today)
      if (!trainedToday && !trainedYesterday && totalSessions > 0) {
        await supabase.from('notifications').insert({
          user_id: seller.user_id,
          organization_id: seller.organization_id,
          type: 'training_reminder',
          title: '📚 Hora de treinar!',
          message: `Olá ${seller.name?.split(' ')[0]}! Você não treinou nos últimos dias. Que tal uma sessão rápida de roleplay?`,
          metadata: { days_since_training: 2, seller_id: seller.id }
        });
        notificationsSent.push(`training_reminder:${seller.id}`);
      }

      // 3. Badge progress notification
      if (closeToBadges.length > 0) {
        const badge = closeToBadges[0];
        const criteria = badge.criteria as { type: string; value: number };
        let remaining = 0;
        
        if (criteria.type === 'sessions_count') {
          remaining = criteria.value - totalSessions;
        } else if (criteria.type === 'streak_days') {
          remaining = criteria.value - currentStreak;
        }

        await supabase.from('notifications').insert({
          user_id: seller.user_id,
          organization_id: seller.organization_id,
          type: 'badge_progress',
          title: `🎯 Você está perto de desbloquear "${badge.name}"!`,
          message: `Faltam apenas ${remaining} ${criteria.type === 'sessions_count' ? 'treinos' : 'dias'} para conquistar este badge e ganhar ${badge.xp_reward} XP!`,
          metadata: { badge_id: badge.id, badge_name: badge.name, remaining, seller_id: seller.id }
        });
        notificationsSent.push(`badge_progress:${seller.id}`);
      }

      // 4. Weekly challenge notification (Monday only)
      const dayOfWeek = new Date().getDay();
      if (dayOfWeek === 1) { // Monday
        await supabase.from('notifications').insert({
          user_id: seller.user_id,
          organization_id: seller.organization_id,
          type: 'weekly_challenge',
          title: '🏆 Desafio da Semana!',
          message: `Nova semana, novos desafios! Complete 5 treinos esta semana e ganhe 75 XP extras.`,
          metadata: { challenge: 'weekly_5', target: 5, seller_id: seller.id }
        });
        notificationsSent.push(`weekly_challenge:${seller.id}`);
      }
    }

    console.log(`[sales-coach-notifications] Sent ${notificationsSent.length} notifications`);

    return new Response(JSON.stringify({
      success: true,
      notificationsSent: notificationsSent.length,
      details: notificationsSent
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('[sales-coach-notifications] Error:', error);
    return new Response(JSON.stringify({ 
      success: false, 
      error: 'Failed to send notifications' 
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});
