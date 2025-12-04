import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Rate limiting store
const rateLimitStore = new Map<string, { count: number; resetTime: number }>();
const RATE_LIMIT = 10; // Max 10 requests per minute per IP per proposal
const RATE_WINDOW = 60000; // 1 minute

interface ViewMetadata {
  ip?: string;
  userAgent?: string;
  scrollDepthPercent?: number;
  sectionsViewed?: string[];
  timePerSection?: Record<string, number>;
  interactions?: {
    clicks?: number;
    copiedText?: boolean;
    downloadedPdf?: boolean;
    printed?: boolean;
  };
  referrer?: string;
  viewportWidth?: number;
  viewportHeight?: number;
  sessionId?: string;
  durationSeconds?: number;
  deviceType?: string;
  browser?: string;
  country?: string;
  city?: string;
}

interface EventData {
  proposalId: string;
  sessionId: string;
  eventType: 'scroll' | 'click' | 'section_enter' | 'section_exit' | 'copy' | 'download' | 'print';
  eventData?: Record<string, any>;
  viewId?: string;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body = await req.json();
    const { proposalId, metadata, action, events } = body;

    // Input validation
    if (!proposalId || typeof proposalId !== 'string') {
      return new Response(
        JSON.stringify({ error: 'ID da proposta inválido' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Validate UUID format
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(proposalId)) {
      return new Response(
        JSON.stringify({ error: 'Formato de ID inválido' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Rate limiting by IP + proposalId
    const clientIP = req.headers.get('x-forwarded-for')?.split(',')[0] || 'unknown';
    const rateLimitKey = `${clientIP}:${proposalId}`;
    const now = Date.now();
    const rateLimitData = rateLimitStore.get(rateLimitKey);

    if (rateLimitData) {
      if (now < rateLimitData.resetTime) {
        if (rateLimitData.count >= RATE_LIMIT) {
          console.warn(`[track-proposal-view] Rate limit exceeded for ${rateLimitKey}`);
          return new Response(
            JSON.stringify({ error: 'Muitas requisições. Aguarde um momento.' }),
            { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }
        rateLimitData.count++;
      } else {
        rateLimitData.count = 1;
        rateLimitData.resetTime = now + RATE_WINDOW;
      }
    } else {
      rateLimitStore.set(rateLimitKey, { count: 1, resetTime: now + RATE_WINDOW });
    }

    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Handle different actions
    if (action === 'track_events' && events && Array.isArray(events)) {
      // Batch insert events
      return await handleTrackEvents(supabaseClient, proposalId, events, corsHeaders);
    }

    if (action === 'update_view') {
      // Update existing view with final data
      return await handleUpdateView(supabaseClient, proposalId, metadata as ViewMetadata, corsHeaders);
    }

    // Default: Create new view
    return await handleCreateView(supabaseClient, proposalId, clientIP, metadata as ViewMetadata, corsHeaders);

  } catch (error) {
    console.error('Error in track-proposal-view:', error);
    return new Response(
      JSON.stringify({ error: 'Erro ao processar requisição' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

async function handleCreateView(
  supabase: any,
  proposalId: string,
  clientIP: string,
  metadata: ViewMetadata,
  corsHeaders: Record<string, string>
) {
  console.log(`[track-proposal-view] Creating view for proposal ${proposalId} from IP ${clientIP}`);

  // Check if this is potentially a forwarded proposal
  const { data: isForwarded } = await supabase.rpc('detect_proposal_forward', {
    p_proposal_id: proposalId,
    p_viewer_ip: clientIP
  });

  // Parse device info from user agent
  const deviceInfo = parseUserAgent(metadata?.userAgent || '');

  // Insert view record with enhanced data
  const { data: viewData, error: viewError } = await supabase
    .from('proposal_views')
    .insert({
      proposal_id: proposalId,
      viewer_ip: clientIP,
      viewer_user_agent: metadata?.userAgent,
      device_type: deviceInfo.deviceType,
      browser: deviceInfo.browser,
      referrer: metadata?.referrer,
      is_forwarded: isForwarded || false,
      viewport_width: metadata?.viewportWidth,
      viewport_height: metadata?.viewportHeight,
      session_id: metadata?.sessionId,
      scroll_depth_percent: 0,
      sections_viewed: [],
      time_per_section: {},
      interactions: { clicks: 0, copied_text: false, downloaded_pdf: false, printed: false },
    })
    .select('id')
    .single();

  if (viewError) {
    console.error('Error inserting view:', viewError);
    throw viewError;
  }

  // Update proposal views count
  const { data: current, error: fetchError } = await supabase
    .from('proposals')
    .select('views_count')
    .eq('id', proposalId)
    .single();

  if (fetchError) {
    console.error('Error fetching proposal:', fetchError);
    throw fetchError;
  }

  const { error: updateError } = await supabase
    .from('proposals')
    .update({
      views_count: (current?.views_count || 0) + 1,
      last_viewed_at: new Date().toISOString(),
    })
    .eq('id', proposalId);

  if (updateError) {
    console.error('Error updating proposal:', updateError);
    throw updateError;
  }

  // If forwarded, create an alert
  if (isForwarded) {
    await createForwardAlert(supabase, proposalId);
  }

  console.log('View created successfully:', viewData.id);

  return new Response(
    JSON.stringify({ success: true, viewId: viewData.id, isForwarded }),
    { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  );
}

async function handleUpdateView(
  supabase: any,
  proposalId: string,
  metadata: ViewMetadata,
  corsHeaders: Record<string, string>
) {
  if (!metadata?.sessionId) {
    return new Response(
      JSON.stringify({ error: 'Session ID obrigatório para atualização' }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  console.log(`[track-proposal-view] Updating view for session ${metadata.sessionId}`);

  // Find the view by session_id
  const { data: existingView, error: findError } = await supabase
    .from('proposal_views')
    .select('id, interactions')
    .eq('proposal_id', proposalId)
    .eq('session_id', metadata.sessionId)
    .order('viewed_at', { ascending: false })
    .limit(1)
    .single();

  if (findError || !existingView) {
    console.log('View not found for session, creating new one');
    return new Response(
      JSON.stringify({ error: 'Visualização não encontrada' }),
      { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  // Merge interactions
  const currentInteractions = existingView.interactions || {};
  const newInteractions = {
    clicks: Math.max(currentInteractions.clicks || 0, metadata.interactions?.clicks || 0),
    copied_text: currentInteractions.copied_text || metadata.interactions?.copiedText || false,
    downloaded_pdf: currentInteractions.downloaded_pdf || metadata.interactions?.downloadedPdf || false,
    printed: currentInteractions.printed || metadata.interactions?.printed || false,
  };

  // Update the view with final data
  const { error: updateError } = await supabase
    .from('proposal_views')
    .update({
      scroll_depth_percent: metadata.scrollDepthPercent || 0,
      sections_viewed: metadata.sectionsViewed || [],
      time_per_section: metadata.timePerSection || {},
      interactions: newInteractions,
      duration_seconds: metadata.durationSeconds || 0,
      view_end_at: new Date().toISOString(),
      section_views: metadata.timePerSection || {},
    })
    .eq('id', existingView.id);

  if (updateError) {
    console.error('Error updating view:', updateError);
    throw updateError;
  }

  console.log('View updated successfully');

  return new Response(
    JSON.stringify({ success: true }),
    { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  );
}

async function handleTrackEvents(
  supabase: any,
  proposalId: string,
  events: EventData[],
  corsHeaders: Record<string, string>
) {
  console.log(`[track-proposal-view] Tracking ${events.length} events for proposal ${proposalId}`);

  // Find the view_id for the session
  let viewId = events[0]?.viewId;

  if (!viewId && events[0]?.sessionId) {
    const { data: view } = await supabase
      .from('proposal_views')
      .select('id')
      .eq('proposal_id', proposalId)
      .eq('session_id', events[0].sessionId)
      .order('viewed_at', { ascending: false })
      .limit(1)
      .single();
    
    viewId = view?.id;
  }

  // Prepare events for insertion
  const eventRecords = events.map(event => ({
    proposal_id: proposalId,
    view_id: viewId,
    session_id: event.sessionId,
    event_type: event.eventType,
    event_data: event.eventData || {},
    timestamp: new Date().toISOString(),
  }));

  // Batch insert events
  const { error: insertError } = await supabase
    .from('proposal_view_events')
    .insert(eventRecords);

  if (insertError) {
    console.error('Error inserting events:', insertError);
    // Don't fail completely, just log
  }

  return new Response(
    JSON.stringify({ success: true, eventsTracked: events.length }),
    { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  );
}

async function createForwardAlert(supabase: any, proposalId: string) {
  try {
    // Get proposal and organization info
    const { data: proposal } = await supabase
      .from('proposals')
      .select('organization_id, title')
      .eq('id', proposalId)
      .single();

    if (!proposal) return;

    // Check if we already have a forward alert recently
    const { data: existingAlert } = await supabase
      .from('proposal_alerts')
      .select('id')
      .eq('proposal_id', proposalId)
      .eq('alert_type', 'forwarded')
      .gte('created_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString())
      .limit(1);

    if (existingAlert && existingAlert.length > 0) return;

    // Create forward alert
    await supabase
      .from('proposal_alerts')
      .insert({
        proposal_id: proposalId,
        organization_id: proposal.organization_id,
        alert_type: 'forwarded',
        title: 'Proposta encaminhada',
        message: `A proposta "${proposal.title}" parece ter sido compartilhada com outra pessoa!`,
        severity: 'info',
        metadata: { detected_at: new Date().toISOString() },
      });

    console.log('Forward alert created for proposal:', proposalId);
  } catch (error) {
    console.error('Error creating forward alert:', error);
  }
}

function parseUserAgent(userAgent: string): { deviceType: string; browser: string } {
  const ua = userAgent.toLowerCase();
  
  // Device type detection
  let deviceType = 'desktop';
  if (/mobile|android|iphone|ipad|ipod|blackberry|iemobile|opera mini/i.test(ua)) {
    if (/tablet|ipad/i.test(ua)) {
      deviceType = 'tablet';
    } else {
      deviceType = 'mobile';
    }
  }

  // Browser detection
  let browser = 'unknown';
  if (ua.includes('firefox')) browser = 'Firefox';
  else if (ua.includes('edg')) browser = 'Edge';
  else if (ua.includes('chrome') && !ua.includes('edg')) browser = 'Chrome';
  else if (ua.includes('safari') && !ua.includes('chrome')) browser = 'Safari';
  else if (ua.includes('opera') || ua.includes('opr')) browser = 'Opera';

  return { deviceType, browser };
}
