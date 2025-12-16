import { supabase } from '@/integrations/supabase/client';

export type InteractionChannel = 
  | 'email' | 'phone' | 'whatsapp' | 'linkedin' | 'meeting' 
  | 'form' | 'chat' | 'website' | 'proposal' | 'contract' | 'other';

export type InteractionType = 
  | 'call_made' | 'call_received' | 'call_missed'
  | 'email_sent' | 'email_received' | 'email_opened' | 'email_clicked'
  | 'meeting_scheduled' | 'meeting_held' | 'meeting_canceled' | 'meeting_no_show'
  | 'message_sent' | 'message_received'
  | 'form_submitted' | 'chat_started'
  | 'proposal_sent' | 'proposal_viewed' | 'proposal_accepted' | 'proposal_rejected'
  | 'contract_sent' | 'contract_signed'
  | 'linkedin_connection' | 'linkedin_message'
  | 'website_visit' | 'demo_requested'
  | 'note_added' | 'task_completed'
  | 'other';

export interface Interaction {
  id: string;
  organization_id: string;
  account_id?: string;
  contact_id?: string;
  opportunity_id?: string;
  actor_user_id?: string;
  actor_type: 'user' | 'system' | 'automation' | 'external';
  channel: InteractionChannel;
  direction: 'inbound' | 'outbound' | 'bidirectional';
  interaction_type: InteractionType;
  subject?: string;
  content?: string;
  summary?: string;
  duration_seconds?: number;
  sentiment?: 'positive' | 'neutral' | 'negative' | 'unknown';
  sentiment_score?: number;
  engagement_score?: number;
  metadata?: Record<string, any>;
  external_id?: string;
  source?: string;
  activity_id?: string;
  occurred_at: string;
  created_at: string;
  updated_at: string;
  trace_id?: string;
  // Joined data
  actor?: { full_name: string; avatar_url?: string };
  contact?: { nome: string };
  account?: { razao_social: string; nome_fantasia?: string };
}

export interface ListInteractionsParams {
  account_id?: string;
  contact_id?: string;
  opportunity_id?: string;
  channel?: InteractionChannel;
  interaction_type?: InteractionType;
  sentiment?: string;
  start_date?: string;
  end_date?: string;
  limit?: number;
}

export async function listInteractions(params: ListInteractionsParams = {}): Promise<Interaction[]> {
  let query = supabase
    .from('interactions')
    .select(`
      *,
      contact:contacts(nome),
      account:accounts(razao_social, nome_fantasia)
    `)
    .order('occurred_at', { ascending: false });

  if (params.account_id) {
    query = query.eq('account_id', params.account_id);
  }
  if (params.contact_id) {
    query = query.eq('contact_id', params.contact_id);
  }
  if (params.opportunity_id) {
    query = query.eq('opportunity_id', params.opportunity_id);
  }
  if (params.channel) {
    query = query.eq('channel', params.channel);
  }
  if (params.interaction_type) {
    query = query.eq('interaction_type', params.interaction_type);
  }
  if (params.sentiment) {
    query = query.eq('sentiment', params.sentiment);
  }
  if (params.start_date) {
    query = query.gte('occurred_at', params.start_date);
  }
  if (params.end_date) {
    query = query.lte('occurred_at', params.end_date);
  }
  if (params.limit) {
    query = query.limit(params.limit);
  }

  const { data, error } = await query;
  
  if (error) {
    console.error('Error fetching interactions:', error);
    throw error;
  }

  // Fetch actor profiles
  const actorIds = [...new Set((data || []).map(i => i.actor_user_id).filter(Boolean))];
  let actorProfiles: Record<string, { full_name: string; avatar_url?: string }> = {};
  
  if (actorIds.length > 0) {
    const { data: profiles } = await supabase
      .from('profiles')
      .select('user_id, full_name, avatar_url')
      .in('user_id', actorIds);
    
    if (profiles) {
      actorProfiles = profiles.reduce((acc, p) => {
        acc[p.user_id] = { full_name: p.full_name || 'Usuário', avatar_url: p.avatar_url || undefined };
        return acc;
      }, {} as Record<string, { full_name: string; avatar_url?: string }>);
    }
  }

  return (data || []).map(i => ({
    ...i,
    actor: i.actor_user_id ? actorProfiles[i.actor_user_id] : undefined,
  })) as Interaction[];
}

export async function createInteraction(interaction: Omit<Interaction, 'id' | 'created_at' | 'updated_at'>): Promise<Interaction> {
  const { data: membership } = await supabase.rpc('get_user_organization_id');
  
  const { data, error } = await supabase
    .from('interactions')
    .insert({
      ...interaction,
      organization_id: interaction.organization_id || membership,
    })
    .select()
    .single();

  if (error) {
    console.error('Error creating interaction:', error);
    throw error;
  }

  return data as Interaction;
}

export async function countInteractionsByOpportunity(opportunityId: string): Promise<number> {
  const { count, error } = await supabase
    .from('interactions')
    .select('*', { count: 'exact', head: true })
    .eq('opportunity_id', opportunityId);

  if (error) {
    console.error('Error counting interactions:', error);
    return 0;
  }

  return count || 0;
}

export async function getInteractionStats(opportunityId: string): Promise<{
  total: number;
  by_channel: Record<string, number>;
  by_sentiment: Record<string, number>;
  avg_engagement: number;
}> {
  const { data, error } = await supabase
    .from('interactions')
    .select('channel, sentiment, engagement_score')
    .eq('opportunity_id', opportunityId);

  if (error || !data) {
    return { total: 0, by_channel: {}, by_sentiment: {}, avg_engagement: 0 };
  }

  const by_channel: Record<string, number> = {};
  const by_sentiment: Record<string, number> = {};
  let totalEngagement = 0;

  data.forEach(i => {
    by_channel[i.channel] = (by_channel[i.channel] || 0) + 1;
    if (i.sentiment) {
      by_sentiment[i.sentiment] = (by_sentiment[i.sentiment] || 0) + 1;
    }
    totalEngagement += i.engagement_score || 0;
  });

  return {
    total: data.length,
    by_channel,
    by_sentiment,
    avg_engagement: data.length > 0 ? Math.round(totalEngagement / data.length) : 0,
  };
}
