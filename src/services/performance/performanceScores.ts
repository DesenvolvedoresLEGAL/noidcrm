import { supabase } from '@/integrations/supabase/client';

export interface ScoreExplainability {
  breakdown: Record<string, {
    value: number;
    weight: number;
    contribution: number;
    label?: string;
  }>;
  increased_by: string[];
  decreased_by: string[];
  how_to_improve: string[];
}

export interface PerformanceScore {
  id: string;
  seller_id: string;
  cs_final: number | null;
  bs_final: number | null;
  ds_final: number | null;
  ras_final: number | null;
  ras_status: string | null;
  cs_7d: number | null;
  cs_30d: number | null;
  cs_90d: number | null;
  bs_7d: number | null;
  bs_30d: number | null;
  bs_90d: number | null;
  ds_7d: number | null;
  ds_30d: number | null;
  ds_90d: number | null;
  cs_breakdown: any;
  bs_breakdown: any;
  ds_breakdown: any;
  ras_breakdown: any;
  cs_explainability?: ScoreExplainability | null;
  bs_explainability?: ScoreExplainability | null;
  ds_explainability?: ScoreExplainability | null;
  ras_explainability?: ScoreExplainability | null;
  calculated_at: string | null;
  organization_id: string;
}

export interface ScoreBreakdown {
  score: string;
  label: string;
  value: number | null;
  trend: 'up' | 'down' | 'stable';
  trendValue: number;
  color: string;
  icon: string;
  description: string;
  breakdown?: any;
  explainability?: ScoreExplainability | null;
}

export interface DynamicMission {
  id: string;
  seller_id: string;
  mission_type: string;
  target_score: string | null;
  current_value: number | null;
  target_value: number | null;
  description: string;
  xp_reward: number;
  xp_weighted: number | null;
  activity_weight: number | null;
  is_gap_correction: boolean | null;
  expires_at: string | null;
  completed: boolean | null;
  completed_at: string | null;
  organization_id: string;
  created_at: string | null;
}

export async function getSellerPerformanceScores(sellerId: string): Promise<PerformanceScore | null> {
  const { data, error } = await supabase
    .from('seller_performance_scores')
    .select('*')
    .eq('seller_id', sellerId)
    .order('calculated_at', { ascending: false })
    .limit(1)
    .single();

  if (error) {
    console.error('Error fetching performance scores:', error);
    return null;
  }

  // Cast JSON fields to proper types
  return {
    ...data,
    cs_explainability: data.cs_explainability as unknown as ScoreExplainability | null,
    bs_explainability: data.bs_explainability as unknown as ScoreExplainability | null,
    ds_explainability: data.ds_explainability as unknown as ScoreExplainability | null,
    ras_explainability: data.ras_explainability as unknown as ScoreExplainability | null,
  } as PerformanceScore;
}

export async function getTeamPerformanceScores(organizationId: string): Promise<(PerformanceScore & { seller: { name: string; avatar_url: string | null } })[]> {
  const { data, error } = await supabase
    .from('seller_performance_scores')
    .select(`
      *,
      seller:sellers(name, avatar_url)
    `)
    .eq('organization_id', organizationId)
    .order('ras_final', { ascending: false });

  if (error) {
    console.error('Error fetching team performance scores:', error);
    return [];
  }

  return data as any[];
}

export async function getPerformanceHistory(sellerId: string, days: number = 30): Promise<any[]> {
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - days);

  const { data, error } = await supabase
    .from('seller_performance_scores')
    .select('cs_final, bs_final, ds_final, ras_final, calculated_at')
    .eq('seller_id', sellerId)
    .gte('calculated_at', startDate.toISOString())
    .order('calculated_at', { ascending: true });

  if (error) {
    console.error('Error fetching performance history:', error);
    return [];
  }

  return data || [];
}

export async function getSellerDynamicMissions(sellerId: string): Promise<DynamicMission[]> {
  const { data, error } = await supabase
    .from('dynamic_missions')
    .select('*')
    .eq('seller_id', sellerId)
    .eq('completed', false)
    .order('expires_at', { ascending: true });

  if (error) {
    console.error('Error fetching dynamic missions:', error);
    return [];
  }

  return data as DynamicMission[];
}

