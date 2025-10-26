import { supabase } from '@/integrations/supabase/client';

export async function getCurrentSeller() {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  const { data, error } = await supabase
    .from('sellers')
    .select('*')
    .eq('user_id', user.id)
    .maybeSingle();

  if (error) throw error;
  
  // If seller doesn't exist, create one
  if (!data) {
    const { data: profile } = await supabase
      .from('profiles')
      .select('full_name, organization_id')
      .eq('user_id', user.id)
      .single();

    const { data: newSeller, error: createError } = await supabase
      .from('sellers')
      .insert({
        user_id: user.id,
        name: profile?.full_name || user.email?.split('@')[0] || 'Vendedor',
        email: user.email!,
        organization_id: profile?.organization_id,
        role: 'SDR',
        active: true
      })
      .select()
      .single();

    if (createError) throw createError;
    return newSeller;
  }

  return data;
}

export async function getSellerStats(sellerId: string, period: string) {
  const { data, error } = await supabase
    .from('seller_stats')
    .select('*')
    .eq('seller_id', sellerId)
    .eq('period', period)
    .maybeSingle();

  if (error) throw error;
  return data;
}

export async function listICPs() {
  const { data, error } = await supabase
    .from('icp_profiles')
    .select('*');

  if (error) throw error;
  return data || [];
}

export async function listArchetypes() {
  const { data, error } = await supabase
    .from('client_archetypes')
    .select('*');

  if (error) throw error;
  return data || [];
}

export async function listRubrics() {
  const { data, error } = await supabase
    .from('evaluation_rubrics')
    .select('*');

  if (error) throw error;
  return data || [];
}