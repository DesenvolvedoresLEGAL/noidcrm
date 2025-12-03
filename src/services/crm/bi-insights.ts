import { supabase } from '@/integrations/supabase/client';

export interface AIInsight {
  type: 'success' | 'warning' | 'opportunity' | 'risk';
  title: string;
  description: string;
  recommendation: string;
  impact: 'high' | 'medium' | 'low';
}

export interface AIKPI {
  label: string;
  value: string;
  trend: 'up' | 'down' | 'stable';
  context: string;
}

export interface AIPrediction {
  metric: string;
  prediction: string;
  confidence: 'high' | 'medium' | 'low';
  timeframe: string;
}

export interface BIInsightsResponse {
  success: boolean;
  data: {
    summary: string;
    insights: AIInsight[];
    kpis: AIKPI[];
    predictions: AIPrediction[];
  };
  generatedAt: string;
  dataContext: {
    totalOpenOpportunities: number;
    totalPipelineValue: number;
    avgDealSize: number;
    winRate: string;
    wonCount: number;
    lostCount: number;
    hotDeals: number;
    atRiskDeals: number;
  };
}

export async function generateBIInsights(insightType: string = 'general'): Promise<BIInsightsResponse> {
  const { data, error } = await supabase.functions.invoke('ai-bi-insights', {
    body: { insightType }
  });

  if (error) {
    console.error('Error generating BI insights:', error);
    throw new Error(error.message || 'Failed to generate insights');
  }

  return data;
}
