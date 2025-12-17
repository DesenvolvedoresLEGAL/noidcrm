import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface RiskAlert {
  type: 'warning' | 'danger' | 'opportunity';
  title: string;
  description: string;
  pattern: string;
  recommendation: string;
  confidence: number;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { opportunityId, organizationId } = await req.json();
    
    if (!opportunityId || !organizationId) {
      throw new Error('opportunityId and organizationId are required');
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    console.log(`Analyzing risk for opportunity: ${opportunityId}`);

    // Fetch the opportunity with details
    const { data: opportunity, error: oppError } = await supabase
      .from('opportunities')
      .select(`
        *,
        account:accounts(segmento, porte, cnae),
        stage:stages(name, order_index),
        pipeline:pipelines(name, pipeline_type)
      `)
      .eq('id', opportunityId)
      .single();

    if (oppError || !opportunity) {
      throw new Error('Opportunity not found');
    }

    // Fetch win/loss patterns from the last 12 months
    const oneYearAgo = new Date();
    oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);

    const { data: winLossRecords } = await supabase
      .from('win_loss_records')
      .select(`
        *,
        opportunity:opportunities(
          valor_previsto,
          account:accounts(segmento, porte)
        ),
        reason:loss_reasons(name),
        win_reason:win_reasons(name)
      `)
      .eq('organization_id', organizationId)
      .gte('created_at', oneYearAgo.toISOString());

    const wins = winLossRecords?.filter(r => r.outcome === 'won') || [];
    const losses = winLossRecords?.filter(r => r.outcome === 'lost') || [];

    // Analyze patterns
    const alerts: RiskAlert[] = [];

    // ========== PATTERN 1: Segment Win Rate ==========
    const oppSegment = (opportunity.account as any)?.segmento;
    if (oppSegment) {
      const segmentWins = wins.filter(w => (w.opportunity as any)?.account?.segmento === oppSegment).length;
      const segmentLosses = losses.filter(l => (l.opportunity as any)?.account?.segmento === oppSegment).length;
      const totalSegment = segmentWins + segmentLosses;
      
      if (totalSegment >= 3) {
        const segmentWinRate = segmentWins / totalSegment;
        if (segmentWinRate < 0.3) {
          alerts.push({
            type: 'danger',
            title: 'Segmento de Baixo Win Rate',
            description: `Historicamente temos apenas ${Math.round(segmentWinRate * 100)}% de win rate no segmento "${oppSegment}"`,
            pattern: `${segmentWins}W/${segmentLosses}L em ${oppSegment}`,
            recommendation: 'Considere priorizar outros deals ou investigar objeções específicas deste segmento',
            confidence: Math.min(totalSegment / 10, 1)
          });
        } else if (segmentWinRate > 0.6) {
          alerts.push({
            type: 'opportunity',
            title: 'Segmento de Alto Win Rate',
            description: `Temos ${Math.round(segmentWinRate * 100)}% de win rate no segmento "${oppSegment}"`,
            pattern: `${segmentWins}W/${segmentLosses}L em ${oppSegment}`,
            recommendation: 'Priorize este deal - histórico favorável neste segmento',
            confidence: Math.min(totalSegment / 10, 1)
          });
        }
      }
    }

    // ========== PATTERN 2: Deal Size Risk ==========
    const oppValue = opportunity.valor_previsto || 0;
    const avgWonValue = wins.length > 0 
      ? wins.reduce((sum, w) => sum + (w.final_value || 0), 0) / wins.length 
      : 0;
    const avgLostValue = losses.length > 0
      ? losses.reduce((sum, l) => sum + (l.final_value || 0), 0) / losses.length
      : 0;

    if (oppValue > avgWonValue * 2 && avgWonValue > 0) {
      alerts.push({
        type: 'warning',
        title: 'Deal Acima da Média',
        description: `Este deal (R$ ${oppValue.toLocaleString('pt-BR')}) é ${Math.round(oppValue / avgWonValue)}x maior que nossa média de ganhos`,
        pattern: `Média ganhos: R$ ${avgWonValue.toLocaleString('pt-BR')}`,
        recommendation: 'Deals maiores precisam de mais stakeholders envolvidos e ciclo de venda mais longo',
        confidence: 0.7
      });
    }

    // ========== PATTERN 3: Common Loss Factors ==========
    const lossFactorCounts = {
      price: losses.filter(l => l.price_factor).length,
      timing: losses.filter(l => l.timing_factor).length,
      feature: losses.filter(l => l.feature_factor).length,
      relationship: losses.filter(l => l.relationship_factor).length
    };
    
    const totalFactors = Object.values(lossFactorCounts).reduce((a, b) => a + b, 0);
    if (totalFactors >= 5) {
      const dominantFactor = Object.entries(lossFactorCounts).sort((a, b) => b[1] - a[1])[0];
      const factorPercentage = Math.round((dominantFactor[1] / totalFactors) * 100);
      
      if (factorPercentage >= 40) {
        const factorLabels: Record<string, string> = {
          price: 'Preço',
          timing: 'Timing',
          feature: 'Produto/Funcionalidades',
          relationship: 'Atendimento/Relacionamento'
        };
        
        const factorRecommendations: Record<string, string> = {
          price: 'Prepare justificativa de ROI e considere descontos estratégicos',
          timing: 'Valide o timing de compra do cliente e crie urgência',
          feature: 'Foque nos features que temos e demonstre roadmap',
          relationship: 'Aumente touchpoints e envolva mais stakeholders'
        };

        alerts.push({
          type: 'warning',
          title: `Principal Causa de Perda: ${factorLabels[dominantFactor[0]]}`,
          description: `${factorPercentage}% das perdas são relacionadas a ${factorLabels[dominantFactor[0]].toLowerCase()}`,
          pattern: `${dominantFactor[1]} de ${totalFactors} perdas`,
          recommendation: factorRecommendations[dominantFactor[0]],
          confidence: 0.8
        });
      }
    }

    // ========== PATTERN 4: Competitor Alert ==========
    const competitorCounts: Record<string, number> = {};
    losses.filter(l => l.competitor).forEach(l => {
      competitorCounts[l.competitor!] = (competitorCounts[l.competitor!] || 0) + 1;
    });

    const topCompetitors = Object.entries(competitorCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3);

    if (topCompetitors.length > 0) {
      alerts.push({
        type: 'warning',
        title: 'Principais Concorrentes',
        description: `Perdemos mais deals para: ${topCompetitors.map(([c, n]) => `${c} (${n}x)`).join(', ')}`,
        pattern: `${losses.filter(l => l.competitor).length} perdas com concorrente identificado`,
        recommendation: 'Pergunte ao cliente se está avaliando concorrentes e prepare battlecards',
        confidence: 0.6
      });
    }

    // ========== PATTERN 5: Win Patterns to Replicate ==========
    const winReasonCounts: Record<string, number> = {};
    wins.forEach(w => {
      const reason = (w.win_reason as any)?.name;
      if (reason) {
        winReasonCounts[reason] = (winReasonCounts[reason] || 0) + 1;
      }
    });

    const topWinReasons = Object.entries(winReasonCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3);

    if (topWinReasons.length > 0) {
      alerts.push({
        type: 'opportunity',
        title: 'Padrões de Vitória',
        description: `Principais motivos de ganho: ${topWinReasons.map(([r, n]) => `${r} (${n}x)`).join(', ')}`,
        pattern: `${wins.length} vitórias analisadas`,
        recommendation: `Enfatize "${topWinReasons[0][0]}" durante a negociação`,
        confidence: 0.75
      });
    }

    // ========== PATTERN 6: Key Differentiators ==========
    const differentiatorCounts: Record<string, number> = {};
    wins.forEach(w => {
      if (w.key_differentiator) {
        const diffs = w.key_differentiator.split(',').map((d: string) => d.trim());
        diffs.forEach((diff: string) => {
          if (diff) {
            differentiatorCounts[diff] = (differentiatorCounts[diff] || 0) + 1;
          }
        });
      }
    });

    const topDiffs = Object.entries(differentiatorCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3);

    if (topDiffs.length > 0) {
      alerts.push({
        type: 'opportunity',
        title: 'Diferenciais que Fecham Negócios',
        description: `Clientes destacam: ${topDiffs.map(([d, n]) => d).join(', ')}`,
        pattern: `Coletado de ${wins.filter(w => w.key_differentiator).length} vitórias`,
        recommendation: `Destaque "${topDiffs[0][0]}" na sua apresentação`,
        confidence: 0.8
      });
    }

    // Sort alerts: danger first, then warning, then opportunity
    const alertOrder = { danger: 0, warning: 1, opportunity: 2 };
    alerts.sort((a, b) => alertOrder[a.type] - alertOrder[b.type]);

    console.log(`Generated ${alerts.length} alerts for opportunity ${opportunityId}`);

    return new Response(JSON.stringify({
      success: true,
      opportunityId,
      alerts,
      stats: {
        totalWins: wins.length,
        totalLosses: losses.length,
        winRate: wins.length + losses.length > 0 
          ? Math.round(wins.length / (wins.length + losses.length) * 100) 
          : 0
      }
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error in analyze-opportunity-risk:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { 
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
