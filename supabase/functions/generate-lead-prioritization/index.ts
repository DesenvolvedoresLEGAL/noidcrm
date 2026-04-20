import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface OpportunityData {
  id: string;
  title: string;
  valor_previsto: number | null;
  temperature: string | null;
  created_at: string;
  last_contact_date: string | null;
  stage_id: string | null;
  account: {
    id: string;
    nome_fantasia: string | null;
    razao_social: string;
    fit_score: number | null;
    intent_score: number | null;
    lead_score: number | null;
    lead_grade: string | null;
    segmento: string | null;
    porte: string | null;
  } | null;
  contact: {
    id: string;
    nome: string;
    cargo: string | null;
  } | null;
  activities: { id: string; type: string; completed_at: string | null }[];
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get('authorization');
    if (!authHeader) {
      throw new Error('Missing authorization header');
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const lovableApiKey = Deno.env.get('OPENAI_API_KEY') ?? Deno.env.get('LOVABLE_API_KEY');
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Get user from token
    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: userError } = await supabase.auth.getUser(token);
    if (userError || !user) throw new Error('Invalid token');

    // Get user's organization
    const { data: profile } = await supabase
      .from('profiles')
      .select('organization_id')
      .eq('user_id', user.id)
      .single();

    if (!profile?.organization_id) {
      throw new Error('User has no organization');
    }

    const organizationId = profile.organization_id;

    // Fetch all open opportunities for this user
    const { data: opportunities, error: oppsError } = await supabase
      .from('opportunities')
      .select(`
        id,
        title,
        valor_previsto,
        temperature,
        created_at,
        last_contact_date,
        stage_id,
        account:accounts(
          id, nome_fantasia, razao_social, 
          fit_score, intent_score, lead_score, lead_grade,
          segmento, porte
        ),
        contact:contacts(id, nome, cargo),
        activities(id, type, completed_at)
      `)
      .eq('organization_id', organizationId)
      .eq('owner_user_id', user.id)
      .in('status', ['open', 'in_progress', 'new'])
      .order('created_at', { ascending: false })
      .limit(50);

    if (oppsError) {
      console.error('Error fetching opportunities:', oppsError);
      throw oppsError;
    }

    if (!opportunities || opportunities.length === 0) {
      return new Response(JSON.stringify({
        success: true,
        message: 'No opportunities to prioritize',
        prioritized: []
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Calculate priority score for each opportunity
    const prioritizedLeads = opportunities.map((opp: any) => {
      let score = 0;
      const factors: Record<string, number> = {};
      const reasons: string[] = [];

      // 1. Lead Grade (0-30 points)
      const leadGrade = opp.account?.lead_grade || 'D';
      const gradePoints = { A: 30, B: 22, C: 15, D: 8, F: 0 };
      factors.lead_grade = gradePoints[leadGrade as keyof typeof gradePoints] || 0;
      score += factors.lead_grade;
      if (leadGrade === 'A' || leadGrade === 'B') {
        reasons.push(`Lead grade ${leadGrade} - alta qualificação`);
      }

      // 2. Fit Score (0-20 points)
      const fitScore = opp.account?.fit_score || 0;
      factors.fit_score = Math.round(fitScore * 0.2);
      score += factors.fit_score;
      if (fitScore >= 70) {
        reasons.push('Alto FitScore - perfil ideal');
      }

      // 3. Intent Score (0-25 points)
      const intentScore = opp.account?.intent_score || 0;
      factors.intent_score = Math.round(intentScore * 0.25);
      score += factors.intent_score;
      if (intentScore >= 60) {
        reasons.push('Alto Intent - interesse demonstrado');
      }

      // 4. Value Score (0-15 points)
      const value = opp.valor_previsto || 0;
      if (value >= 50000) {
        factors.value = 15;
        reasons.push('Alto valor potencial');
      } else if (value >= 20000) {
        factors.value = 10;
      } else if (value >= 5000) {
        factors.value = 5;
      } else {
        factors.value = 2;
      }
      score += factors.value;

      // 5. Temperature (0-10 points)
      const temperature = opp.temperature || 'cold';
      const tempPoints = { burning: 10, hot: 8, warm: 5, cold: 2 };
      factors.temperature = tempPoints[temperature as keyof typeof tempPoints] || 2;
      score += factors.temperature;
      if (temperature === 'burning' || temperature === 'hot') {
        reasons.push(`Temperatura ${temperature} - prioridade alta`);
      }

      // 6. Recency bonus (0-10 points) - newer leads get priority
      const createdDaysAgo = Math.floor((Date.now() - new Date(opp.created_at).getTime()) / (1000 * 60 * 60 * 24));
      if (createdDaysAgo <= 1) {
        factors.recency = 10;
        reasons.push('Lead novo - resposta rápida');
      } else if (createdDaysAgo <= 3) {
        factors.recency = 7;
      } else if (createdDaysAgo <= 7) {
        factors.recency = 4;
      } else {
        factors.recency = 1;
      }
      score += factors.recency;

      // 7. Activity penalty (reduce score if no recent activity)
      const completedActivities = opp.activities?.filter((a: any) => a.completed_at) || [];
      if (completedActivities.length === 0 && createdDaysAgo > 2) {
        factors.no_activity_penalty = -5;
        score += factors.no_activity_penalty;
        reasons.push('Sem atividades - precisa atenção');
      }

      // 8. Contact role bonus
      const cargo = opp.contact?.cargo?.toLowerCase() || '';
      if (cargo.includes('diretor') || cargo.includes('ceo') || cargo.includes('owner') || cargo.includes('sócio')) {
        factors.decision_maker = 5;
        score += factors.decision_maker;
        reasons.push('Contato é decisor');
      } else if (cargo.includes('gerente') || cargo.includes('manager') || cargo.includes('head')) {
        factors.decision_maker = 3;
        score += factors.decision_maker;
      }

      // Normalize score to 0-100
      score = Math.min(100, Math.max(0, score));

      // Determine status based on score
      let status = 'Normal';
      if (score >= 80) status = 'Prioridade Máxima';
      else if (score >= 60) status = 'Alta Prioridade';
      else if (score >= 40) status = 'Média Prioridade';

      return {
        opportunity_id: opp.id,
        score,
        status,
        factors,
        reasons: reasons.slice(0, 3), // Top 3 reasons
        opportunity: opp
      };
    });

    // Sort by score descending
    prioritizedLeads.sort((a, b) => b.score - a.score);

    // Clear old prioritization scores for this user
    await supabase
      .from('ai_scores')
      .delete()
      .eq('organization_id', organizationId)
      .eq('entity_type', 'opportunity')
      .eq('score_type', 'lead_prioritization');

    // Insert new prioritization scores
    const scoresToInsert = prioritizedLeads.map(lead => ({
      organization_id: organizationId,
      entity_type: 'opportunity',
      entity_id: lead.opportunity_id,
      score_type: 'lead_prioritization',
      score: lead.score,
      status: lead.status,
      grade: lead.score >= 80 ? 'A' : lead.score >= 60 ? 'B' : lead.score >= 40 ? 'C' : 'D',
      factors: lead.factors,
      reasons: lead.reasons,
      recommendations: [
        lead.score >= 70 ? 'Contatar imediatamente' : 'Agendar follow-up',
        lead.factors.no_activity_penalty ? 'Registrar primeira atividade' : null,
        lead.factors.temperature <= 2 ? 'Aquecer lead com conteúdo' : null
      ].filter(Boolean),
      expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(), // 24h
      model_version: 'lead_prioritization_v1'
    }));

    const { error: insertError } = await supabase
      .from('ai_scores')
      .insert(scoresToInsert);

    if (insertError) {
      console.error('Error inserting scores:', insertError);
      throw insertError;
    }

    // Log AI usage
    await supabase.from('ai_usage_logs').insert({
      organization_id: organizationId,
      user_id: user.id,
      feature: 'lead_prioritization',
      action: 'generate',
      model_used: 'rule_based_v1',
      tokens_total: 0,
      volts_used: 0.5, // Low cost for rule-based
      success: true,
      request_metadata: { opportunities_count: opportunities.length }
    });

    console.log(`Generated ${prioritizedLeads.length} lead prioritization scores for user ${user.id}`);

    return new Response(JSON.stringify({
      success: true,
      message: `Priorizados ${prioritizedLeads.length} leads`,
      prioritized: prioritizedLeads.slice(0, 10).map(l => ({
        id: l.opportunity_id,
        score: l.score,
        status: l.status,
        reasons: l.reasons
      }))
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error in generate-lead-prioritization:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { 
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
