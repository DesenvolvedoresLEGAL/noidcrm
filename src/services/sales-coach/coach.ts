import { supabase } from '@/integrations/supabase/client';

export interface CoachInsights {
  greeting: string;
  overallAssessment: string;
  topStrengths: string[];
  priorityImprovements: string[];
  weeklyGoals: Array<{
    goal: string;
    metric: string;
    priority: 'alta' | 'média' | 'baixa';
  }>;
  coachingTips: string[];
  motivationalMessage: string;
  predictedProgress: string;
}

export interface SkillDimension {
  dimension: string;
  score: number;
  totalSessions: number;
}

export interface TrendData {
  date: string;
  avgScore: number;
  sessions: number;
}

export interface SalesCoachData {
  seller: {
    id: string;
    name: string;
    email: string;
  } | null;
  stats: {
    totalSessions: number;
    averageScore: number;
    passRate: number;
  };
  skills: SkillDimension[];
  trends: TrendData[];
  videoRecommendations: Array<{
    id: string;
    video_library: {
      id: string;
      title: string;
      url: string;
      duration_sec: number;
      level: string;
    };
  }>;
  coachInsights: CoachInsights;
}

export async function getSalesCoachData(sellerId: string): Promise<SalesCoachData> {
  const { data, error } = await supabase.functions.invoke('ai-sales-coach', {
    body: { sellerId }
  });

  if (error) {
    console.error('Error fetching sales coach data:', error);
    throw error;
  }

  if (!data?.success) {
    throw new Error(data?.error || 'Failed to fetch coach data');
  }

  return data.data;
}

export async function getSellerIdForCurrentUser(): Promise<string | null> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: seller } = await supabase
    .from('sellers')
    .select('id')
    .eq('user_id', user.id)
    .maybeSingle();

  return seller?.id || null;
}
