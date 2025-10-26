import { supabase } from '@/integrations/supabase/client';
import { z } from 'zod';

const settingsSchema = z.object({
  section: z.string().min(1, 'Section is required').max(100),
  key: z.string().min(1, 'Key is required').max(100),
  value: z.unknown(), // Can be any JSON value
});

export interface Settings {
  id: string;
  section: string;
  payload: any;
  updated_at: string;
}

export async function getSettings(section?: string): Promise<any> {
  let query = supabase
    .from('settings')
    .select('*');

  if (section) {
    query = query.eq('section', section);
  }

  const { data, error } = await query;

  if (error) throw error;

  if (!data || data.length === 0) {
    return section ? {} : {};
  }

  if (section) {
    const settings: any = {};
    data.forEach(item => {
      settings[item.key] = item.value;
    });
    return settings;
  }

  const allSettings: any = {};
  data.forEach(item => {
    if (!allSettings[item.section]) {
      allSettings[item.section] = {};
    }
    allSettings[item.section][item.key] = item.value;
  });

  return allSettings;
}

export async function saveSettings(section: string, key: string, value: unknown): Promise<Settings> {
  // Validate input
  settingsSchema.parse({ section, key, value });
  
  const { data: { user } } = await supabase.auth.getUser();
  
  if (!user) throw new Error('User not authenticated');

  // Get user's organization_id
  const { data: memberData } = await supabase
    .from('organization_members')
    .select('organization_id')
    .eq('user_id', user.id)
    .eq('status', 'active')
    .maybeSingle();

  if (!memberData?.organization_id) {
    throw new Error('User must belong to an organization to save settings');
  }

  const { data, error } = await supabase
    .from('settings')
    .upsert({
      section,
      key,
      value: value as any,
      user_id: user.id,
      organization_id: memberData.organization_id,
    })
    .select()
    .single();

  if (error) throw error;

  return {
    id: data.id,
    section: data.section,
    payload: data.value as any,
    updated_at: data.updated_at,
  };
}
