import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Classification thresholds
const CLASSIFICATION = {
  HOT: { min: 75, label: 'hot' },
  WARM: { min: 45, label: 'warm' },
  COLD: { min: 0, label: 'cold' },
};

interface PLGConfig {
  activation_weight: number;
  engagement_weight: number;
  adoption_weight: number;
  intent_weight: number;
  scoring_rules: {
    activation: { org_created: number; user_invited: number; first_core_action: number };
    engagement: { max_dau_wau: number; max_active_days: number; max_sessions: number };
    adoption: { core_feature: number; advanced_feature: number; premium_feature: number };
    intent: { pricing_viewed: number; upgrade_clicked: number; contact_requested: number };
  };
  feature_categories: {
    core: string[];
    advanced: string[];
    premium: string[];
  };
}

const DEFAULT_CONFIG: PLGConfig = {
  activation_weight: 25,
  engagement_weight: 30,
  adoption_weight: 25,
  intent_weight: 20,
  scoring_rules: {
    activation: { org_created: 5, user_invited: 10, first_core_action: 10 },
    engagement: { max_dau_wau: 10, max_active_days: 10, max_sessions: 10 },
    adoption: { core_feature: 5, advanced_feature: 8, premium_feature: 12 },
    intent: { pricing_viewed: 5, upgrade_clicked: 8, contact_requested: 7 },
  },
  feature_categories: {
    core: ['opportunities', 'activities', 'contacts', 'proposals', 'accounts'],
    advanced: ['automation', 'scoring', 'reports', 'territories', 'workflows'],
    premium: ['ai_coach', 'roleplay', 'forecast', 'integrations', 'playbooks'],
  },
};

function getClassification(score: number): string {
  if (score >= CLASSIFICATION.HOT.min) return CLASSIFICATION.HOT.label;
  if (score >= CLASSIFICATION.WARM.min) return CLASSIFICATION.WARM.label;
  return CLASSIFICATION.COLD.label;
}

interface PLGEvent {
  event_type: string;
  event_name: string;
  event_category: string | null;
  points: number;
}

function calculateActivationScore(events: PLGEvent[], config: PLGConfig): number {
  const rules = config.scoring_rules.activation;
  let score = 0;

  // Check for org_created event
  if (events.some(e => e.event_name === 'org_created')) {
    score += rules.org_created;
  }

  // Check for user_invited events
  if (events.some(e => e.event_name === 'user_invited')) {
    score += rules.user_invited;
  }

  // Check for first_core_action
  if (events.some(e => e.event_name === 'first_core_action')) {
    score += rules.first_core_action;
  }

  // Cap at weight limit
  return Math.min(score, config.activation_weight);
}

function calculateEngagementScore(events: PLGEvent[], config: PLGConfig, trialDays: number): number {
  const rules = config.scoring_rules.engagement;
  
  // Count unique active days from events
  const activeDays = new Set(events.filter(e => e.event_type === 'engagement').map(e => e.event_name)).size;
  const activeDaysScore = Math.min((activeDays / trialDays) * rules.max_active_days, rules.max_active_days);

  // Count sessions
  const sessions = events.filter(e => e.event_name === 'session_start').length;
  const sessionsScore = Math.min(sessions / 10 * rules.max_sessions, rules.max_sessions);

  // DAU/WAU approximation
  const dauWauScore = Math.min(activeDays / 7 * rules.max_dau_wau, rules.max_dau_wau);

  const score = activeDaysScore + sessionsScore + dauWauScore;
  return Math.min(score, config.engagement_weight);
}

function calculateAdoptionScore(events: PLGEvent[], config: PLGConfig): number {
  const rules = config.scoring_rules.adoption;
  let score = 0;

  // Group by feature category
  const coreFeatures = new Set(events.filter(e => e.event_category === 'core').map(e => e.event_name));
  const advancedFeatures = new Set(events.filter(e => e.event_category === 'advanced').map(e => e.event_name));
  const premiumFeatures = new Set(events.filter(e => e.event_category === 'premium').map(e => e.event_name));

  score += coreFeatures.size * rules.core_feature;
  score += advancedFeatures.size * rules.advanced_feature;
  score += premiumFeatures.size * rules.premium_feature;

  return Math.min(score, config.adoption_weight);
}

