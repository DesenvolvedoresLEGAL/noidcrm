import { supabase } from '@/integrations/supabase/client';
import { z } from 'zod';

export interface OpportunityEmail {
  id: string;
  opportunity_id: string;
  organization_id: string;
  subject: string;
  body: string;
  from_email: string;
  to_emails: string[];
  cc_emails: string[];
  sent_at: string;
  sent_by: string;
  created_at: string;
  updated_at: string;
  opened_at: string | null;
  opened_count: number;
  clicked_at: string | null;
  link_clicks: Array<{ url: string; clicked_at: string; user_agent?: string }> | null;
  direction: 'inbound' | 'outbound';
  gmail_message_id: string | null;
  gmail_thread_id: string | null;
  in_reply_to: string | null;
  sender?: {
    full_name: string;
    avatar_url?: string;
  };
}

const emailSchema = z.object({
  opportunity_id: z.string().uuid(),
  subject: z.string().min(1, 'Assunto é obrigatório'),
  body: z.string().min(1, 'Corpo do e-mail é obrigatório'),
  from_email: z.string().email('E-mail inválido'),
  to_emails: z.array(z.string().email()).min(1, 'Pelo menos um destinatário é obrigatório'),
  cc_emails: z.array(z.string().email()).optional(),
});

export async function listOpportunityEmails(opportunityId: string): Promise<OpportunityEmail[]> {
  const { data, error } = await supabase
    .from('opportunity_emails')
    .select(`
      *,
      sender:profiles!opportunity_emails_sent_by_profiles_fkey(full_name, avatar_url)
    `)
    .eq('opportunity_id', opportunityId)
    .order('sent_at', { ascending: false });

  if (error) throw error;
  return (data as unknown) as OpportunityEmail[];
}

export async function createOpportunityEmail(dto: unknown): Promise<OpportunityEmail> {
  const validated = emailSchema.parse(dto);
  
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('User not authenticated');

  const { data: orgId, error: orgError } = await supabase.rpc('get_user_organization_id');

  if (orgError || !orgId) {
    throw new Error('User must belong to an organization to send emails');
  }

  const { data, error } = await supabase
    .from('opportunity_emails')
    .insert([{
      opportunity_id: validated.opportunity_id,
      subject: validated.subject,
      body: validated.body,
      from_email: validated.from_email,
      to_emails: validated.to_emails,
      cc_emails: validated.cc_emails || [],
      sent_by: user.id,
      organization_id: orgId,
      direction: 'outbound' as const,
    }])
    .select(`
      *,
      sender:profiles!opportunity_emails_sent_by_profiles_fkey(full_name, avatar_url)
    `)
    .single();

  if (error) throw error;
  return (data as unknown) as OpportunityEmail;
}

export async function deleteOpportunityEmail(id: string): Promise<void> {
  const { error } = await supabase
    .from('opportunity_emails')
    .delete()
    .eq('id', id);

  if (error) throw error;
}

export async function syncEmailReplies(opportunityId?: string): Promise<{ synced: number }> {
  const { data, error } = await supabase.functions.invoke('sync-email-replies', {
    body: { opportunity_id: opportunityId },
  });

  if (error) throw error;
  return data;
}
