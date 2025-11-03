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
  const { data, error } = await supabase
    .from('roleplay_messages')
    .select('*')
    .eq('session_id', sessionId)
    .order('timestamp', { ascending: true });

  if (error) throw error;
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