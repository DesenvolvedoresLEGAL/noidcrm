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

    const { periodMonth: rawPeriodMonth, userId } = await req.json();
    const periodMonth = typeof rawPeriodMonth === 'string' ? rawPeriodMonth.slice(0, 7) : '';
    
    if (!/^\d{4}-\d{2}$/.test(periodMonth)) {
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

    // Get OTE levels (including is_team_target)
    const { data: levels } = await supabase
      .from('ote_levels')
      .select('*, is_team_target')
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
      .select('*, ote_level:ote_levels(*, is_team_target)')
      .eq('organization_id', organizationId)
      .is('end_date', null);

    if (userId) {
      configQuery = configQuery.eq('user_id', userId);
    }

    const { data: rawSellerConfigs } = await configQuery;

    // Histórico imutável: não filtrar somente membros ativos. Usuários inativos/excluídos
    // com configuração OTE vigente no período precisam continuar no cálculo histórico.
    const sellerConfigs = rawSellerConfigs || [];

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

    // Get performance gates for commission and acceleration
    const { data: performanceGates } = await supabase
      .from('performance_gates')
      .select('*')
      .eq('organization_id', organizationId)
      .eq('is_active', true)
      .in('gate_type', ['commission', 'acceleration'])
      .order('priority', { ascending: false });

    console.log(`Loaded ${performanceGates?.length || 0} performance gates`);

    // Get sales config for flag thresholds AND monthly_revenue_target (for team manager goal)
    const { data: salesConfig } = await supabase
      .from('sales_config')
      .select('flag_blue_threshold, flag_yellow_min_threshold, flag_yellow_max_threshold, monthly_revenue_target')
      .eq('organization_id', organizationId)
      .maybeSingle();

    // Flag thresholds with defaults
    const flagBlueThreshold = salesConfig?.flag_blue_threshold ?? 100;
    const flagYellowMinThreshold = salesConfig?.flag_yellow_min_threshold ?? 70;
    const flagYellowMaxThreshold = salesConfig?.flag_yellow_max_threshold ?? 99.99;

    console.log(`Flag thresholds: Blue >= ${flagBlueThreshold}%, Yellow ${flagYellowMinThreshold}-${flagYellowMaxThreshold}%, Red < ${flagYellowMinThreshold}%`);
    
    // Get teams with managers for team-based calculations
    const { data: teams } = await supabase
      .from('teams')
      .select('id, name, manager_id')
      .eq('organization_id', organizationId);

    // Get team members
    const { data: teamMembers } = await supabase
      .from('team_members')
      .select('team_id, user_id')
      .eq('organization_id', organizationId);

    // Parse period
    const [year, month] = periodMonth.split('-').map(Number);
    const startDate = new Date(year, month - 1, 1).toISOString();
    const endDate = new Date(year, month, 0, 23, 59, 59).toISOString();

    // Reprocessamento limpo do período: remove detalhes antigos antes de recalcular,
    // evitando mistura/duplicação de regras antigas com a regra atual.
    let oldResultsQuery = supabase
      .from('ote_monthly_results')
      .select('id')
      .eq('organization_id', organizationId)
      .eq('period_month', periodMonth);
    if (userId) oldResultsQuery = oldResultsQuery.eq('user_id', userId);
    const { data: oldResults } = await oldResultsQuery;
    const oldResultIds = (oldResults || []).map((r: any) => r.id);
    if (oldResultIds.length > 0) {
      await supabase
        .from('ote_sales_records')
        .delete()
        .in('ote_result_id', oldResultIds);
    }

    const results = [];

    // Get all pipelines for the organization (needed for goal_type filtering)
    const { data: allPipelines } = await supabase
      .from('pipelines')
      .select('id, name, pipeline_type')
      .eq('organization_id', organizationId);

    const pipelineMap = new Map<string, { name: string; pipeline_type: string }>(
      (allPipelines || []).map((p: any) => [p.id, { name: p.name, pipeline_type: p.pipeline_type }])
    );
    const qualificationPipelineIds = (allPipelines || [])
      .filter((p: any) => p.pipeline_type === 'qualification')
      .map((p: any) => p.id);
    const salesPipelineIds = (allPipelines || [])
      .filter((p: any) => p.pipeline_type === 'sales')
      .map((p: any) => p.id);

    console.log(`Pipelines - qualification: ${qualificationPipelineIds.length}, sales: ${salesPipelineIds.length}`);

    for (const config of sellerConfigs) {
      console.log(`Processing seller: ${config.user_id}`);

      const isTeamTarget = config.ote_level?.is_team_target || false;
      // Determine goal_type early so we can filter opportunities correctly
      const goalType = config.ote_level?.goal_type || 'revenue';
      const relevantPipelineIds = goalType === 'leads' ? qualificationPipelineIds : salesPipelineIds;

      let opportunities: any[] = [];
      let teamMemberIds: string[] = [];
      let dynamicTeamGoal = 0;

      if (isTeamTarget) {
        // For team-based targets, get the team managed by this user
        const managedTeam = teams?.find(t => t.manager_id === config.user_id);
        
        if (managedTeam) {
          // Get all members of this team
          teamMemberIds = teamMembers
            ?.filter(tm => tm.team_id === managedTeam.id)
            .map(tm => tm.user_id) || [];
          
          console.log(`Team target for ${config.user_id}. Team: ${managedTeam.name}, Members: ${teamMemberIds.length}`);
          
          if (teamMemberIds.length > 0) {
            // Calculate dynamic goal as SUM of team members' goals
            const memberConfigs = sellerConfigs.filter(sc => 
              teamMemberIds.includes(sc.user_id) && !sc.ote_level?.is_team_target
            );
            
            for (const memberConfig of memberConfigs) {
              const memberGoal = memberConfig.custom_goal_override || memberConfig.ote_level?.monthly_goal || 0;
              dynamicTeamGoal += memberGoal;
            }
            
            console.log(`Dynamic team goal calculated: ${dynamicTeamGoal} from ${memberConfigs.length} members`);

            // Get won opportunities for ALL team members, filtered by relevant pipeline type
            let teamQuery = supabase
              .from('opportunities')
              .select('id, valor_previsto, commission_value, title, owner_user_id, closed_at, updated_at, pipeline_id, account:accounts(razao_social, nome_fantasia)')
              .eq('organization_id', organizationId)
              .in('owner_user_id', teamMemberIds)
              .eq('status', 'won');

            if (relevantPipelineIds.length > 0) {
              teamQuery = teamQuery.in('pipeline_id', relevantPipelineIds);
            }

            const { data: teamOpportunities } = await teamQuery;
            
            // Post-filter by closed_at (primary) or updated_at (fallback) within period
            opportunities = (teamOpportunities || []).filter(opp => {
              const closeDate = new Date((opp as any).closed_at || opp.updated_at);
              return closeDate >= new Date(startDate) && closeDate <= new Date(endDate);
            });
          }
        } else {
          console.log(`No team found for manager ${config.user_id}`);
        }
      } else {
        if (goalType === 'leads') {
          const { data: qualRows } = await supabase
            .from('opportunity_qualification_history')
            .select('opportunity_id, qualification_at')
            .eq('organization_id', organizationId)
            .eq('qualified_by_user_id', config.user_id)
            .gte('qualification_at', startDate)
            .lte('qualification_at', endDate);
          const oppIds = Array.from(new Set((qualRows || []).map((r: any) => r.opportunity_id).filter(Boolean)));
          if (oppIds.length > 0) {
            const { data: qualOpps } = await supabase
              .from('opportunities')
              .select('id, valor_previsto, commission_value, title, closed_at, updated_at, pipeline_id, account:accounts(razao_social, nome_fantasia)')
              .eq('organization_id', organizationId)
              .in('id', oppIds);
            const qualAtMap = new Map((qualRows || []).map((r: any) => [r.opportunity_id, r.qualification_at]));
            opportunities = (qualOpps || []).map((opp: any) => ({
              ...opp,
              closed_at: qualAtMap.get(opp.id) || opp.closed_at || opp.updated_at,
            }));
          }
        } else {
        let histQuery = supabase
            .from('commercial_won_revenue_historical_view')
            .select('opportunity_id, account_name, nome_fantasia, seller_id, won_at, approved_at, accepted_at, cancelled_at, pipeline_id')
            .eq('organization_id', organizationId)
            .eq('seller_id', config.user_id)
            .or(`and(approved_at.gte.${startDate},approved_at.lte.${endDate}),and(approved_at.is.null,accepted_at.gte.${startDate},accepted_at.lte.${endDate}),and(is_cancelled_sale.eq.true,cancelled_at.gte.${startDate},cancelled_at.lte.${endDate})`);
          if (relevantPipelineIds.length > 0) histQuery = histQuery.in('pipeline_id', relevantPipelineIds);
          const { data: histRows } = await histQuery;
          opportunities = (histRows || []).map((row: any) => ({
            id: row.opportunity_id,
            title: row.nome_fantasia || row.account_name || 'Venda realizada',
            owner_user_id: row.seller_id,
            closed_at: row.approved_at || row.accepted_at || row.cancelled_at || row.won_at,
            updated_at: row.approved_at || row.accepted_at || row.cancelled_at || row.won_at,
            pipeline_id: row.pipeline_id,
            account: { razao_social: row.account_name, nome_fantasia: row.nome_fantasia },
          }));
        }
      }

      // === SSoT enrichment (revenue only) ===
      // REGRA OFICIAL (correção emergencial — restaura regra de produto e exclui
      // propostas reabertas/perdidas):
      //  1. Receita SSoT = commercial_won_revenue_view.commercial_amount.
      //  2. Venda inteira é excluída da meta quando:
      //       fulfillment_status in ('removed','cancelled')
      //       OU commercial_status = 'lost'  (proposta aceita e depois reaberta/perdida).
      //  3. Caso a venda não esteja excluída, calculamos a elegibilidade ITEM A ITEM:
      //       item_eligivel = item.counts_for_commission !== false
      //                        E produto.counts_for_commission !== false.
      //       eligible_amount = soma dos itens elegíveis (rateando sobre o total comercial).
      //       non_eligible_amount = commercial - eligible.
      //  4. Sem itens conhecidos (proposta legada) → trata o comercial inteiro como elegível,
      //     a menos que a regra (2) tenha excluído a venda.
      const oppEnrichment = new Map<string, {
        commercial: number;
        mrr: number;
        oneShot: number;
        eligible: number;
        nonEligible: number;
        revenueConfidence: string | null;
        proposalId: string | null;
        items: Array<{
          proposal_item_id: string | null;
          product_id: string | null;
          product_name: string | null;
          billing_type: string | null;
          quantity: number;
          line_amount: number;
          mrr_amount: number;
          one_shot_amount: number;
          counts_toward_goal: boolean;
          exclusion_reason: string | null;
        }>;
        exclusionReason: string | null;
      }>();

      if (goalType !== 'leads' && opportunities.length > 0) {
        const oppIds = opportunities.map((o: any) => o.id);

        // 1) SSoT amounts (única fonte de receita realizada)
        const { data: ssotRows } = await supabase
          .from('commercial_won_revenue_view')
          .select('opportunity_id, accepted_proposal_id, commercial_amount, valid_revenue_amount, commission_eligible_amount, mrr_amount, one_shot_amount, revenue_confidence, commercial_status, fulfillment_status, is_cancelled_sale, cancelled_at')
          .eq('organization_id', organizationId)
          .in('opportunity_id', oppIds);
        const ssotMap = new Map((ssotRows || []).map((r: any) => [r.opportunity_id, r]));

        // 2) Proposal items — agora afetam o cálculo de meta (item + produto).
        const proposalIds = (ssotRows || [])
          .map((r: any) => r.accepted_proposal_id)
          .filter((id: string | null): id is string => !!id);

        const itemsByProposal = new Map<string, any[]>();
        const productIdSet = new Set<string>();
        if (proposalIds.length > 0) {
          const { data: items } = await supabase
            .from('proposal_items')
            .select('id, proposal_id, product_id, name, billing_type, quantity, total, counts_for_commission')
            .in('proposal_id', proposalIds);
          for (const it of items || []) {
            const arr = itemsByProposal.get(it.proposal_id) || [];
            arr.push(it);
            itemsByProposal.set(it.proposal_id, arr);
            if (it.product_id) productIdSet.add(it.product_id);
          }
        }

        // Map produto -> counts_for_commission (false = "não conta para meta/comissão").
        const productCommissionMap = new Map<string, boolean>();
        if (productIdSet.size > 0) {
          const { data: prods } = await supabase
            .from('products')
            .select('id, counts_for_commission')
            .in('id', Array.from(productIdSet));
          for (const p of prods || []) {
            productCommissionMap.set(p.id, p.counts_for_commission !== false);
          }
        }

        for (const opp of opportunities) {
          const ssot: any = ssotMap.get(opp.id);
          const commercial = Number(
            ssot?.commission_eligible_amount
              ?? ssot?.valid_revenue_amount
              ?? ssot?.commercial_amount
              ?? opp.commission_value
              ?? opp.valor_previsto
              ?? 0,
          );
          const mrr = Number(ssot?.mrr_amount ?? 0);
          const oneShot = Number(ssot?.one_shot_amount ?? (ssot ? 0 : commercial));
          const proposalId: string | null = ssot?.accepted_proposal_id ?? null;
          const rawItems = proposalId ? itemsByProposal.get(proposalId) || [] : [];

          const fulfillment = (ssot?.fulfillment_status ?? '').toLowerCase();
          const commercialSt = (ssot?.commercial_status ?? '').toLowerCase();
          const saleExcluded =
            ssot?.is_cancelled_sale === true ||
            fulfillment === 'removed' ||
            fulfillment === 'cancelled' ||
            commercialSt === 'lost';
          const saleExclusionReason = saleExcluded
            ? (commercialSt === 'lost'
                ? 'Proposta aprovada posteriormente reaberta e perdida/cancelada'
                : 'Venda removida/cancelada operacionalmente após aprovação')
            : null;

          // Cálculo por item (afeta meta).
          const items: any[] = [];
          let itemsSum = 0;
          let eligibleItemsSum = 0;
          let anyItemExcluded = false;
          if (rawItems.length > 0) {
            for (const it of rawItems) itemsSum += Number(it.total || 0);
            const factor = itemsSum > 0 ? commercial / itemsSum : 0;
            for (const it of rawItems) {
              const lineAmount = Number(it.total || 0) * factor;
              const itemFlag = it.counts_for_commission !== false;
              const productFlag = it.product_id
                ? productCommissionMap.get(it.product_id) !== false
                : true;
              const itemEligibleForGoal = itemFlag && productFlag;
              const isMrr = (it.billing_type || '').toLowerCase() === 'recurring';
              const lineCountsForGoal = !saleExcluded && itemEligibleForGoal;
              if (!itemEligibleForGoal) anyItemExcluded = true;
              if (!saleExcluded && itemEligibleForGoal) eligibleItemsSum += lineAmount;
              const itemReason = saleExcluded
                ? saleExclusionReason
                : (!itemEligibleForGoal
                    ? (!productFlag
                        ? 'Produto/serviço não contabiliza para meta'
                        : 'Item não contabiliza para comissão/meta')
                    : null);
              items.push({
                proposal_item_id: it.id,
                product_id: it.product_id,
                product_name: it.name,
                billing_type: it.billing_type,
                quantity: Number(it.quantity || 0),
                line_amount: lineAmount,
                mrr_amount: isMrr ? lineAmount : 0,
                one_shot_amount: isMrr ? 0 : lineAmount,
                counts_toward_goal: lineCountsForGoal,
                exclusion_reason: itemReason,
              });
            }
          }

          // Sem itens conhecidos → comercial inteiro é elegível (fallback legado),
          // a menos que a venda esteja excluída por status final.
          const usingLegacyFallback = !saleExcluded && rawItems.length === 0;
          const eligible = saleExcluded
            ? 0
            : (rawItems.length > 0 ? eligibleItemsSum : commercial);
          const nonEligible = Math.max(0, commercial - eligible);

          const exclusionReason = saleExcluded
            ? saleExclusionReason
            : (anyItemExcluded && nonEligible > 0.01
                ? 'Produto/serviço não contabiliza para meta (ver itens)'
                : (usingLegacyFallback && proposalId
                    ? 'Itens da proposta não disponíveis — usando fallback legado (revisar)'
                    : null));

          // Telemetria por venda — crítica para auditar por que `eligible` pode
          // estar igual a `commercial` quando há produtos não-elegíveis.
          console.log(
            `[ote] opp=${opp.id} proposal=${proposalId ?? 'none'} commercial=${commercial.toFixed(2)} ` +
            `items=${rawItems.length} eligible=${eligible.toFixed(2)} nonEligible=${nonEligible.toFixed(2)} ` +
            `saleExcluded=${saleExcluded} anyItemExcluded=${anyItemExcluded} legacy=${usingLegacyFallback}`,
          );
          if (rawItems.length > 0) {
            for (const ent of items) {
              console.log(
                `  · item product=${ent.product_id ?? '-'} name="${ent.product_name ?? ''}" ` +
                `line=${ent.line_amount.toFixed(2)} countsForGoal=${ent.counts_toward_goal} ` +
                `reason="${ent.exclusion_reason ?? ''}"`,
              );
            }
          }

          oppEnrichment.set(opp.id, {
            commercial,
            mrr,
            oneShot,
            eligible,
            nonEligible,
            revenueConfidence: usingLegacyFallback
              ? 'legacy_fallback'
              : (ssot?.revenue_confidence ?? null),
            proposalId,
            items,
            exclusionReason,
          });
        }
      }


      // For leads goal_type: count opportunities. For revenue: sum eligible (SSoT-aligned).
      const totalSales = goalType === 'leads'
        ? opportunities.length
        : Array.from(oppEnrichment.values()).reduce((sum, e) => sum + e.eligible, 0);

      console.log(`Seller ${config.user_id}: goalType=${goalType}, totalSales=${totalSales}, opportunities=${opportunities.length}`);

      // Get goal: for team targets use configured monthly_revenue_target, otherwise use config/level
      const goalAmount = isTeamTarget
        ? (config.custom_goal_override || salesConfig?.monthly_revenue_target || dynamicTeamGoal || 0)
        : (config.custom_goal_override || config.ote_level?.monthly_goal || 0);
      
      // goalType already determined above

      const variableTarget = config.custom_variable_override || config.ote_level?.variable_target || 0;

      // Calculate achievement percentage
      const achievementPercentage = goalAmount > 0 ? (totalSales / goalAmount) * 100 : 0;

      // Find applicable multiplier.
      // IMPORTANT: configs commonly use integer max ranges (ex: 85-99, next 100-109).
      // A real achievement like 99.21% must still fall into the 85-99 tier instead of
      // dropping to 0 because of the decimal gap between 99 and 100.
      let oteMultiplier = 0;
      if (multipliers?.length) {
        const sortedMultipliers = [...multipliers].sort((a, b) => a.min_percentage - b.min_percentage);
        const matchedMultiplier = sortedMultipliers.find((mult, index) => {
          const nextMin = sortedMultipliers[index + 1]?.min_percentage;
          const lowerBoundMatches = achievementPercentage >= Number(mult.min_percentage || 0);
          const upperBoundMatches = nextMin != null
            ? achievementPercentage < Number(nextMin)
            : achievementPercentage <= Number(mult.max_percentage ?? Infinity);

          return lowerBoundMatches && upperBoundMatches;
        });

        oteMultiplier = matchedMultiplier?.multiplier ?? 0;
      }

      // Calculate base variable
      const baseVariable = variableTarget * oteMultiplier;

      // Determine flag color using configurable thresholds
      let flagColor: 'blue' | 'yellow' | 'red' | null = null;
      let flagReason = '';
      if (achievementPercentage >= flagBlueThreshold) {
        flagColor = 'blue';
        flagReason = `Meta atingida (≥ ${flagBlueThreshold}%)`;
      } else if (achievementPercentage >= flagYellowMinThreshold) {
        flagColor = 'yellow';
        flagReason = `Entre ${flagYellowMinThreshold}% e ${flagYellowMaxThreshold}% da meta`;
      } else {
        flagColor = 'red';
        flagReason = `Abaixo de ${flagYellowMinThreshold}% da meta`;
      }

      // Get roleplay data — sessions concluídas no período (finished_at != null)
      // OBS: a tabela `roleplay_sessions` não tem coluna `status`; usar finished_at + score_overall
      const { data: roleplaySessions, error: roleplayErr } = await supabase
        .from('roleplay_sessions')
        .select('score_overall, passed, finished_at')
        .eq('organization_id', organizationId)
        .eq('seller_id', config.user_id)
        .not('finished_at', 'is', null)
        .not('score_overall', 'is', null)
        .gte('started_at', startDate)
        .lte('started_at', endDate);

      if (roleplayErr) {
        console.error(`[calculate-ote] roleplay query error for ${config.user_id}:`, roleplayErr);
      }

      let roleplayScore = null;
      let roleplayAccelerator = 0;
      if (roleplaySessions && roleplaySessions.length > 0) {
        const avgScore = roleplaySessions.reduce((sum, s) => sum + (Number(s.score_overall) || 0), 0) / roleplaySessions.length;
        roleplayScore = avgScore;
        console.log(`[calculate-ote] roleplay seller=${config.user_id} sessions=${roleplaySessions.length} avgScore=${avgScore.toFixed(2)}`);
        
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

      // Get FitScore from seller (individual evaluation score, not accounts)
      const { data: sellerData } = await supabase
        .from('sellers')
        .select('id, current_fit_score')
        .eq('user_id', config.user_id)
        .eq('organization_id', organizationId)
        .maybeSingle();

      let fitscoreAvg = sellerData?.current_fit_score || null;
      let fitscoreAccelerator = 0;
      
      if (fitscoreAvg !== null && rules) {
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

      // ========== PERFORMANCE GATES INTEGRATION ==========
      let gateMultiplier = 1.0;
      let accelerationBlocked = false;
      const gatesApplied: any[] = [];

      // Get seller's performance scores
      let performanceScores: any = null;
      if (sellerData?.id) {
        const { data: scores } = await supabase
          .from('seller_performance_scores')
          .select('cs_final, bs_final, ds_final, ras_final, ras_status')
          .eq('seller_id', sellerData.id)
          .single();
        performanceScores = scores;
      }

      if (performanceScores && performanceGates) {
        for (const gate of performanceGates) {
          const scoreValue = getScoreValue(performanceScores, gate.condition_score);
          
          if (scoreValue !== null && evaluateGateCondition(scoreValue, gate.condition_operator, gate.condition_value)) {
            console.log(`Gate triggered: ${gate.name} (${gate.condition_score} ${gate.condition_operator} ${gate.condition_value}, actual: ${scoreValue})`);
            
            if (gate.action_type === 'multiplier' && gate.gate_type === 'commission') {
              const mult = gate.action_value?.multiplier || 1;
              gateMultiplier *= mult;
              gatesApplied.push({
                gate_id: gate.id,
                gate_name: gate.name,
                action: 'multiplier',
                value: mult,
                reason: gate.action_value?.reason || gate.description
              });
            }
            
            if (gate.action_type === 'block' && gate.gate_type === 'acceleration') {
              accelerationBlocked = true;
              gatesApplied.push({
                gate_id: gate.id,
                gate_name: gate.name,
                action: 'block_acceleration',
                value: true,
                reason: gate.action_value?.reason || gate.description
              });
            }

            // Record gate execution
            if (sellerData?.id) {
              await supabase.from('gate_executions').insert({
                gate_id: gate.id,
                seller_id: sellerData.id,
                score_at_trigger: scoreValue,
                action_applied: gate.action_value,
                organization_id: organizationId
              });
            }
          }
        }
      }

      console.log(`Gates applied: ${gatesApplied.length}, multiplier: ${gateMultiplier}, acceleration blocked: ${accelerationBlocked}`);

      // Calculate totals
      const totalAccelerator = roleplayAccelerator + crmAccelerator + fitscoreAccelerator;
      const totalDecelerator = Math.abs(Math.min(0, totalAccelerator));
      
      // Apply acceleration block if triggered
      const effectiveAccelerator = accelerationBlocked ? Math.min(totalAccelerator, 0) : totalAccelerator;
      const finalAdjustment = effectiveAccelerator;
      
      // Apply gate multiplier to final variable
      const baseVariableWithGates = baseVariable * gateMultiplier;
      const finalVariable = baseVariableWithGates * (1 + finalAdjustment / 100);

      // Upsert result
      const resultData: any = {
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
        is_team_target: isTeamTarget,
        team_member_count: isTeamTarget ? teamMemberIds.length : null,
        goal_type: goalType,
        // Performance gates fields
        performance_gate_multiplier: gateMultiplier,
        acceleration_blocked: accelerationBlocked,
        gates_applied: gatesApplied.length > 0 ? gatesApplied : null,
        performance_scores: performanceScores ? {
          cs: performanceScores.cs_final,
          bs: performanceScores.bs_final,
          ds: performanceScores.ds_final,
          ras: performanceScores.ras_final,
          ras_status: performanceScores.ras_status
        } : null,
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

      // Create sales/qualification detail records for full transparency
      if (opportunities && opportunities.length > 0 && upsertedResult) {
        // Delete existing detail records (cascade clears ote_sales_record_items)
        await supabase
          .from('ote_sales_records')
          .delete()
          .eq('ote_result_id', upsertedResult.id);

        type PendingRecord = {
          record: any;
          items: any[];
          opportunityId: string;
        };

        const pending: PendingRecord[] = opportunities.map((opp: any) => {
          const acc = opp.account as any;
          const pipelineInfo = pipelineMap.get(opp.pipeline_id);
          const closedAt = opp.closed_at || opp.updated_at;
          const closedDate = closedAt
            ? new Date(closedAt).toISOString().split('T')[0]
            : new Date().toISOString().split('T')[0];

          if (goalType === 'leads') {
            return {
              opportunityId: opp.id,
              items: [],
              record: {
                organization_id: organizationId,
                ote_result_id: upsertedResult.id,
                opportunity_id: opp.id,
                client_name: acc?.nome_fantasia || acc?.razao_social || opp.title,
                sale_value: 0,
                mrr_amount: 0,
                one_shot_amount: 0,
                eligible_amount: 0,
                non_eligible_amount: 0,
                commercial_commission_base: 0,
                eligible_ote_amount: 0,
                sale_date: closedDate,
                closed_at: closedAt,
                period_start: startDate.split('T')[0],
                period_end: endDate.split('T')[0],
                pipeline_id: opp.pipeline_id,
                pipeline_name: pipelineInfo?.name || null,
                payment_status: 'pending',
                counts_toward_goal: true,
                record_kind: 'qualified_lead',
                pre_sales_user_id: config.user_id,
                attribution_source: 'opportunity_qualification_history',
                attribution_confidence: 'high',
                qualified_leads_count: 1,
              },
            };
          }

          const enr = oppEnrichment.get(opp.id);
          const commercial = enr?.commercial ?? 0;
          const eligible = enr?.eligible ?? commercial;
          const nonEligible = enr?.nonEligible ?? 0;
          const recordCountsForGoal = nonEligible <= 0.01;

          return {
            opportunityId: opp.id,
            items: enr?.items || [],
            record: {
              organization_id: organizationId,
              ote_result_id: upsertedResult.id,
              opportunity_id: opp.id,
              proposal_id: enr?.proposalId || null,
              client_name: acc?.nome_fantasia || acc?.razao_social || opp.title,
              sale_value: commercial,
              commercial_commission_base: commercial,
              eligible_ote_amount: eligible,
              mrr_amount: enr?.mrr ?? 0,
              one_shot_amount: enr?.oneShot ?? commercial,
              eligible_amount: eligible,
              non_eligible_amount: nonEligible,
              sale_date: closedDate,
              closed_at: closedAt,
              period_start: startDate.split('T')[0],
              period_end: endDate.split('T')[0],
              pipeline_id: opp.pipeline_id,
              pipeline_name: pipelineInfo?.name || null,
              payment_status: 'pending',
              counts_toward_goal: recordCountsForGoal,
              exclusion_reason: enr?.exclusionReason ?? null,
              record_kind: 'sale',
              revenue_confidence: enr?.revenueConfidence || null,
              seller_user_id: config.user_id,
              attribution_source: 'opportunity_owner_history',
              attribution_confidence: 'high',
            },
          };
        });

        const { data: insertedRecords, error: insertErr } = await supabase
          .from('ote_sales_records')
          .insert(pending.map((p) => p.record))
          .select('id, opportunity_id');

        if (insertErr) {
          console.error('Error inserting ote_sales_records:', insertErr);
        } else if (insertedRecords && insertedRecords.length > 0) {
          // Build per-item rows referencing the freshly inserted record ids
          const recordIdByOpp = new Map(
            insertedRecords.map((r: any) => [r.opportunity_id, r.id]),
          );
          const itemRows: any[] = [];
          for (const p of pending) {
            const recId = recordIdByOpp.get(p.opportunityId);
            if (!recId) continue;
            for (const it of p.items) {
              itemRows.push({
                organization_id: organizationId,
                ote_sales_record_id: recId,
                proposal_item_id: it.proposal_item_id,
                product_id: it.product_id,
                product_name: it.product_name,
                billing_type: it.billing_type,
                quantity: it.quantity,
                line_amount: it.line_amount,
                mrr_amount: it.mrr_amount,
                one_shot_amount: it.one_shot_amount,
                counts_toward_goal: it.counts_toward_goal,
                exclusion_reason: it.exclusion_reason,
              });
            }
          }
          if (itemRows.length > 0) {
            const { error: itemsErr } = await supabase
              .from('ote_sales_record_items')
              .insert(itemRows);
            if (itemsErr) {
              console.error('Error inserting ote_sales_record_items:', itemsErr);
            }
          }
        }
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

function getScoreValue(scores: any, scoreType: string): number | null {
  if (!scores) return null;
  switch (scoreType) {
    case 'CS': return scores.cs_final;
    case 'BS': return scores.bs_final;
    case 'DS': return scores.ds_final;
    case 'RAS': return scores.ras_final;
    default: return null;
  }
}

function evaluateGateCondition(value: number, operator: string, threshold: number): boolean {
  switch (operator) {
    case '>=': return value >= threshold;
    case '<=': return value <= threshold;
    case '>': return value > threshold;
    case '<': return value < threshold;
    default: return false;
  }
}