export async function generateMissionsForSeller(sellerId: string): Promise<DynamicMission[]> {
  const { data, error } = await supabase.rpc('generate_dynamic_missions', {
    p_seller_id: sellerId
  });

  if (error) {
    console.error('Error generating dynamic missions:', error);
    return [];
  }

  return data as DynamicMission[];
}

export function getScoreColor(score: number | null): string {
  if (score === null) return 'text-muted-foreground';
  if (score >= 85) return 'text-green-500';
  if (score >= 70) return 'text-yellow-500';
  if (score >= 50) return 'text-orange-500';
  return 'text-red-500';
}

export function getScoreBgColor(score: number | null): string {
  if (score === null) return 'bg-muted';
  if (score >= 85) return 'bg-green-500/10';
  if (score >= 70) return 'bg-yellow-500/10';
  if (score >= 50) return 'bg-orange-500/10';
  return 'bg-red-500/10';
}

export function getScoreLabel(score: number | null): string {
  if (score === null) return 'N/A';
  if (score >= 85) return 'Excelente';
  if (score >= 70) return 'Bom';
  if (score >= 50) return 'Regular';
  return 'Crítico';
}

export function calculateTrend(current: number | null, previous: number | null): { trend: 'up' | 'down' | 'stable'; trendValue: number } {
  if (current === null || previous === null) return { trend: 'stable', trendValue: 0 };
  const diff = current - previous;
  if (Math.abs(diff) < 1) return { trend: 'stable', trendValue: 0 };
  return {
    trend: diff > 0 ? 'up' : 'down',
    trendValue: Math.abs(diff)
  };
}

export function getScoreBreakdowns(scores: PerformanceScore | null): ScoreBreakdown[] {
  if (!scores) return [];

  const cs7d = scores.cs_7d || 0;
  const bs7d = scores.bs_7d || 0;
  const ds7d = scores.ds_7d || 0;

  return [
    {
      score: 'CS',
      label: 'Capacitação Score',
      value: scores.cs_final,
      ...calculateTrend(scores.cs_final, cs7d),
      color: getScoreColor(scores.cs_final),
      icon: 'GraduationCap',
      description: 'Mede a participação em treinamentos e simulações',
      breakdown: scores.cs_breakdown,
      explainability: scores.cs_explainability
    },
    {
      score: 'BS',
      label: 'Behavior Score',
      value: scores.bs_final,
      ...calculateTrend(scores.bs_final, bs7d),
      color: getScoreColor(scores.bs_final),
      icon: 'Activity',
      description: 'Avalia atividades e comportamento de vendas',
      breakdown: scores.bs_breakdown,
      explainability: scores.bs_explainability
    },
    {
      score: 'DS',
      label: 'Deal Score',
      value: scores.ds_final,
      ...calculateTrend(scores.ds_final, ds7d),
      color: getScoreColor(scores.ds_final),
      icon: 'Target',
      description: 'Qualidade e saúde do pipeline',
      breakdown: scores.ds_breakdown,
      explainability: scores.ds_explainability
    },
    {
      score: 'RAS',
      label: 'Rep Alignment Score',
      value: scores.ras_final,
      trend: 'stable',
      trendValue: 0,
      color: getScoreColor(scores.ras_final),
      icon: 'Gauge',
      description: `Status: ${scores.ras_status || 'N/A'}`,
      breakdown: scores.ras_breakdown,
      explainability: scores.ras_explainability
    }
  ];
}

