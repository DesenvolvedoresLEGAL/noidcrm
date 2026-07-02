import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.76.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
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

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { organization_id } = await req.json();
    
    if (!organization_id) {
      return new Response(
        JSON.stringify({ error: "organization_id required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const alertsGenerated: string[] = [];

    // 1. HIGH VALUE DEALS AT RISK
    // Deals with high value but stale (no activity > 7 days)
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    const { data: staleHighValueDeals } = await supabase
      .from('opportunities')
      .select('id, title, valor_previsto, owner_user_id, last_contact_date, days_since_contact')
      .eq('organization_id', organization_id)
      .eq('status', 'open')
      .gt('valor_previsto', 50000) // High value threshold
      .or(`last_contact_date.lt.${sevenDaysAgo.toISOString()},last_contact_date.is.null`)
      .order('valor_previsto', { ascending: false })
      .limit(10);

    for (const deal of staleHighValueDeals || []) {
      // Check if alert already exists
      const { data: existingAlert } = await supabase
        .from('ai_alerts')
        .select('id')
        .eq('organization_id', organization_id)
        .eq('entity_type', 'opportunity')
        .eq('entity_id', deal.id)
        .eq('alert_type', 'high_value_risk')
        .eq('status', 'active')
        .single();

      if (!existingAlert && deal.owner_user_id) {
        await supabase.from('ai_alerts').insert({
          organization_id,
          user_id: deal.owner_user_id,
          alert_type: 'high_value_risk',
          priority: deal.valor_previsto > 100000 ? 'critical' : 'high',
          title: `Deal de alto valor em risco: ${deal.title}`,
          message: `Este deal de R$ ${Number(deal.valor_previsto).toLocaleString('pt-BR')} está sem contato há ${deal.days_since_contact || 'muitos'} dias.`,
          entity_type: 'opportunity',
          entity_id: deal.id,
          metadata: {
            deal_value: deal.valor_previsto,
            days_stale: deal.days_since_contact,
            last_contact: deal.last_contact_date,
          },
        });
        alertsGenerated.push(`high_value_risk: ${deal.title}`);
      }
    }

    // 2. IMMINENT CLOSE OPPORTUNITIES
    // Deals with close date in next 7 days and high probability
    const nextWeek = new Date();
    nextWeek.setDate(nextWeek.getDate() + 7);

    const { data: imminentCloseDeals } = await supabase
      .from('opportunities')
      .select('id, title, valor_previsto, owner_user_id, close_date_prevista, prob, win_probability_ai')
      .eq('organization_id', organization_id)
      .eq('status', 'open')
      .lte('close_date_prevista', nextWeek.toISOString())
      .gte('close_date_prevista', new Date().toISOString())
      .or('prob.gte.70,win_probability_ai.gte.70');

    for (const deal of imminentCloseDeals || []) {
      const { data: existingAlert } = await supabase
        .from('ai_alerts')
        .select('id')
        .eq('organization_id', organization_id)
        .eq('entity_type', 'opportunity')
        .eq('entity_id', deal.id)
        .eq('alert_type', 'imminent_close')
        .eq('status', 'active')
        .single();

      if (!existingAlert && deal.owner_user_id) {
        await supabase.from('ai_alerts').insert({
          organization_id,
          user_id: deal.owner_user_id,
          alert_type: 'imminent_close',
          priority: 'high',
          title: `Fechamento iminente: ${deal.title}`,
          message: `Este deal está previsto para fechar em breve. Probabilidade: ${deal.win_probability_ai || deal.prob}%`,
          entity_type: 'opportunity',
          entity_id: deal.id,
          metadata: {
            deal_value: deal.valor_previsto,
            close_date: deal.close_date_prevista,
            close_probability: deal.win_probability_ai || deal.prob,
          },
        });
        alertsGenerated.push(`imminent_close: ${deal.title}`);
      }
    }

    // 3. PERFORMANCE BELOW EXPECTED
    // Check sellers with low activity or conversion
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const { data: sellers } = await supabase
      .from('sellers')
      .select('id, user_id, name')
      .eq('organization_id', organization_id)
      .eq('is_active', true);

    for (const seller of sellers || []) {
      // Count activities in last 30 days
      const { count: activityCount } = await supabase
        .from('activities')
        .select('id', { count: 'exact', head: true })
        .eq('owner_user_id', seller.user_id)
        .gte('created_at', thirtyDaysAgo.toISOString());

      // Low activity threshold
      if ((activityCount || 0) < 10) {
        const { data: existingAlert } = await supabase
          .from('ai_alerts')
          .select('id')
          .eq('organization_id', organization_id)
          .eq('user_id', seller.user_id)
          .eq('alert_type', 'performance_below')
          .eq('status', 'active')
          .single();

        if (!existingAlert) {
          // Alert manager, not the seller
          const { data: managers } = await supabase
            .from('organization_members')
            .select('user_id')
            .eq('organization_id', organization_id)
            .in('org_role', ['owner', 'admin', 'manager'])
            .limit(1);

          const managerId = managers?.[0]?.user_id;
          if (managerId) {
            await supabase.from('ai_alerts').insert({
              organization_id,
              user_id: managerId,
              alert_type: 'performance_below',
              priority: 'medium',
              title: `Baixa atividade: ${seller.name}`,
              message: `${seller.name} registrou apenas ${activityCount || 0} atividades nos últimos 30 dias.`,
              entity_type: 'seller',
              entity_id: seller.id,
              metadata: {
                seller_name: seller.name,
                activity_count: activityCount,
                period_days: 30,
              },
            });
            alertsGenerated.push(`performance_below: ${seller.name}`);
          }
        }
      }
    }

    // 4. ESCALATIONS FROM SEQUENCES
    // Check sequence enrollments that were escalated but not yet alerted
    const { data: escalatedEnrollments } = await supabase
      .from('sequence_enrollments')
      .select(`
        id, opportunity_id, paused_reason,
        opportunities!inner(id, title, owner_user_id, valor_previsto)
      `)
      .eq('organization_id', organization_id)
      .eq('status', 'paused')
      .like('paused_reason', '%escalated%');

    for (const enrollment of escalatedEnrollments || []) {
      const opportunity = enrollment.opportunities as any;
      if (!opportunity?.owner_user_id) continue;

      const { data: existingAlert } = await supabase
        .from('ai_alerts')
        .select('id')
        .eq('organization_id', organization_id)
        .eq('entity_type', 'opportunity')
        .eq('entity_id', opportunity.id)
        .eq('alert_type', 'escalation')
        .eq('status', 'active')
        .single();

      if (!existingAlert) {
        await supabase.from('ai_alerts').insert({
          organization_id,
          user_id: opportunity.owner_user_id,
          alert_type: 'escalation',
          priority: 'high',
          title: `Escalonamento: ${opportunity.title}`,
          message: `Esta oportunidade foi escalonada pela IA após múltiplas tentativas de contato sem resposta.`,
          entity_type: 'opportunity',
          entity_id: opportunity.id,
          metadata: {
            deal_value: opportunity.valor_previsto,
            escalation_reason: enrollment.paused_reason,
          },
        });
        alertsGenerated.push(`escalation: ${opportunity.title}`);
      }
    }

    console.log(`[generate-ai-alerts] Generated ${alertsGenerated.length} alerts for org ${organization_id}`);

    return new Response(
      JSON.stringify({ 
        success: true, 
        alerts_generated: alertsGenerated.length,
        alerts: alertsGenerated,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("[generate-ai-alerts] Error:", error);
    return new Response(
      JSON.stringify({ error: "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