function calculateIntentScore(events: PLGEvent[], config: PLGConfig): number {
  const rules = config.scoring_rules.intent;
  let score = 0;

  if (events.some(e => e.event_name === 'pricing_viewed')) {
    score += rules.pricing_viewed;
  }

  if (events.some(e => e.event_name === 'upgrade_clicked')) {
    score += rules.upgrade_clicked;
  }

  if (events.some(e => e.event_name === 'contact_requested')) {
    score += rules.contact_requested;
  }

  return Math.min(score, config.intent_weight);
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const { organization_id, opportunity_id } = await req.json();

    if (!organization_id) {
      throw new Error('organization_id is required');
    }

    console.log(`[PLG-SCORE] Calculating PLG score for org: ${organization_id}`);

    // Fetch config or use defaults
    const { data: configData } = await supabase
      .from('plg_score_config')
      .select('*')
      .eq('organization_id', organization_id)
      .eq('is_active', true)
      .single();

    const config: PLGConfig = configData || DEFAULT_CONFIG;

    // Fetch all PLG events for this organization
    const { data: events, error: eventsError } = await supabase
      .from('plg_events')
      .select('event_type, event_name, event_category, points')
      .eq('organization_id', organization_id);

    if (eventsError) {
      console.error('[PLG-SCORE] Error fetching events:', eventsError);
      throw eventsError;
    }

    const plgEvents: PLGEvent[] = events || [];

    // Get trial start date for engagement calculation
    const { data: orgData } = await supabase
      .from('organizations')
      .select('trial_start_date, trial_end_date')
      .eq('id', organization_id)
      .single();

    const trialStartDate = orgData?.trial_start_date ? new Date(orgData.trial_start_date) : new Date();
    const now = new Date();
    const trialDays = Math.max(1, Math.ceil((now.getTime() - trialStartDate.getTime()) / (1000 * 60 * 60 * 24)));

    // Calculate scores for each category
    const activationScore = calculateActivationScore(plgEvents, config);
    const engagementScore = calculateEngagementScore(plgEvents, config, trialDays);
    const adoptionScore = calculateAdoptionScore(plgEvents, config);
    const intentScore = calculateIntentScore(plgEvents, config);

    // Calculate total score (0-100)
    const totalScore = Math.min(100, Math.round(
      activationScore + engagementScore + adoptionScore + intentScore
    ));

    const classification = getClassification(totalScore);

    console.log(`[PLG-SCORE] Calculated scores - Activation: ${activationScore}, Engagement: ${engagementScore}, Adoption: ${adoptionScore}, Intent: ${intentScore}, Total: ${totalScore}, Classification: ${classification}`);

    // Get previous max and calculate new average
    const { data: prevHistory } = await supabase
      .from('plg_score_history')
      .select('score_current, score_max, score_avg')
      .eq('organization_id', organization_id)
      .order('calculated_at', { ascending: false })
      .limit(10);

    const previousScores = prevHistory?.map(h => h.score_current) || [];
    const newScoreMax = Math.max(totalScore, ...(prevHistory?.map(h => h.score_max) || [0]));
    const allScores = [...previousScores, totalScore];
    const newScoreAvg = allScores.reduce((a, b) => a + b, 0) / allScores.length;

    // Insert history record
    const { error: historyError } = await supabase
      .from('plg_score_history')
      .insert({
        organization_id,
        opportunity_id: opportunity_id || null,
        score_current: totalScore,
        score_max: newScoreMax,
        score_avg: Number(newScoreAvg.toFixed(2)),
        activation_score: Math.round(activationScore),
        engagement_score: Math.round(engagementScore),
        adoption_score: Math.round(adoptionScore),
        intent_score: Math.round(intentScore),
        classification,
      });

    if (historyError) {
      console.error('[PLG-SCORE] Error inserting history:', historyError);
    }

    // Update organization PLG fields
    const { error: orgUpdateError } = await supabase
      .from('organizations')
      .update({
        plg_score: totalScore,
        plg_score_max: newScoreMax,
        plg_score_avg: Number(newScoreAvg.toFixed(2)),
        plg_classification: classification,
        plg_score_updated_at: new Date().toISOString(),
      })
      .eq('id', organization_id);

    if (orgUpdateError) {
      console.error('[PLG-SCORE] Error updating organization:', orgUpdateError);
    }

    // Update opportunity if provided
    if (opportunity_id) {
      const { error: oppUpdateError } = await supabase
        .from('opportunities')
        .update({
          plg_score: totalScore,
          plg_classification: classification,
        })
        .eq('id', opportunity_id);

      if (oppUpdateError) {
        console.error('[PLG-SCORE] Error updating opportunity:', oppUpdateError);
      }
    }

    // Log to audit
    await supabase.from('audit_log').insert({
      action: 'plg_score_calculated',
      entity_type: 'organization',
      entity_id: organization_id,
      metadata: {
        score: totalScore,
        classification,
        breakdown: {
          activation: activationScore,
          engagement: engagementScore,
          adoption: adoptionScore,
          intent: intentScore,
        },
      },
    });

    return new Response(
      JSON.stringify({
        success: true,
        data: {
          organization_id,
          opportunity_id,
          score: totalScore,
          score_max: newScoreMax,
          score_avg: Number(newScoreAvg.toFixed(2)),
          classification,
          breakdown: {
            activation: Math.round(activationScore),
            engagement: Math.round(engagementScore),
            adoption: Math.round(adoptionScore),
            intent: Math.round(intentScore),
          },
        },
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('[PLG-SCORE] Error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ success: false, error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
