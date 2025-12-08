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
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      throw new Error('Missing authorization header');
    }

    const { data: { user }, error: authError } = await supabase.auth.getUser(
      authHeader.replace('Bearer ', '')
    );
    if (authError || !user) {
      throw new Error('Unauthorized');
    }

    const { periodMonth, userId } = await req.json();
    
    if (!periodMonth) {
      throw new Error('periodMonth is required (format: YYYY-MM)');
    }

    console.log(`Calculating OTE for period: ${periodMonth}, userId: ${userId || 'all'}`);

    // Get user's organization
    const { data: membership } = await supabase
      .from('organization_members')
      .select('organization_id')
      .eq('user_id', user.id)
      .eq('status', 'active')
      .single();

    if (!membership) {
      throw new Error('User not in organization');
    }

    const organizationId = membership.organization_id;

    // Get OTE levels
    const { data: levels } = await supabase
      .from('ote_levels')
      .select('*')
      .eq('organization_id', organizationId)
      .eq('is_active', true);

    // Get multipliers
    const { data: multipliers } = await supabase
      .from('ote_multipliers')
      .select('*')
      .eq('organization_id', organizationId)
      .order('min_percentage');

    // Get seller configs
    let configQuery = supabase
      .from('ote_seller_config')
      .select('*, ote_level:ote_levels(*)')
      .eq('organization_id', organizationId)
      .is('end_date', null);

    if (userId) {
      configQuery = configQuery.eq('user_id', userId);
    }

    const { data: sellerConfigs } = await configQuery;

    if (!sellerConfigs || sellerConfigs.length === 0) {
      console.log('No seller configs found');
      return new Response(JSON.stringify({ 
        success: true, 
        message: 'No sellers configured for OTE',
        results: [] 
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Get rules for accelerators/decelerators
    const { data: rules } = await supabase
      .from('ote_rules')
      .select('*')
      .eq('organization_id', organizationId)
      .eq('is_active', true)
      .order('priority');

    // Parse period
    const [year, month] = periodMonth.split('-').map(Number);
    const startDate = new Date(year, month - 1, 1).toISOString();
    const endDate = new Date(year, month, 0, 23, 59, 59).toISOString();

    const results = [];

    for (const config of sellerConfigs) {
      console.log(`Processing seller: ${config.user_id}`);

      // Get won opportunities for this seller in the period
      const { data: opportunities } = await supabase
        .from('opportunities')
        .select('id, valor_previsto, title, account:accounts(razao_social, nome_fantasia)')
        .eq('organization_id', organizationId)
        .eq('owner_user_id', config.user_id)
        .eq('status', 'won')
        .gte('updated_at', startDate)
        .lte('updated_at', endDate);

      const totalSales = opportunities?.reduce((sum, opp) => sum + (opp.valor_previsto || 0), 0) || 0;

      // Get goal from config or level
      const goalAmount = config.custom_goal_override || config.ote_level?.monthly_goal || 0;
      const variableTarget = config.custom_variable_override || config.ote_level?.variable_target || 0;

      // Calculate achievement percentage
      const achievementPercentage = goalAmount > 0 ? (totalSales / goalAmount) * 100 : 0;

      // Find applicable multiplier
      let oteMultiplier = 0;
      if (multipliers) {
        for (const mult of multipliers) {
          if (achievementPercentage >= mult.min_percentage && achievementPercentage <= mult.max_percentage) {
            oteMultiplier = mult.multiplier;
            break;
          }
        }
      }

      // Calculate base variable
      const baseVariable = variableTarget * oteMultiplier;

      // Determine flag color
      let flagColor: 'blue' | 'yellow' | 'red' | null = null;
      let flagReason = '';
      if (achievementPercentage >= 100) {
        flagColor = 'blue';
        flagReason = 'Meta atingida ou superada';
      } else if (achievementPercentage >= 70) {
        flagColor = 'yellow';
        flagReason = 'Entre 70% e 99% da meta';
      } else if (achievementPercentage < 70) {
        flagColor = 'red';
        flagReason = 'Abaixo de 70% da meta';
      }

      // Get roleplay data
      const { data: roleplaySessions } = await supabase
        .from('roleplay_sessions')
        .select('score_overall, passed')
        .eq('seller_id', config.user_id)
        .gte('started_at', startDate)
        .lte('started_at', endDate)
        .eq('status', 'completed');

      let roleplayScore = null;
      let roleplayAccelerator = 0;
      if (roleplaySessions && roleplaySessions.length > 0) {
        const avgScore = roleplaySessions.reduce((sum, s) => sum + (s.score_overall || 0), 0) / roleplaySessions.length;
        roleplayScore = avgScore;
        
        // Apply roleplay rules
        if (rules) {
          for (const rule of rules.filter(r => r.condition_field === 'roleplay_score')) {
            if (evaluateCondition(avgScore, rule)) {
              if (rule.rule_type === 'accelerator') {
                roleplayAccelerator += rule.effect_value || 0;
              } else if (rule.rule_type === 'decelerator') {
                roleplayAccelerator -= rule.effect_value || 0;
              }
            }
          }
        }
      }

      // Get CRM completion score (activities created)
      const { data: activities } = await supabase
        .from('activities')
        .select('id')
        .eq('organization_id', organizationId)
        .eq('owner_user_id', config.user_id)
        .gte('created_at', startDate)
        .lte('created_at', endDate);

      const activityCount = activities?.length || 0;
      let crmAccelerator = 0;
      // Simple CRM score: 10 activities = 100%
      const crmScore = Math.min((activityCount / 10) * 100, 100);
      
      if (rules) {
        for (const rule of rules.filter(r => r.condition_field === 'crm_completion')) {
          if (evaluateCondition(crmScore, rule)) {
            if (rule.rule_type === 'accelerator') {
              crmAccelerator += rule.effect_value || 0;
            } else if (rule.rule_type === 'decelerator') {
              crmAccelerator -= rule.effect_value || 0;
            }
          }
        }
      }

      // Get FitScore average
      const { data: accountScores } = await supabase
        .from('accounts')
        .select('fit_score')
        .eq('organization_id', organizationId)
        .eq('owner_user_id', config.user_id)
        .not('fit_score', 'is', null);

      let fitscoreAvg = null;
      let fitscoreAccelerator = 0;
      if (accountScores && accountScores.length > 0) {
        fitscoreAvg = accountScores.reduce((sum, a) => sum + (a.fit_score || 0), 0) / accountScores.length;
        
        if (rules) {
          for (const rule of rules.filter(r => r.condition_field === 'fitscore')) {
            if (evaluateCondition(fitscoreAvg, rule)) {
              if (rule.rule_type === 'accelerator') {
                fitscoreAccelerator += rule.effect_value || 0;
              } else if (rule.rule_type === 'decelerator') {
                fitscoreAccelerator -= rule.effect_value || 0;
              }
            }
          }
        }
      }

      // Calculate totals
      const totalAccelerator = roleplayAccelerator + crmAccelerator + fitscoreAccelerator;
      const totalDecelerator = Math.abs(Math.min(0, totalAccelerator));
      const finalAdjustment = totalAccelerator;
      const finalVariable = baseVariable * (1 + finalAdjustment / 100);

      // Upsert result
      const resultData = {
        organization_id: organizationId,
        user_id: config.user_id,
        period_month: periodMonth,
        ote_level_id: config.ote_level_id,
        level_name_snapshot: config.ote_level?.level_name,
        total_sales: totalSales,
        goal_amount: goalAmount,
        achievement_percentage: Math.round(achievementPercentage * 100) / 100,
        ote_multiplier: oteMultiplier,
        base_variable: baseVariable,
        flag_color: flagColor,
        flag_reason: flagReason,
        roleplay_score: roleplayScore,
        roleplay_accelerator: roleplayAccelerator,
        crm_completion_score: crmScore,
        crm_accelerator: crmAccelerator,
        fitscore_avg: fitscoreAvg,
        fitscore_accelerator: fitscoreAccelerator,
        total_accelerator_percentage: Math.max(0, totalAccelerator),
        total_decelerator_percentage: totalDecelerator,
        final_adjustment_percentage: finalAdjustment,
        final_variable_amount: Math.round(finalVariable * 100) / 100,
        calculated_at: new Date().toISOString(),
        calculated_by: user.id,
        status: 'pending',
      };

      const { data: upsertedResult, error: upsertError } = await supabase
        .from('ote_monthly_results')
        .upsert(resultData, {
          onConflict: 'organization_id,user_id,period_month',
        })
        .select()
        .single();

      if (upsertError) {
        console.error('Error upserting result:', upsertError);
        continue;
      }

      // Create sales records
      if (opportunities && opportunities.length > 0 && upsertedResult) {
        // Delete existing sales records for this result
        await supabase
          .from('ote_sales_records')
          .delete()
          .eq('ote_result_id', upsertedResult.id);

        // Insert new sales records
        const salesRecords = opportunities.map(opp => {
          const acc = opp.account as any;
          return {
            organization_id: organizationId,
            ote_result_id: upsertedResult.id,
            opportunity_id: opp.id,
            client_name: acc?.nome_fantasia || acc?.razao_social || opp.title,
            sale_value: opp.valor_previsto || 0,
            sale_date: new Date().toISOString().split('T')[0],
            payment_status: 'pending',
          };
        });

        await supabase.from('ote_sales_records').insert(salesRecords);
      }

      results.push(upsertedResult);
    }

    console.log(`OTE calculation completed. Processed ${results.length} sellers.`);

    return new Response(JSON.stringify({ 
      success: true, 
      message: `OTE calculated for ${results.length} sellers`,
      results 
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error: any) {
    console.error('Error in calculate-ote:', error);
    return new Response(JSON.stringify({ 
      success: false, 
      error: error?.message || 'Unknown error' 
    }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});

function evaluateCondition(value: number, rule: any): boolean {
  switch (rule.condition_operator) {
    case '>=':
      return value >= (rule.condition_value || 0);
    case '<=':
      return value <= (rule.condition_value || 0);
    case '>':
      return value > (rule.condition_value || 0);
    case '<':
      return value < (rule.condition_value || 0);
    case '=':
      return value === rule.condition_value;
    case 'between':
      return value >= (rule.condition_value || 0) && value <= (rule.condition_value_max || 100);
    default:
      return false;
  }
}
