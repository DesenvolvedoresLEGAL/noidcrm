import { supabase } from '@/integrations/supabase/client';

export interface TimelineEvent {
  type: 'activity' | 'note' | 'email' | 'audit' | 'proposal' | 'file' | 'automation' | 'agent_approval';
  id: string;
  timestamp: string;
  title: string;
  activity_type: string;
  owner_user_id: string | null;
  opportunity_id: string | null;
  account_id: string | null;
  contact_id: string | null;
  organization_id: string;
  deleted_at: string | null;
  metadata: any;
}

export async function getUnifiedTimeline(params: {
  opportunity_id?: string;
  account_id?: string;
  contact_id?: string;
  limit?: number;
} = {}): Promise<TimelineEvent[]> {
  let query = supabase
    .from('unified_timeline')
    .select('type, id, timestamp, title, activity_type, owner_user_id, opportunity_id, account_id, contact_id, organization_id, deleted_at, metadata');

  if (params.opportunity_id) {
    query = query.eq('opportunity_id', params.opportunity_id);
  }

  if (params.account_id) {
    query = query.eq('account_id', params.account_id);
  }

  if (params.contact_id) {
    query = query.eq('contact_id', params.contact_id);
  }

  const { data, error } = await query
    .order('timestamp', { ascending: false })
    .limit(params.limit || 100);

  if (error) throw error;
  return data as TimelineEvent[];
}
