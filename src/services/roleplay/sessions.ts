import { supabase } from '@/integrations/supabase/client';

export interface CreateSessionParams {
  sellerId: string;
  icpId: string;
  archetypeId: string;
  rubricId: string;
  organizationId: string;
}

export interface SendMessageParams {
  sessionId: string;
  sender: 'seller' | 'ai_client';
  content: string;
}

export async function createSession(params: CreateSessionParams) {
  const sessionId = crypto.randomUUID();
  
  const { data, error } = await supabase
    .from('roleplay_sessions')
    .insert({
      id: sessionId,
      seller_id: params.sellerId,
      icp_id: params.icpId,
      archetype_id: params.archetypeId,
      rubric_id: params.rubricId,
      organization_id: params.organizationId,
      started_at: new Date().toISOString()
    })
    .select()
    .single();

  if (error) {
    console.error('[createSession] Error:', error);
    throw error;
  }
  
  console.log('[createSession] Success:', sessionId);
  return data;
}

export async function getSession(sessionId: string) {
  const { data, error } = await supabase
    .from('roleplay_sessions')
    .select(`
      *,
      simulated_clients(*),
      icp_profiles(*),
      client_archetypes(*),
      evaluation_rubrics(*)
    `)
    .eq('id', sessionId)
    .single();

  if (error) throw error;
  return data;
}

export async function sendMessage(params: SendMessageParams) {
  const messageId = crypto.randomUUID();
  
  console.log('[sendMessage] Creating message:', {
    id: messageId,
    sender: params.sender,
    contentLength: params.content.length
  });
  
  const { data, error } = await supabase
    .from('roleplay_messages')
    .insert({
      id: messageId,
      session_id: params.sessionId,
      sender: params.sender,
      content: params.content,
      timestamp: new Date().toISOString()
    })
    .select()
    .single();

  if (error) {
    console.error('[sendMessage] Error:', error);
    throw error;
  }
  
  console.log('[sendMessage] Success:', messageId);

  // Update exchanges count
  const { data: session } = await supabase
    .from('roleplay_sessions')
    .select('exchanges_count')
    .eq('id', params.sessionId)
    .single();

  if (session) {
    await supabase
      .from('roleplay_sessions')
      .update({ 
        exchanges_count: (session.exchanges_count || 0) + 1 
      })
      .eq('id', params.sessionId);
  }

  return data;
}

export async function getSessionMessages(sessionId: string) {
  // CRÍTICO: Verificar se há sessão de auth ativa antes de buscar
  const { data: { session: authSession } } = await supabase.auth.getSession();
  
  if (!authSession) {
    console.error('[getSessionMessages] No auth session - user not authenticated');
    throw new Error('Sessão expirada. Faça login novamente.');
  }
  
  console.log('[getSessionMessages] Auth OK, fetching messages for session:', sessionId);
  
  const { data, error } = await supabase
    .from('roleplay_messages')
    .select('*')
    .eq('session_id', sessionId)
    .order('timestamp', { ascending: true });

  if (error) {
    console.error('[getSessionMessages] Query error:', error);
    throw error;
  }
  
  console.log('[getSessionMessages] Found', data?.length || 0, 'messages');
  return data || [];
}

export async function endSession(sessionId: string) {
  const { data, error } = await supabase
    .from('roleplay_sessions')
    .update({ 
      finished_at: new Date().toISOString() 
    })
    .eq('id', sessionId)
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function listMySessions(sellerId: string) {
  const { data, error } = await supabase
    .from('roleplay_sessions')
    .select(`
      *,
      simulated_clients(*),
      icp_profiles(name),
      client_archetypes(name)
    `)
    .eq('seller_id', sellerId)
    .order('started_at', { ascending: false });

  if (error) throw error;
  return data || [];
}

export async function listAllOrgSessions(organizationId: string) {
  const { data, error } = await supabase
    .from('roleplay_sessions')
    .select(`
      *,
      sellers(profiles(full_name)),
      simulated_clients(fake_name),
      icp_profiles(name),
      client_archetypes(name, level)
    `)
    .eq('organization_id', organizationId)
    .order('started_at', { ascending: false });

  if (error) throw error;
  return data || [];
}

export async function deleteSession(sessionId: string) {
  // Delete related data first (cascading)
  // Messages
  await supabase
    .from('roleplay_messages')
    .delete()
    .eq('session_id', sessionId);
  
  // Performance insights
  await supabase
    .from('performance_insights')
    .delete()
    .eq('session_id', sessionId);
  
  // Video recommendations
  await supabase
    .from('video_recommendations')
    .delete()
    .eq('session_id', sessionId);
  
  // Seller badges unlocked by this session
  await supabase
    .from('seller_badges')
    .delete()
    .contains('metadata', { unlockedBy: sessionId });
  
  // Finally delete the session
  const { error } = await supabase
    .from('roleplay_sessions')
    .delete()
    .eq('id', sessionId);

  if (error) throw error;
}

export async function deleteMultipleSessions(sessionIds: string[]) {
  for (const sessionId of sessionIds) {
    await deleteSession(sessionId);
  }
}