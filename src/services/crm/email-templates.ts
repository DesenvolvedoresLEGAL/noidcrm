import { supabase } from '@/integrations/supabase/client';

export interface EmailTemplate {
  id: string;
  organization_id: string;
  name: string;
  subject: string;
  body: string;
  variables: string[];
  category: 'follow_up' | 'proposal' | 'closing' | 'introduction' | 'other' | null;
  created_by: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export async function listEmailTemplates(category?: string): Promise<EmailTemplate[]> {
  let query = supabase
    .from('email_templates')
    .select('*')
    .eq('is_active', true);

  if (category) {
    query = query.eq('category', category);
  }

  const { data, error } = await query.order('name');

  if (error) throw error;
  return data as EmailTemplate[];
}

export async function getEmailTemplate(id: string): Promise<EmailTemplate | null> {
  const { data, error } = await supabase
    .from('email_templates')
    .select('*')
    .eq('id', id)
    .maybeSingle();

  if (error) throw error;
  return data as EmailTemplate | null;
}

export async function createEmailTemplate(template: {
  name: string;
  subject: string;
  body: string;
  variables?: string[];
  category?: string;
}): Promise<EmailTemplate> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('User not authenticated');

  const { data: orgId } = await supabase.rpc('get_user_organization_id');
  if (!orgId) throw new Error('Organization not found');

  const { data, error } = await supabase
    .from('email_templates')
    .insert({
      organization_id: orgId,
      name: template.name,
      subject: template.subject,
      body: template.body,
      variables: template.variables || [],
      category: template.category,
      created_by: user.id,
    })
    .select()
    .single();

  if (error) throw error;
  return data as EmailTemplate;
}

export async function updateEmailTemplate(
  id: string,
  updates: Partial<EmailTemplate>
): Promise<EmailTemplate> {
  const { data, error } = await supabase
    .from('email_templates')
    .update(updates)
    .eq('id', id)
    .select()
    .single();

  if (error) throw error;
  return data as EmailTemplate;
}

export async function deleteEmailTemplate(id: string): Promise<void> {
  const { error } = await supabase
    .from('email_templates')
    .delete()
    .eq('id', id);

  if (error) throw error;
}

export function renderEmailTemplate(template: EmailTemplate, variables: Record<string, string>): { subject: string; body: string } {
  let subject = template.subject;
  let body = template.body;

  Object.entries(variables).forEach(([key, value]) => {
    const regex = new RegExp(`{{${key}}}`, 'g');
    subject = subject.replace(regex, value);
    body = body.replace(regex, value);
  });

  return { subject, body };
}