// Helper function to generate explainability from breakdown data
export function generateExplainability(
  scoreType: 'CS' | 'BS' | 'DS' | 'RAS',
  currentValue: number | null,
  previousValue: number | null,
  breakdownData: any
): ScoreExplainability {
  const increased_by: string[] = [];
  const decreased_by: string[] = [];
  const how_to_improve: string[] = [];
  const breakdown: Record<string, { value: number; weight: number; contribution: number; label: string }> = {};

  const diff = (currentValue || 0) - (previousValue || 0);

  // Parse breakdown data and generate explanations
  if (breakdownData && typeof breakdownData === 'object') {
    Object.entries(breakdownData).forEach(([key, value]: [string, any]) => {
      if (typeof value === 'object' && value !== null) {
        breakdown[key] = {
          value: value.value || 0,
          weight: value.weight || 0,
          contribution: value.contribution || (value.value * value.weight * 100) || 0,
          label: value.label || formatKeyToLabel(key)
        };
      }
    });
  }

  // Generate contextual explanations based on score type
  switch (scoreType) {
    case 'CS':
      if (diff > 0) {
        increased_by.push(`Sessões de roleplay concluídas (+${Math.abs(diff).toFixed(1)} pontos)`);
      } else if (diff < 0) {
        decreased_by.push(`Menos atividades de capacitação (${diff.toFixed(1)} pontos)`);
      }
      if ((currentValue || 0) < 70) {
        how_to_improve.push('Complete 2 sessões de roleplay para ganhar ~8 pontos');
        how_to_improve.push('Atinja nota ≥8 nos próximos roleplays para bônus de +5 pontos');
      }
      break;
    case 'BS':
      if (diff > 0) {
        increased_by.push(`Aumento na frequência de atividades (+${Math.abs(diff).toFixed(1)} pontos)`);
      } else if (diff < 0) {
        decreased_by.push(`Queda de atividade vs semana passada (${diff.toFixed(1)} pontos)`);
      }
      if ((currentValue || 0) < 70) {
        how_to_improve.push('Registre 5 atividades hoje para ganhar ~4 pontos');
        how_to_improve.push('Mantenha consistência diária para bônus de streak +10 pontos');
      }
      break;
    case 'DS':
      if (diff > 0) {
        increased_by.push(`Melhora na saúde do pipeline (+${Math.abs(diff).toFixed(1)} pontos)`);
      } else if (diff < 0) {
        decreased_by.push(`Aumento no aging de oportunidades (${diff.toFixed(1)} pontos)`);
      }
      if ((currentValue || 0) < 70) {
        how_to_improve.push('Atualize 5 oportunidades estagnadas para ganhar ~6 pontos');
        how_to_improve.push('Mova 3 deals para próxima fase para +4 pontos');
      }
      break;
    case 'RAS':
      if (diff > 0) {
        increased_by.push(`Melhora geral nos indicadores (+${Math.abs(diff).toFixed(1)} pontos)`);
      } else if (diff < 0) {
        decreased_by.push(`Queda em um ou mais indicadores (${diff.toFixed(1)} pontos)`);
      }
      if ((currentValue || 0) < 70) {
        how_to_improve.push('Foque no indicador mais baixo para maior impacto');
        how_to_improve.push('Mantenha todos os scores acima de 60 para status "BOM"');
      }
      break;
  }

  return { breakdown, increased_by, decreased_by, how_to_improve };
}

function formatKeyToLabel(key: string): string {
  return key
    .replace(/_/g, ' ')
    .replace(/([A-Z])/g, ' $1')
    .split(' ')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(' ')
    .trim();
}

export async function getAtRiskSellers(organizationId: string): Promise<any[]> {
  const { data, error } = await supabase
    .from('seller_performance_scores')
    .select(`
      *,
      seller:sellers(id, name, avatar_url, user_id)
    `)
    .eq('organization_id', organizationId)
    .or('cs_final.lt.65,bs_final.lt.60,ds_final.lt.50,ras_status.eq.CRÍTICO')
    .order('ras_final', { ascending: true });

  if (error) {
    console.error('Error fetching at-risk sellers:', error);
    return [];
  }

  return data || [];
}

export async function getCoachingSuggestions(scores: PerformanceScore): Promise<string[]> {
  const suggestions: string[] = [];

  if (scores.cs_final !== null && scores.cs_final < 65) {
    suggestions.push('Agendar sessões de roleplay para melhorar técnicas de vendas');
    suggestions.push('Revisar módulos de treinamento com baixa participação');
  }

  if (scores.bs_final !== null && scores.bs_final < 60) {
    suggestions.push('Aumentar frequência de atividades de prospecção');
    suggestions.push('Revisar metas diárias de ligações e emails');
  }

  if (scores.ds_final !== null && scores.ds_final < 50) {
    suggestions.push('Reduzir aging médio do pipeline - focar em deals estagnados');
    suggestions.push('Qualificar melhor novas oportunidades antes de adicionar ao pipeline');
  }

  if (scores.ras_status === 'CRÍTICO') {
    suggestions.push('Coaching intensivo imediato necessário');
    suggestions.push('Reunião 1:1 para entender bloqueios e desafios');
  }

  return suggestions;
}
