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

export async function getRanking(period: 'week' | 'month' | 'year' | 'all' = 'all') {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  // Build date filter
  let dateFilter = '';
  const now = new Date();
  if (period === 'week') {
    const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    dateFilter = `and(finished_at.gte.${weekAgo.toISOString()})`;
  } else if (period === 'month') {
    const monthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    dateFilter = `and(finished_at.gte.${monthAgo.toISOString()})`;
  } else if (period === 'year') {
    const yearAgo = new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000);
    dateFilter = `and(finished_at.gte.${yearAgo.toISOString()})`;
  }

  // Get current user's seller profile
  const { data: currentSeller } = await supabase
    .from('sellers')
    .select('id')
    .eq('user_id', user.id)
    .maybeSingle();

  // Get all sellers
  const { data: sellers, error } = await supabase
    .from('sellers')
    .select('id, name, user_id')
    .eq('active', true);

  if (error) throw error;

  // Get profiles separately
  const { data: profiles } = await supabase
    .from('profiles')
    .select('user_id, full_name, avatar_url');

  const profileMap = new Map(profiles?.map(p => [p.user_id, p]) || []);

  // Get session stats for each seller
  const sellersWithStats = await Promise.all(
    (sellers || []).map(async (seller) => {
      let query = supabase
        .from('roleplay_sessions')
        .select('id, score_overall, passed, finished_at')
        .eq('seller_id', seller.id)
        .not('finished_at', 'is', null);

      if (dateFilter) {
        const dateCondition = dateFilter.replace('and(finished_at.gte.', '').replace(')', '');
        query = query.gte('finished_at', dateCondition);
      }

      const { data: sessions } = await query;

      const totalSessions = sessions?.length || 0;
      const passedSessions = sessions?.filter(s => s.passed).length || 0;
      const avgScore = totalSessions > 0 
        ? sessions!.reduce((acc, s) => acc + (s.score_overall || 0), 0) / totalSessions 
        : 0;
      const approvalRate = totalSessions > 0 ? (passedSessions / totalSessions) * 100 : 0;
      
      const lastSession = sessions?.[0]?.finished_at || null;
      const profile = profileMap.get(seller.user_id);

      return {
        id: seller.id,
        name: profile?.full_name || seller.name,
        avatar_url: profile?.avatar_url,
        total_sessions: totalSessions,
        passed_sessions: passedSessions,
        avg_score: Math.round(avgScore * 10) / 10,
        approval_rate: Math.round(approvalRate),
        last_session: lastSession,
        is_current_user: seller.id === currentSeller?.id
      };
    })
  );

  // Sort by average score (descending)
  const sorted = sellersWithStats
    .filter(s => s.total_sessions > 0)
    .sort((a, b) => b.avg_score - a.avg_score);

  // Add position
  const withPosition = sorted.map((seller, index) => ({
    ...seller,
    position: index + 1
  }));

  return withPosition;
}