import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.76.0';

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

    const { organization_id, playbook_id, compare_versions } = await req.json();

    console.log(`[analyze-playbook-roi] Analyzing playbooks for org: ${organization_id}`);

    // Get playbook metrics
    let query = supabase
      .from('ai_playbooks')
      .select(`
        id,
        name,
        category,
        complexity,
        version,
        is_active,
        auto_disabled,
        disabled_reason,
        roi_score,
        conversion_rate,
        total_revenue_generated,
        total_cost_hours,
        avg_cycle_time_days,
        usage_count,
        estimated_hours,
        roi_threshold,
        min_sample_size,
        created_at,
        updated_at
      `)
      .eq('organization_id', organization_id);

    if (playbook_id) {
      query = query.eq('id', playbook_id);
    }

    const { data: playbooks, error: playbooksError } = await query;

    if (playbooksError) {
      console.error('[analyze-playbook-roi] Error fetching playbooks:', playbooksError);
      return new Response(JSON.stringify({ error: 'Failed to fetch playbooks' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Get execution details for each playbook
    const playbookIds = playbooks?.map(p => p.id) || [];
    
    const { data: executions } = await supabase
      .from('playbook_executions')
      .select('playbook_id, converted, revenue_generated, cost_hours, cycle_time_days, effectiveness_rating, started_at')
      .in('playbook_id', playbookIds)
      .eq('status', 'completed')
      .gte('started_at', new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString());

    // Analyze each playbook
    const analysis = playbooks?.map(playbook => {
      const pbExecutions = executions?.filter(e => e.playbook_id === playbook.id) || [];
      const totalExecutions = pbExecutions.length;
      const conversions = pbExecutions.filter(e => e.converted).length;
      const totalRevenue = pbExecutions.reduce((sum, e) => sum + (e.revenue_generated || 0), 0);
      const totalHours = pbExecutions.reduce((sum, e) => sum + (e.cost_hours || 0), 0);
      const avgCycle = totalExecutions > 0 
        ? pbExecutions.reduce((sum, e) => sum + (e.cycle_time_days || 0), 0) / totalExecutions 
        : 0;
      const avgRating = totalExecutions > 0
        ? pbExecutions.filter(e => e.effectiveness_rating).reduce((sum, e) => sum + e.effectiveness_rating, 0) / 
          pbExecutions.filter(e => e.effectiveness_rating).length
        : 0;

      const conversionRate = totalExecutions > 0 ? (conversions / totalExecutions) * 100 : 0;
      const roiPerHour = totalHours > 0 ? totalRevenue / totalHours : 0;

      // Determine health status
      let healthStatus: 'excellent' | 'good' | 'warning' | 'critical' = 'good';
      let recommendations: string[] = [];

      if (playbook.auto_disabled) {
        healthStatus = 'critical';
        recommendations.push('Playbook desativado automaticamente por baixo ROI. Considere revisar a estratégia.');
      } else if (totalExecutions < playbook.min_sample_size) {
        healthStatus = 'warning';
        recommendations.push(`Precisa de mais ${playbook.min_sample_size - totalExecutions} execuções para avaliação completa.`);
      } else if (roiPerHour < playbook.roi_threshold) {
        healthStatus = 'warning';
        recommendations.push('ROI abaixo do threshold. Otimize os passos ou reduza tempo estimado.');
      } else if (conversionRate >= 30 && roiPerHour >= 1000) {
        healthStatus = 'excellent';
      }

      if (avgCycle > 14 && conversionRate < 20) {
        recommendations.push('Ciclo longo com baixa conversão. Considere qualificar melhor antes de aplicar.');
      }

      if (avgRating < 3 && avgRating > 0) {
        recommendations.push('Feedback dos usuários indica baixa efetividade. Revise os passos.');
      }

      // Trend analysis (last 30 days vs previous 30 days)
      const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
      const sixtyDaysAgo = new Date(Date.now() - 60 * 24 * 60 * 60 * 1000);
      
      const recentExecs = pbExecutions.filter(e => new Date(e.started_at) >= thirtyDaysAgo);
      const previousExecs = pbExecutions.filter(e => {
        const date = new Date(e.started_at);
        return date >= sixtyDaysAgo && date < thirtyDaysAgo;
      });

      const recentConvRate = recentExecs.length > 0 
        ? (recentExecs.filter(e => e.converted).length / recentExecs.length) * 100 
        : 0;
      const previousConvRate = previousExecs.length > 0 
        ? (previousExecs.filter(e => e.converted).length / previousExecs.length) * 100 
        : 0;

      const trend = recentConvRate > previousConvRate ? 'up' : recentConvRate < previousConvRate ? 'down' : 'stable';

      return {
        playbook_id: playbook.id,
        name: playbook.name,
        category: playbook.category,
        complexity: playbook.complexity,
        version: playbook.version,
        is_active: playbook.is_active,
        auto_disabled: playbook.auto_disabled,
        disabled_reason: playbook.disabled_reason,
        metrics: {
          total_executions: totalExecutions,
          conversions,
          conversion_rate: Math.round(conversionRate * 100) / 100,
          total_revenue: totalRevenue,
          total_hours: totalHours,
          roi_per_hour: Math.round(roiPerHour * 100) / 100,
          avg_cycle_days: Math.round(avgCycle * 10) / 10,
          avg_rating: Math.round(avgRating * 10) / 10,
        },
        trend: {
          direction: trend,
          recent_conversion_rate: Math.round(recentConvRate * 100) / 100,
          previous_conversion_rate: Math.round(previousConvRate * 100) / 100,
          recent_executions: recentExecs.length,
        },
        health_status: healthStatus,
        recommendations,
        thresholds: {
          roi_threshold: playbook.roi_threshold,
          min_sample_size: playbook.min_sample_size,
        },
      };
    });

    // Get version comparison if requested
    let versionComparison = null;
    if (compare_versions && playbook_id) {
      const { data: versions } = await supabase
        .from('playbook_versions')
        .select('*')
        .eq('playbook_id', playbook_id)
        .order('version_number', { ascending: false })
        .limit(5);

      versionComparison = versions?.map(v => ({
        version_number: v.version_number,
        version_label: v.version_label,
        status: v.status,
        deployed_at: v.deployed_at,
        metrics: {
          executions_count: v.executions_count,
          success_count: v.success_count,
          conversion_rate: v.conversion_rate,
          total_revenue: v.total_revenue,
          roi_score: v.roi_score,
        },
      }));
    }

    // Calculate organization-wide summary
    const summary = {
      total_playbooks: playbooks?.length || 0,
      active_playbooks: playbooks?.filter(p => p.is_active && !p.auto_disabled).length || 0,
      auto_disabled_playbooks: playbooks?.filter(p => p.auto_disabled).length || 0,
      total_revenue: analysis?.reduce((sum, p) => sum + p.metrics.total_revenue, 0) || 0,
      total_executions: analysis?.reduce((sum, p) => sum + p.metrics.total_executions, 0) || 0,
      avg_conversion_rate: analysis && analysis.length > 0
        ? analysis.reduce((sum, p) => sum + p.metrics.conversion_rate, 0) / analysis.length
        : 0,
      top_performer: analysis?.sort((a, b) => b.metrics.roi_per_hour - a.metrics.roi_per_hour)[0]?.name || null,
    };

    console.log(`[analyze-playbook-roi] Analysis complete. ${summary.total_playbooks} playbooks analyzed.`);

    return new Response(JSON.stringify({
      success: true,
      summary,
      playbooks: analysis,
      version_comparison: versionComparison,
      analyzed_at: new Date().toISOString(),
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('[analyze-playbook-roi] Error:', error);
    return new Response(JSON.stringify({ error: 'Internal server error' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
