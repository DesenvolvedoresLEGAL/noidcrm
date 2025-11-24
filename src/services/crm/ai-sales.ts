import { supabase } from '@/integrations/supabase/client';

export interface DealScore {
  score: number;
  confidence: 'low' | 'medium' | 'high';
  factors: {
    positive: string[];
    negative: string[];
    neutral: string[];
  };
  recommendations: string[];
  risk_level: 'low' | 'medium' | 'high';
  key_insights: string;
}

export interface NextAction {
  priority: 'high' | 'medium' | 'low';
  type: 'call' | 'email' | 'meeting' | 'proposal' | 'follow-up';
  title: string;
  description: string;
  reason: string;
  timing: 'now' | 'today' | 'this-week' | 'next-week';
  estimated_impact: 'low' | 'medium' | 'high';
}

export interface NextActions {
  actions: NextAction[];
  urgency_level: 'low' | 'medium' | 'high';
  overall_strategy: string;
}

export interface EmailAssist {
  subject: string;
  body: string;
  tone: 'professional' | 'friendly' | 'formal';
  cta: string;
  alternatives: Array<{
    subject: string;
    body: string;
  }>;
}

export interface MeetingPrep {
  executive_summary: string;
  key_points: string[];
  talking_points: Array<{
    topic: string;
    points: string[];
    questions: string[];
  }>;
  objectives: string[];
  potential_objections: Array<{
    objection: string;
    response: string;
  }>;
  dos_and_donts: {
    dos: string[];
    donts: string[];
  };
  next_steps_to_propose: string[];
}

export interface ObjectionHandler {
  objection_type: 'price' | 'timing' | 'competition' | 'authority' | 'need';
  severity: 'low' | 'medium' | 'high';
  recommended_approach: string;
  responses: Array<{
    technique: string;
    response: string;
    rationale: string;
    follow_up_questions: string[];
  }>;
  dos: string[];
  donts: string[];
  supporting_evidence: string[];
  alternative_approaches: string[];
}

export async function scoreDeal(opportunityId: string): Promise<DealScore> {
  const { data, error } = await supabase.functions.invoke('ai-score-deal', {
    body: { opportunityId }
  });

  if (error) throw error;
  return data as DealScore;
}

export async function getNextActions(opportunityId: string): Promise<NextActions> {
  const { data, error } = await supabase.functions.invoke('ai-next-action', {
    body: { opportunityId }
  });

  if (error) throw error;
  return data as NextActions;
}

export async function generateEmail(
  opportunityId: string,
  emailType?: string,
  context?: string,
  previousEmail?: string
): Promise<EmailAssist> {
  const { data, error } = await supabase.functions.invoke('ai-email-assist', {
    body: { opportunityId, emailType, context, previousEmail }
  });

  if (error) throw error;
  return data as EmailAssist;
}

export async function prepareMeeting(
  opportunityId: string,
  meetingType?: string
): Promise<MeetingPrep> {
  const { data, error } = await supabase.functions.invoke('ai-meeting-prep', {
    body: { opportunityId, meetingType }
  });

  if (error) throw error;
  return data as MeetingPrep;
}

export async function handleObjection(
  opportunityId: string,
  objection: string,
  context?: string
): Promise<ObjectionHandler> {
  const { data, error } = await supabase.functions.invoke('ai-handle-objection', {
    body: { opportunityId, objection, context }
  });

  if (error) throw error;
  return data as ObjectionHandler;
}
