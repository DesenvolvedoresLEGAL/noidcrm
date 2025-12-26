import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const ALGORITHM_VERSION = "v2.0";

interface SellerData {
  id: string;
  user_id: string;
  organization_id: string;
  name: string;
}

interface ScoreBreakdown {
  components: Record<string, { value: number; weight: number; contribution: number }>;
  increased_by: string[];
  decreased_by: string[];
  how_to_improve: string[];
}

interface CalculatedScores {
  cs_7d: number;
  cs_30d: number;
  cs_90d: number;
  cs_final: number;
  cs_breakdown: ScoreBreakdown;
  bs_7d: number;
  bs_30d: number;
  bs_90d: number;
  bs_final: number;
  bs_breakdown: ScoreBreakdown;
  ds_7d: number;
  ds_30d: number;
  ds_90d: number;
  ds_final: number;
  ds_breakdown: ScoreBreakdown;
  ras_final: number;
  ras_status: string;
  ras_breakdown: ScoreBreakdown;
}

// Helper function to cap values
const cap = (value: number, min: number, max: number): number => 
  Math.max(min, Math.min(max, value));

// Helper to calculate score for a period
const calculatePeriodScore = (baseScore: number, periodDays: number, totalDays: number): number => {
  // Weight recent activity more heavily
  const recencyWeight = Math.min(1, periodDays / totalDays);
  return cap(baseScore * recencyWeight, 0, 100);
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const { seller_id, organization_id, recalculate_all } = await req.json();

    console.log("[performance-engine] Starting calculation", { seller_id, organization_id, recalculate_all });

    let sellers: SellerData[] = [];

    if (recalculate_all && organization_id) {
      // Recalculate for all sellers in org
      const { data, error } = await supabase
        .from("sellers")
        .select("id, user_id, organization_id, name")
        .eq("organization_id", organization_id)
        .eq("active", true);

      if (error) throw error;
      sellers = data || [];
    } else if (seller_id) {
      // Single seller calculation
      const { data, error } = await supabase
        .from("sellers")
        .select("id, user_id, organization_id, name")
        .eq("id", seller_id)
        .single();

      if (error) throw error;
      sellers = data ? [data] : [];
    } else {
      throw new Error("Either seller_id or organization_id with recalculate_all is required");
    }

    console.log(`[performance-engine] Processing ${sellers.length} sellers`);

    const results = [];

    for (const seller of sellers) {
      try {
        const scores = await calculateSellerScores(supabase, seller);
        await saveScores(supabase, seller, scores);
        results.push({ seller_id: seller.id, success: true, scores });
        console.log(`[performance-engine] Calculated scores for seller ${seller.id}`, scores);
      } catch (err: unknown) {
        const errorMessage = err instanceof Error ? err.message : String(err);
        console.error(`[performance-engine] Error calculating scores for seller ${seller.id}:`, err);
        results.push({ seller_id: seller.id, success: false, error: errorMessage });
      }
    }

    return new Response(
      JSON.stringify({ success: true, results }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error("[performance-engine] Error:", error);
    return new Response(
      JSON.stringify({ success: false, error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

async function calculateSellerScores(supabase: any, seller: SellerData): Promise<CalculatedScores> {
  const now = new Date();
  const days7Ago = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  const days30Ago = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
  const days90Ago = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);

  // Fetch all required data in parallel
  const [
    roleplayData,
    activityData,
    opportunityData,
    activityLogsData,
    monthlyGoal,
    oteMinimums
  ] = await Promise.all([
    fetchRoleplayData(supabase, seller.id, days90Ago),
    fetchActivityData(supabase, seller.user_id, seller.organization_id, days90Ago),
    fetchOpportunityData(supabase, seller.user_id, seller.organization_id, days90Ago),
    fetchActivityLogs(supabase, seller.user_id, seller.organization_id, days90Ago),
    fetchMonthlyGoal(supabase, seller.user_id),
    fetchOTEMinimums(supabase, seller.id, seller.organization_id)
  ]);

  // Calculate each score
  const csResult = calculateCapabilityScore(roleplayData, days7Ago, days30Ago, days90Ago);
  const bsResult = calculateBehaviorScore(activityData, activityLogsData, days7Ago, days30Ago, days90Ago);
  const dsResult = calculateDeliveryScore(opportunityData, monthlyGoal, days7Ago, days30Ago, days90Ago);
  const rasResult = calculateRoleAlignmentScore(csResult.final, bsResult.final, dsResult.final, oteMinimums);

  return {
    cs_7d: csResult.d7,
    cs_30d: csResult.d30,
    cs_90d: csResult.d90,
    cs_final: csResult.final,
    cs_breakdown: csResult.breakdown,
    bs_7d: bsResult.d7,
    bs_30d: bsResult.d30,
    bs_90d: bsResult.d90,
    bs_final: bsResult.final,
    bs_breakdown: bsResult.breakdown,
    ds_7d: dsResult.d7,
    ds_30d: dsResult.d30,
    ds_90d: dsResult.d90,
    ds_final: dsResult.final,
    ds_breakdown: dsResult.breakdown,
    ras_final: rasResult.final,
    ras_status: rasResult.status,
    ras_breakdown: rasResult.breakdown
  };
}

// ========== DATA FETCHING FUNCTIONS ==========

async function fetchRoleplayData(supabase: any, sellerId: string, since: Date) {
  const { data } = await supabase
    .from("roleplay_sessions")
    .select("id, overall_score, status, completed_at, archetype_id, client_archetypes(complexity_score)")
    .eq("seller_id", sellerId)
    .gte("created_at", since.toISOString());
  
  return data || [];
}

async function fetchActivityData(supabase: any, userId: string, orgId: string, since: Date) {
  const { data } = await supabase
    .from("activities")
    .select("id, type, status, scheduled_date, completed_at, created_at")
    .eq("owner_user_id", userId)
    .eq("organization_id", orgId)
    .gte("created_at", since.toISOString());
  
  return data || [];
}

async function fetchOpportunityData(supabase: any, userId: string, orgId: string, since: Date) {
  const { data } = await supabase
    .from("opportunities")
    .select("id, status, valor_previsto, commission_value, created_at, updated_at, expected_close_date")
    .eq("owner_user_id", userId)
    .eq("organization_id", orgId)
    .gte("created_at", since.toISOString());
  
  return data || [];
}

async function fetchActivityLogs(supabase: any, userId: string, orgId: string, since: Date) {
  const { data } = await supabase
    .from("activity_logs")
    .select("id, activity_id, quantity, logged_at, performance_activities(code, weight, scores_impacted)")
    .eq("user_id", userId)
    .eq("organization_id", orgId)
    .gte("logged_at", since.toISOString());
  
  return data || [];
}

async function fetchMonthlyGoal(supabase: any, userId: string) {
  const { data } = await supabase
    .from("profiles")
    .select("monthly_goal")
    .eq("user_id", userId)
    .single();
  
  return data?.monthly_goal || 0;
}

async function fetchOTEMinimums(supabase: any, sellerId: string, orgId: string) {
  // First get seller's OTE level
  const { data: sellerOte } = await supabase
    .from("seller_ote")
    .select("ote_level_id")
    .eq("seller_id", sellerId)
    .order("effective_from", { ascending: false })
    .limit(1)
    .single();

  if (!sellerOte?.ote_level_id) {
    return { min_cs: 60, min_bs: 60, min_ds: 50 };
  }

  const { data: minimums } = await supabase
    .from("ote_score_minimums")
    .select("min_cs, min_bs, min_ds")
    .eq("ote_level_id", sellerOte.ote_level_id)
    .single();

  return minimums || { min_cs: 60, min_bs: 60, min_ds: 50 };
}

// ========== CAPABILITY SCORE CALCULATION ==========

function calculateCapabilityScore(roleplayData: any[], days7Ago: Date, days30Ago: Date, days90Ago: Date) {
  const breakdown: ScoreBreakdown = {
    components: {},
    increased_by: [],
    decreased_by: [],
    how_to_improve: []
  };

  if (roleplayData.length === 0) {
    breakdown.how_to_improve.push("Complete your first roleplay session to start building your Capability Score");
    return { d7: 0, d30: 0, d90: 0, final: 0, breakdown };
  }

  // Calculate components
  const completedSessions = roleplayData.filter(s => s.status === "completed");
  const scores = completedSessions.map(s => s.overall_score || 0).filter(s => s > 0);
  
  // Roleplay average score (40%)
  const roleplayAvgScore = scores.length > 0 
    ? scores.reduce((a, b) => a + b, 0) / scores.length 
    : 0;
  const roleplayNormalized = (roleplayAvgScore / 10) * 100; // Assuming 0-10 scale

  // Pass rate (30%)
  const passThreshold = 7;
  const passed = scores.filter(s => s >= passThreshold).length;
  const passRate = scores.length > 0 ? (passed / scores.length) * 100 : 0;

  // Evolution rate (20%) - improvement over last 30 days
  const recentSessions = roleplayData.filter(s => new Date(s.completed_at) >= days30Ago);
  const olderSessions = roleplayData.filter(s => new Date(s.completed_at) < days30Ago);
  const recentAvg = recentSessions.length > 0 
    ? recentSessions.reduce((a, s) => a + (s.overall_score || 0), 0) / recentSessions.length 
    : 0;
  const olderAvg = olderSessions.length > 0 
    ? olderSessions.reduce((a, s) => a + (s.overall_score || 0), 0) / olderSessions.length 
    : recentAvg;
  const evolutionRate = olderAvg > 0 
    ? cap(((recentAvg - olderAvg) / olderAvg) * 100 + 50, 0, 100) 
    : 50;

  // Difficulty bonus (10%) - from archetype complexity
  const avgComplexity = completedSessions.reduce((a, s) => 
    a + (s.client_archetypes?.complexity_score || 1), 0) / Math.max(completedSessions.length, 1);
  const difficultyBonus = cap(avgComplexity * 20, 0, 100);

  // Calculate weighted score
  const csScore = (roleplayNormalized * 0.4) + (passRate * 0.3) + (evolutionRate * 0.2) + (difficultyBonus * 0.1);

  breakdown.components = {
    roleplay_avg_score: { value: roleplayNormalized, weight: 0.4, contribution: roleplayNormalized * 0.4 },
    pass_rate: { value: passRate, weight: 0.3, contribution: passRate * 0.3 },
    evolution_rate: { value: evolutionRate, weight: 0.2, contribution: evolutionRate * 0.2 },
    difficulty_bonus: { value: difficultyBonus, weight: 0.1, contribution: difficultyBonus * 0.1 }
  };

  // Insights
  if (roleplayNormalized >= 80) breakdown.increased_by.push("Strong roleplay performance (+32 pts)");
  if (passRate >= 80) breakdown.increased_by.push("High approval rate (+24 pts)");
  if (evolutionRate >= 60) breakdown.increased_by.push("Consistent improvement over time (+12 pts)");
  
  if (roleplayNormalized < 50) breakdown.decreased_by.push("Low roleplay scores (-20 pts)");
  if (passRate < 50) breakdown.decreased_by.push("Low approval rate (-15 pts)");
  
  if (roleplayNormalized < 70) breakdown.how_to_improve.push("Practice with easier archetypes to improve your base score");
  if (passRate < 70) breakdown.how_to_improve.push("Focus on completing sessions with higher scores (7+)");
  if (completedSessions.length < 5) breakdown.how_to_improve.push("Complete more roleplay sessions this week");

  // Calculate period-specific scores
  const d7Score = calculatePeriodCS(roleplayData, days7Ago, csScore);
  const d30Score = calculatePeriodCS(roleplayData, days30Ago, csScore);
  const d90Score = csScore;

  return {
    d7: cap(d7Score, 0, 100),
    d30: cap(d30Score, 0, 100),
    d90: cap(d90Score, 0, 100),
    final: cap(csScore, 0, 100),
    breakdown
  };
}

function calculatePeriodCS(roleplayData: any[], since: Date, baseScore: number): number {
  const periodData = roleplayData.filter(s => new Date(s.completed_at || s.created_at) >= since);
  if (periodData.length === 0) return baseScore * 0.8; // Decay if no recent activity
  
  const scores = periodData.filter(s => s.status === "completed").map(s => s.overall_score || 0);
  if (scores.length === 0) return baseScore * 0.9;
  
  const avg = scores.reduce((a, b) => a + b, 0) / scores.length;
  return (avg / 10) * 100;
}

// ========== BEHAVIOR SCORE CALCULATION ==========

function calculateBehaviorScore(activityData: any[], activityLogs: any[], days7Ago: Date, days30Ago: Date, days90Ago: Date) {
  const breakdown: ScoreBreakdown = {
    components: {},
    increased_by: [],
    decreased_by: [],
    how_to_improve: []
  };

  // Activities vs Target (35%)
  const completedActivities = activityData.filter(a => a.status === "completed");
  const targetActivities = 100; // Monthly target baseline
  const activitiesRatio = cap((completedActivities.length / targetActivities) * 100, 0, 150);
  const activitiesVsTarget = Math.min(activitiesRatio, 100);

  // Streak days (20%)
  const streakDays = calculateStreakDays(activityData);
  const streakScore = cap((streakDays / 21) * 100, 0, 100); // 21 days = 100%

  // SLA Compliance (25%)
  const followUps = activityData.filter(a => a.type === "follow_up" || a.type === "call");
  const slaCompliant = followUps.filter(a => {
    if (!a.scheduled_date || !a.completed_at) return false;
    const scheduled = new Date(a.scheduled_date);
    const completed = new Date(a.completed_at);
    return completed <= scheduled;
  });
  const slaCompliance = followUps.length > 0 ? (slaCompliant.length / followUps.length) * 100 : 50;

  // CRM Health (20%)
  const crmHealth = calculateCRMHealth(activityLogs);

  // Calculate weighted score
  let bsScore = (activitiesVsTarget * 0.35) + (streakScore * 0.20) + (slaCompliance * 0.25) + (crmHealth * 0.20);

  // Apply penalty for activity drop
  const lastWeekActivities = activityData.filter(a => new Date(a.created_at) >= days7Ago);
  const prevWeekStart = new Date(days7Ago.getTime() - 7 * 24 * 60 * 60 * 1000);
  const prevWeekActivities = activityData.filter(a => {
    const date = new Date(a.created_at);
    return date >= prevWeekStart && date < days7Ago;
  });

  if (prevWeekActivities.length > 0) {
    const dropPercent = ((prevWeekActivities.length - lastWeekActivities.length) / prevWeekActivities.length) * 100;
    if (dropPercent > 40) {
      bsScore = Math.max(0, bsScore - 15);
      breakdown.decreased_by.push("Activity dropped >40% vs last week (-15 pts penalty)");
    }
  }

  breakdown.components = {
    activities_vs_target: { value: activitiesVsTarget, weight: 0.35, contribution: activitiesVsTarget * 0.35 },
    streak_days: { value: streakScore, weight: 0.20, contribution: streakScore * 0.20 },
    sla_compliance: { value: slaCompliance, weight: 0.25, contribution: slaCompliance * 0.25 },
    crm_health: { value: crmHealth, weight: 0.20, contribution: crmHealth * 0.20 }
  };

  // Insights
  if (activitiesVsTarget >= 80) breakdown.increased_by.push("Strong activity volume (+28 pts)");
  if (streakDays >= 14) breakdown.increased_by.push(`${streakDays}-day activity streak (+18 pts)`);
  if (slaCompliance >= 80) breakdown.increased_by.push("Excellent SLA compliance (+20 pts)");
  
  if (activitiesVsTarget < 50) breakdown.decreased_by.push("Low activity volume (-17 pts)");
  if (slaCompliance < 50) breakdown.decreased_by.push("Missing follow-up SLAs (-12 pts)");
  
  if (streakDays < 7) breakdown.how_to_improve.push("Build a 7+ day activity streak");
  if (slaCompliance < 70) breakdown.how_to_improve.push("Complete follow-ups within scheduled time");
  if (crmHealth < 70) breakdown.how_to_improve.push("Update your opportunities and log activities regularly");

  // Calculate period-specific scores
  const d7Score = calculatePeriodBS(activityData, activityLogs, days7Ago, bsScore);
  const d30Score = calculatePeriodBS(activityData, activityLogs, days30Ago, bsScore);

  return {
    d7: cap(d7Score, 0, 100),
    d30: cap(d30Score, 0, 100),
    d90: cap(bsScore, 0, 100),
    final: cap(bsScore, 0, 100),
    breakdown
  };
}

function calculateStreakDays(activityData: any[]): number {
  const completed = activityData
    .filter(a => a.status === "completed" && a.completed_at)
    .map(a => new Date(a.completed_at).toDateString());
  
  const uniqueDays = [...new Set(completed)].sort().reverse();
  
  let streak = 0;
  const today = new Date().toDateString();
  let checkDate = new Date();
  
  for (let i = 0; i < 90; i++) {
    const dateStr = checkDate.toDateString();
    if (uniqueDays.includes(dateStr)) {
      streak++;
    } else if (dateStr !== today) {
      break;
    }
    checkDate.setDate(checkDate.getDate() - 1);
  }
  
  return streak;
}

function calculateCRMHealth(activityLogs: any[]): number {
  if (activityLogs.length === 0) return 50;
  
  // Check for pipeline updates, activity logging
  const pipelineUpdates = activityLogs.filter(l => 
    l.performance_activities?.code?.includes("IND-03") || 
    l.performance_activities?.code?.includes("COL-01")
  );
  
  const loggedActivities = activityLogs.filter(l =>
    l.performance_activities?.code?.includes("IND-04")
  );
  
  const updateScore = Math.min((pipelineUpdates.length / 20) * 50, 50);
  const logScore = Math.min((loggedActivities.length / 30) * 50, 50);
  
  return updateScore + logScore;
}

function calculatePeriodBS(activityData: any[], activityLogs: any[], since: Date, baseScore: number): number {
  const periodActivities = activityData.filter(a => new Date(a.created_at) >= since);
  if (periodActivities.length === 0) return baseScore * 0.8;
  
  const completed = periodActivities.filter(a => a.status === "completed");
  const ratio = completed.length / Math.max(periodActivities.length, 1);
  
  return baseScore * (0.5 + ratio * 0.5);
}

// ========== DELIVERY SCORE CALCULATION ==========

function calculateDeliveryScore(opportunityData: any[], monthlyGoal: number, days7Ago: Date, days30Ago: Date, days90Ago: Date) {
  const breakdown: ScoreBreakdown = {
    components: {},
    increased_by: [],
    decreased_by: [],
    how_to_improve: []
  };

  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  
  // Revenue vs Target (40%)
  const wonThisMonth = opportunityData.filter(o => 
    o.status === "won" && new Date(o.updated_at) >= monthStart
  );
  const totalRevenue = wonThisMonth.reduce((sum, o) => 
    sum + (o.commission_value ?? o.valor_previsto ?? 0), 0);
  
  const revenueRatio = monthlyGoal > 0 ? (totalRevenue / monthlyGoal) : 0;
  const revenueVsTarget = cap(revenueRatio * 100, 0, 150);
  const revenueComponent = Math.min(revenueVsTarget, 100);

  // Win Rate (25%)
  const totalOpps = opportunityData.filter(o => o.status === "won" || o.status === "lost");
  const wonOpps = opportunityData.filter(o => o.status === "won");
  const winRate = totalOpps.length > 0 ? (wonOpps.length / totalOpps.length) * 100 : 0;

  // Average Ticket Index (15%)
  const avgTicket = wonOpps.length > 0 
    ? wonOpps.reduce((sum, o) => sum + (o.commission_value ?? o.valor_previsto ?? 0), 0) / wonOpps.length 
    : 0;
  const benchmarkTicket = monthlyGoal / 4; // Assume 4 deals per month is benchmark
  const ticketIndex = benchmarkTicket > 0 ? cap((avgTicket / benchmarkTicket) * 100, 0, 150) : 50;
  const ticketComponent = Math.min(ticketIndex, 100);

  // Pipeline Coverage (20%)
  const openOpps = opportunityData.filter(o => o.status === "open" || o.status === "negotiation");
  const pipelineValue = openOpps.reduce((sum, o) => 
    sum + (o.commission_value ?? o.valor_previsto ?? 0), 0);
  const remainingGoal = Math.max(monthlyGoal - totalRevenue, 0);
  const pipelineCoverage = remainingGoal > 0 
    ? cap((pipelineValue / remainingGoal) * 100, 0, 300) / 3 
    : 100;

  // Calculate weighted score
  const dsScore = (revenueComponent * 0.40) + (winRate * 0.25) + (ticketComponent * 0.15) + (pipelineCoverage * 0.20);

  breakdown.components = {
    revenue_vs_target: { value: revenueComponent, weight: 0.40, contribution: revenueComponent * 0.40 },
    win_rate: { value: winRate, weight: 0.25, contribution: winRate * 0.25 },
    avg_ticket_index: { value: ticketComponent, weight: 0.15, contribution: ticketComponent * 0.15 },
    pipeline_coverage: { value: pipelineCoverage, weight: 0.20, contribution: pipelineCoverage * 0.20 }
  };

  // Insights
  if (revenueVsTarget >= 100) breakdown.increased_by.push("Achieved monthly target (+40 pts)");
  if (winRate >= 40) breakdown.increased_by.push(`Strong ${winRate.toFixed(0)}% win rate (+${(winRate * 0.25).toFixed(0)} pts)`);
  if (pipelineCoverage >= 80) breakdown.increased_by.push("Healthy pipeline coverage (+16 pts)");
  
  if (revenueVsTarget < 50) breakdown.decreased_by.push("Below 50% of monthly target");
  if (winRate < 20) breakdown.decreased_by.push("Low win rate affecting score");
  
  if (revenueVsTarget < 80) breakdown.how_to_improve.push("Focus on closing deals in negotiation stage");
  if (pipelineCoverage < 100) breakdown.how_to_improve.push("Build more pipeline to cover remaining goal");
  if (winRate < 30) breakdown.how_to_improve.push("Review loss reasons and improve qualification");

  // Calculate period-specific scores
  const d7Score = calculatePeriodDS(opportunityData, days7Ago, monthlyGoal);
  const d30Score = calculatePeriodDS(opportunityData, days30Ago, monthlyGoal);

  return {
    d7: cap(d7Score, 0, 100),
    d30: cap(d30Score, 0, 100),
    d90: cap(dsScore, 0, 100),
    final: cap(dsScore, 0, 100),
    breakdown
  };
}

function calculatePeriodDS(opportunityData: any[], since: Date, monthlyGoal: number): number {
  const periodWon = opportunityData.filter(o => 
    o.status === "won" && new Date(o.updated_at) >= since
  );
  
  const totalRevenue = periodWon.reduce((sum, o) => 
    sum + (o.commission_value ?? o.valor_previsto ?? 0), 0);
  
  // Proportional goal for period
  const now = new Date();
  const daysInPeriod = Math.ceil((now.getTime() - since.getTime()) / (1000 * 60 * 60 * 24));
  const proportionalGoal = (monthlyGoal / 30) * daysInPeriod;
  
  if (proportionalGoal <= 0) return 50;
  
  const ratio = totalRevenue / proportionalGoal;
  return cap(ratio * 100, 0, 100);
}

// ========== ROLE ALIGNMENT SCORE CALCULATION ==========

function calculateRoleAlignmentScore(csFinal: number, bsFinal: number, dsFinal: number, minimums: any) {
  const breakdown: ScoreBreakdown = {
    components: {},
    increased_by: [],
    decreased_by: [],
    how_to_improve: []
  };

  const { min_cs, min_bs, min_ds } = minimums;

  // Calculate ratios to minimum
  const csRatio = min_cs > 0 ? (csFinal / min_cs) * 100 : 100;
  const bsRatio = min_bs > 0 ? (bsFinal / min_bs) * 100 : 100;
  const dsRatio = min_ds > 0 ? (dsFinal / min_ds) * 100 : 100;

  const aboveCS = csFinal >= min_cs;
  const aboveBS = bsFinal >= min_bs;
  const aboveDS = dsFinal >= min_ds;

  const exceeds115CS = csRatio >= 115;
  const exceeds115BS = bsRatio >= 115;
  const exceeds115DS = dsRatio >= 115;

  let status: string;
  let rasScore: number;

  if (exceeds115CS && exceeds115BS && exceeds115DS) {
    status = "under_allocated";
    rasScore = 115;
    breakdown.increased_by.push("All scores exceed role expectations by 15%+");
    breakdown.increased_by.push("Ready for promotion consideration");
  } else if (aboveCS && aboveBS && aboveDS) {
    status = "aligned";
    rasScore = 100;
    breakdown.increased_by.push("Meeting all role expectations");
  } else if (!aboveCS && !aboveBS && !aboveDS) {
    status = "out_of_position";
    rasScore = 40;
    breakdown.decreased_by.push("All scores below role minimums");
    breakdown.decreased_by.push("Current role may not be the best fit");
    breakdown.how_to_improve.push("Consider role adjustment or intensive coaching");
  } else {
    status = "misaligned";
    const aboveCount = [aboveCS, aboveBS, aboveDS].filter(Boolean).length;
    rasScore = 50 + (aboveCount * 15);
    
    if (!aboveCS) {
      breakdown.decreased_by.push(`CS (${csFinal.toFixed(0)}) below minimum (${min_cs})`);
      breakdown.how_to_improve.push("Focus on roleplay training to improve CS");
    }
    if (!aboveBS) {
      breakdown.decreased_by.push(`BS (${bsFinal.toFixed(0)}) below minimum (${min_bs})`);
      breakdown.how_to_improve.push("Increase daily activity consistency");
    }
    if (!aboveDS) {
      breakdown.decreased_by.push(`DS (${dsFinal.toFixed(0)}) below minimum (${min_ds})`);
      breakdown.how_to_improve.push("Focus on closing deals and building pipeline");
    }
  }

  breakdown.components = {
    cs_ratio: { value: csRatio, weight: 0.33, contribution: csRatio * 0.33 },
    bs_ratio: { value: bsRatio, weight: 0.33, contribution: bsRatio * 0.33 },
    ds_ratio: { value: dsRatio, weight: 0.34, contribution: dsRatio * 0.34 }
  };

  return {
    final: cap(rasScore, 0, 120),
    status,
    breakdown
  };
}

// ========== SAVE SCORES ==========

async function saveScores(supabase: any, seller: SellerData, scores: CalculatedScores) {
  // Get existing scores for history tracking
  const { data: existing } = await supabase
    .from("seller_performance_scores")
    .select("*")
    .eq("seller_id", seller.id)
    .single();

  // Upsert new scores
  const { error: upsertError } = await supabase
    .from("seller_performance_scores")
    .upsert({
      seller_id: seller.id,
      organization_id: seller.organization_id,
      ...scores,
      algorithm_version: ALGORITHM_VERSION,
      calculation_inputs: {
        calculated_at: new Date().toISOString(),
        seller_name: seller.name
      },
      calculated_at: new Date().toISOString()
    }, { onConflict: "seller_id" });

  if (upsertError) throw upsertError;

  // Record history for significant changes
  if (existing) {
    const historyRecords = [];
    const scoreTypes = [
      { type: "CS", old: existing.cs_final, new: scores.cs_final },
      { type: "BS", old: existing.bs_final, new: scores.bs_final },
      { type: "DS", old: existing.ds_final, new: scores.ds_final },
      { type: "RAS", old: existing.ras_final, new: scores.ras_final }
    ];

    for (const st of scoreTypes) {
      if (Math.abs(st.new - st.old) >= 5) { // Only record if change >= 5 points
        historyRecords.push({
          seller_id: seller.id,
          organization_id: seller.organization_id,
          score_type: st.type,
          period_type: "final",
          old_value: st.old,
          new_value: st.new,
          change_reason: st.new > st.old ? "Score improved" : "Score decreased",
          breakdown: scores[`${st.type.toLowerCase()}_breakdown` as keyof CalculatedScores],
          algorithm_version: ALGORITHM_VERSION
        });
      }
    }

    if (historyRecords.length > 0) {
      await supabase.from("seller_score_history").insert(historyRecords);
    }
  }
}
