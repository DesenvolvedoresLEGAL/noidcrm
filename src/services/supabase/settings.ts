import { supabase } from '@/integrations/supabase/client';

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

export async function saveSettings(section: string, key: string, value: any): Promise<Settings> {
  const { data: { user } } = await supabase.auth.getUser();
  
  if (!user) throw new Error('User not authenticated');

  // Get user's organization_id
  const { data: memberData } = await supabase
    .from('organization_members')
    .select('organization_id')
    .eq('user_id', user.id)
    .eq('status', 'active')
    .maybeSingle();

  const { data, error } = await supabase
    .from('settings')
    .upsert({
      section,
      key,
      value,
      user_id: user.id,
      organization_id: memberData?.organization_id,
    }, {
      onConflict: 'section,key,user_id'
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
