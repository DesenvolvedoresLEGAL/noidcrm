import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
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
  // NEW: Internal vs External viewer tracking
  viewerType?: 'internal' | 'external';
  viewerUserId?: string | null;
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
  // Determine viewer type (default to external for safety)
  const viewerType = metadata?.viewerType || 'external';
  const viewerUserId = metadata?.viewerUserId || null;
  
  console.log(`[track-proposal-view] Creating ${viewerType} view for proposal ${proposalId} from IP ${clientIP}`);

  // For INTERNAL views (logged-in seller from same org): just record, no alerts/workflows
  if (viewerType === 'internal') {
    console.log(`[track-proposal-view] Internal view by user ${viewerUserId} - skipping alerts/workflows`);
    
    const deviceInfo = parseUserAgent(metadata?.userAgent || '');
    
    // Insert view record with internal marker
    const { data: viewData, error: viewError } = await supabase
      .from('proposal_views')
      .insert({
        proposal_id: proposalId,
        viewer_ip: clientIP,
        viewer_user_agent: metadata?.userAgent,
        device_type: deviceInfo.deviceType,
        browser: deviceInfo.browser,
        viewer_type: 'internal',
        viewer_user_id: viewerUserId,
        scroll_depth_percent: 0,
        sections_viewed: [],
        time_per_section: {},
        interactions: { clicks: 0, copied_text: false, downloaded_pdf: false, printed: false },
      })
      .select('id')
      .single();

    if (viewError) {
      console.error('Error inserting internal view:', viewError);
      throw viewError;
    }

    // Update proposal views count (but not status or triggers)
    const { data: current } = await supabase
      .from('proposals')
      .select('views_count')
      .eq('id', proposalId)
      .single();

    await supabase
      .from('proposals')
      .update({
        views_count: (current?.views_count || 0) + 1,
        last_viewed_at: new Date().toISOString(),
      })
      .eq('id', proposalId);

    return new Response(
      JSON.stringify({ success: true, viewId: viewData.id, viewerType: 'internal' }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  // For EXTERNAL views (client): full processing with alerts and workflows
  
  // Check if this is the FIRST external view for this proposal
  const { data: existingExternalViews, error: checkError } = await supabase
    .from('proposal_views')
    .select('id')
    .eq('proposal_id', proposalId)
    .eq('viewer_type', 'external')
    .limit(1);
  
  const isFirstExternalView = !existingExternalViews || existingExternalViews.length === 0;
  console.log(`[track-proposal-view] First external view: ${isFirstExternalView}`);

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
      viewer_type: 'external',
      viewer_user_id: null,
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

  // Create "viewing_now" alert for real-time notification (only for external views)
  await createViewingNowAlert(supabase, proposalId, metadata);

  // PRIME: Create notification_events + notifications_v2 for proposal_viewed
  await createProposalViewedNotification(supabase, proposalId);

  // Analyze behavior patterns and generate intelligent alerts
  await analyzeAndGenerateSmartAlerts(supabase, proposalId);

  // Trigger workflow for every external view, but dedupe per rule/proposal inside the dispatcher.
  // This repairs proposals whose first view happened while the workflow function was unavailable.
  console.log(`[track-proposal-view] Checking proposal_viewed workflow dispatch`);
  await triggerProposalViewedWorkflow(supabase, proposalId, isFirstExternalView);

  console.log('External view created successfully:', viewData.id);

  return new Response(
    JSON.stringify({ success: true, viewId: viewData.id, isForwarded, isFirstExternalView, viewerType: 'external' }),
    { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  );
}

// Trigger workflow rules for proposal_viewed event
async function triggerProposalViewedWorkflow(supabase: any, proposalId: string, isFirstExternalView: boolean) {
  try {
    // Get proposal with opportunity info
    const { data: proposal, error: proposalError } = await supabase
      .from('proposals')
      .select('id, opportunity_id, organization_id, title')
      .eq('id', proposalId)
      .single();

    if (proposalError || !proposal) {
      console.error('Error fetching proposal for workflow:', proposalError);
      return;
    }

    if (!proposal.opportunity_id) {
      console.log('[track-proposal-view] No opportunity_id linked to proposal, skipping workflow');
      return;
    }

    // Fetch workflow rules with trigger_type = 'proposal_viewed'
    const { data: rules, error: rulesError } = await supabase
      .from('workflow_rules')
      .select('*')
      .eq('organization_id', proposal.organization_id)
      .eq('trigger_type', 'proposal_viewed')
      .eq('is_active', true);

    if (rulesError) {
      console.error('Error fetching workflow rules:', rulesError);
      return;
    }

    if (!rules || rules.length === 0) {
      console.log('[track-proposal-view] No active proposal_viewed workflow rules found');
      return;
    }

    console.log(`[track-proposal-view] Found ${rules.length} proposal_viewed workflow rules`);

    // Create workflow execution for each matching rule
    for (const rule of rules) {
      // Check if trigger_config matches (e.g., specific pipeline/stage)
      const triggerConfig = rule.trigger_config || {};
      
      // V2: Validate both pipeline_id AND stage_id if configured
      if (triggerConfig.pipeline_id || triggerConfig.stage_id) {
        const { data: opportunity } = await supabase
          .from('opportunities')
          .select('pipeline_id, stage_id')
          .eq('id', proposal.opportunity_id)
          .single();
        
        // Check pipeline match
        if (triggerConfig.pipeline_id && opportunity?.pipeline_id !== triggerConfig.pipeline_id) {
          console.log(`[track-proposal-view] Skipping rule ${rule.name} - pipeline mismatch (expected: ${triggerConfig.pipeline_id}, got: ${opportunity?.pipeline_id})`);
          continue;
        }
        
        // V2: Check stage match (NEW!)
        if (triggerConfig.stage_id && opportunity?.stage_id !== triggerConfig.stage_id) {
          console.log(`[track-proposal-view] Skipping rule ${rule.name} - stage mismatch (expected: ${triggerConfig.stage_id}, got: ${opportunity?.stage_id})`);
          continue;
        }
      }

      const { data: existingExecution, error: existingError } = await supabase
        .from('workflow_executions')
        .select('id, status')
        .eq('workflow_rule_id', rule.id)
        .eq('opportunity_id', proposal.opportunity_id)
        .eq('trigger_type', 'proposal_viewed')
        .contains('trigger_data', { proposal_id: proposalId })
        .in('status', ['pending', 'running', 'completed', 'partial'])
        .limit(1)
        .maybeSingle();

      if (existingError) {
        console.error(`[track-proposal-view] Error checking existing workflow execution for rule ${rule.name}:`, existingError);
      }

      if (existingExecution) {
        console.log(`[track-proposal-view] Workflow ${rule.name} already dispatched for proposal ${proposalId} (${existingExecution.status})`);
        continue;
      }

      // Create workflow execution
      const { data: execution, error: execError } = await supabase
        .from('workflow_executions')
        .insert({
          workflow_rule_id: rule.id,
          organization_id: proposal.organization_id,
          opportunity_id: proposal.opportunity_id,
          trigger_type: 'proposal_viewed',
          trigger_data: { 
            proposal_id: proposalId, 
            proposal_title: proposal.title,
            first_external_view: isFirstExternalView,
            dispatch_reason: isFirstExternalView ? 'first_external_view' : 'retry_missing_execution',
          },
          status: 'pending',
        })
        .select('id')
        .single();

      if (execError) {
        console.error(`Error creating workflow execution for rule ${rule.name}:`, execError);
        continue;
      }

      console.log(`[track-proposal-view] Created workflow execution ${execution.id} for rule ${rule.name}`);

      // Invoke execute-workflow function with internal secret
      try {
        const { error: invokeError } = await supabase.functions.invoke('execute-workflow', {
          body: { execution_id: execution.id },
          headers: {
            'x-internal-secret': Deno.env.get('INTERNAL_WORKFLOW_SECRET') || ''
          }
        });
        
        if (invokeError) {
          console.error(`Error invoking execute-workflow:`, invokeError);
        } else {
          console.log(`[track-proposal-view] Successfully triggered workflow ${rule.name}`);
        }
      } catch (invokeErr) {
        console.error(`Error invoking execute-workflow:`, invokeErr);
      }
    }
  } catch (error) {
    console.error('Error in triggerProposalViewedWorkflow:', error);
  }
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

async function createViewingNowAlert(supabase: any, proposalId: string, metadata: ViewMetadata) {
  try {
    // Get proposal info
    const { data: proposal } = await supabase
      .from('proposals')
      .select('organization_id, title')
      .eq('id', proposalId)
      .single();

    if (!proposal) return;

    // Delete old viewing_now alerts (they're transient)
    await supabase
      .from('proposal_alerts')
      .delete()
      .eq('proposal_id', proposalId)
      .eq('alert_type', 'viewing_now')
      .lt('created_at', new Date(Date.now() - 5 * 60 * 1000).toISOString());

    // Create new viewing_now alert
    const locationInfo = metadata?.city ? ` de ${metadata.city}` : '';
    const deviceInfo = metadata?.deviceType ? ` (${metadata.deviceType})` : '';
    
    await supabase
      .from('proposal_alerts')
      .insert({
        proposal_id: proposalId,
        organization_id: proposal.organization_id,
        alert_type: 'viewing_now',
        title: '🔴 Cliente online AGORA!',
        message: `Alguém está visualizando a proposta "${proposal.title}"${locationInfo}${deviceInfo}. Momento ideal para contato!`,
        severity: 'critical',
        metadata: { 
          viewed_at: new Date().toISOString(),
          device_type: metadata?.deviceType,
          city: metadata?.city 
        },
      });

    console.log('Viewing now alert created for proposal:', proposalId);
  } catch (error) {
    console.error('Error creating viewing_now alert:', error);
  }
}

async function analyzeAndGenerateSmartAlerts(supabase: any, proposalId: string) {
  try {
    // Get proposal info including expires_at
    const { data: proposal } = await supabase
      .from('proposals')
      .select('organization_id, title, expires_at, status, created_at')
      .eq('id', proposalId)
      .single();

    if (!proposal) return;

    // Get all views for this proposal (only external views for analytics)
    const { data: views } = await supabase
      .from('proposal_views')
      .select('*')
      .eq('proposal_id', proposalId)
      .eq('viewer_type', 'external')
      .order('viewed_at', { ascending: false });

    if (!views || views.length === 0) return;

    // Get recent alerts to avoid duplicates
    const { data: recentAlerts } = await supabase
      .from('proposal_alerts')
      .select('alert_type')
      .eq('proposal_id', proposalId)
      .gte('created_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString());

    const recentAlertTypes = new Set((recentAlerts || []).map((a: any) => a.alert_type));

    // DEADLINE APPROACHING: Validade próxima + sem resposta
    if (proposal.expires_at && proposal.status !== 'accepted' && !recentAlertTypes.has('deadline_approaching')) {
      const expiresDate = new Date(proposal.expires_at);
      const daysUntilExpiry = Math.ceil((expiresDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24));
      
      if (daysUntilExpiry > 0 && daysUntilExpiry <= 3) {
        await supabase.from('proposal_alerts').insert({
          proposal_id: proposalId,
          organization_id: proposal.organization_id,
          alert_type: 'deadline_approaching',
          title: '⏰ Validade próxima!',
          message: `A proposta "${proposal.title}" expira em ${daysUntilExpiry} dia(s) e ainda não foi aceita. Entre em contato urgentemente!`,
          severity: 'warning',
          metadata: { days_until_expiry: daysUntilExpiry, expires_at: proposal.expires_at },
        });
      }
    }

    // COMPETITOR SIGNAL: Múltiplas visitas curtas (comparação)
    if (views.length >= 3 && !recentAlertTypes.has('competitor_signal')) {
      const recentViews = views.filter((v: any) => {
        const viewDate = new Date(v.viewed_at);
        return Date.now() - viewDate.getTime() < 24 * 60 * 60 * 1000; // Last 24h
      });
      
      const shortVisits = recentViews.filter((v: any) => (v.duration_seconds || 0) < 60);
      
      if (shortVisits.length >= 3) {
        await supabase.from('proposal_alerts').insert({
          proposal_id: proposalId,
          organization_id: proposal.organization_id,
          alert_type: 'competitor_signal',
          title: '⚔️ Possível comparação!',
          message: `Padrão de visitas curtas detectado (${shortVisits.length} visitas < 1 min). Cliente pode estar comparando com concorrentes.`,
          severity: 'warning',
          metadata: { short_visits_count: shortVisits.length },
        });
      }
    }

    // READY TO CLOSE: Alto engajamento + scroll completo + revisão de termos
    if (!recentAlertTypes.has('ready_to_close')) {
      const lastView = views[0];
      const scrollComplete = (lastView.scroll_depth_percent || 0) >= 90;
      const longDuration = (lastView.duration_seconds || 0) > 180; // > 3 min
      const viewedTerms = (lastView.sections_viewed || []).some((s: string) => 
        s.toLowerCase().includes('terms') || s.toLowerCase().includes('termos')
      );
      
      if (scrollComplete && longDuration && views.length >= 2) {
        await supabase.from('proposal_alerts').insert({
          proposal_id: proposalId,
          organization_id: proposal.organization_id,
          alert_type: 'ready_to_close',
          title: '✅ Pronto para fechar!',
          message: `Cliente demonstra alto interesse: leu ${lastView.scroll_depth_percent}% da proposta em ${Math.round((lastView.duration_seconds || 0) / 60)} min. Contate agora!`,
          severity: 'success',
          metadata: { 
            scroll_depth: lastView.scroll_depth_percent, 
            duration: lastView.duration_seconds,
            total_views: views.length 
          },
        });
      }
    }

    // HIGH ENGAGEMENT: Multiple views with good engagement
    if (views.length >= 3 && !recentAlertTypes.has('high_engagement')) {
      const avgDuration = views.reduce((sum: number, v: any) => sum + (v.duration_seconds || 0), 0) / views.length;
      if (avgDuration > 60) {
        await supabase.from('proposal_alerts').insert({
          proposal_id: proposalId,
          organization_id: proposal.organization_id,
          alert_type: 'high_engagement',
          title: '🔥 Alto engajamento!',
          message: `Proposta visualizada ${views.length} vezes com média de ${Math.round(avgDuration / 60)} min por visita. Cliente muito interessado!`,
          severity: 'success',
          metadata: { view_count: views.length, avg_duration: avgDuration },
        });
      }
    }

  } catch (error) {
    console.error('Error generating smart alerts:', error);
  }
}

async function createProposalViewedNotification(supabase: any, proposalId: string) {
  try {
    const { data: proposal, error: pErr } = await supabase
      .from('proposals')
      .select('id, title, proposal_number, organization_id, opportunity_id')
      .eq('id', proposalId)
      .single();

    if (pErr || !proposal) {
      console.error('[PRIME notification] proposal not found', pErr);
      return;
    }

    let companyName = 'Cliente';
    let ownerId: string | null = null;
    let managerId: string | null = null;

    if (proposal.opportunity_id) {
      const { data: opp } = await supabase
        .from('opportunities')
        .select('owner_user_id, account_id')
        .eq('id', proposal.opportunity_id)
        .single();

      ownerId = opp?.owner_user_id || null;

      if (opp?.account_id) {
        const { data: acc } = await supabase
          .from('accounts')
          .select('razao_social, nome_fantasia')
          .eq('id', opp.account_id)
          .single();
        companyName = acc?.nome_fantasia || acc?.razao_social || 'Cliente';
      }

      // Resolve manager via team membership (teams.manager_id references auth.users.id directly)
      if (ownerId) {
        const { data: teamRows } = await supabase
          .from('team_members')
          .select('teams!inner(manager_id)')
          .eq('user_id', ownerId)
          .eq('organization_id', proposal.organization_id);

        managerId = (teamRows || [])
          .map((r: any) => r.teams?.manager_id)
          .find((m: string | null) => m && m !== ownerId) || null;
      }
    }

    const viewedAt = new Date().toISOString();
    const proposalLabel = proposal.proposal_number || proposal.title || proposalId;

    // 0. Dedup centralizado (10min por proposta)
    const dedupKey = `proposal_viewed:${proposalId}`;
    const { data: lockAcquired } = await supabase.rpc('try_acquire_dedup_lock', {
      p_organization_id: proposal.organization_id,
      p_dedup_key: dedupKey,
      p_event_type: 'proposal_viewed',
      p_window_seconds: 600,
    });

    if (!lockAcquired) {
      console.log(`[PRIME notification] [dedup] skipped ${dedupKey}`);
      return;
    }

    // 1. Create notification_event
    const { data: evt, error: evtErr } = await supabase
      .from('notification_events')
      .insert({
        event_type: 'proposal_viewed',
        entity_type: 'proposal',
        entity_id: proposalId,
        proposal_id: proposalId,
        opportunity_id: proposal.opportunity_id,
        organization_id: proposal.organization_id,
        payload: {
          proposal_id: proposalId,
          proposal_number: proposalLabel,
          company_name: companyName,
          opportunity_id: proposal.opportunity_id,
          viewed_at: viewedAt,
        },
      })
      .select('id')
      .single();

    if (evtErr) {
      console.error('[PRIME notification] event insert error', evtErr);
      return;
    }

    // 2. Resolve recipients + check settings
    const recipientIds = [ownerId, managerId].filter(Boolean) as string[];
    const uniqueRecipients = [...new Set(recipientIds)];

    for (const userId of uniqueRecipients) {
      const { data: settings } = await supabase
        .from('notification_settings')
        .select('proposal_view_alert_enabled, realtime_in_app_enabled, realtime_email_enabled')
        .eq('user_id', userId)
        .maybeSingle();

      const alertEnabled = settings?.proposal_view_alert_enabled ?? true;
      if (!alertEnabled) continue;

      const channelInApp = settings?.realtime_in_app_enabled ?? true;
      const channelEmail = settings?.realtime_email_enabled ?? false;

      const actionUrl = proposal.opportunity_id
        ? `/app/opportunities/${proposal.opportunity_id}`
        : null;

      const { error: nErr } = await supabase
        .from('notifications_v2')
        .insert({
          user_id: userId,
          event_id: evt.id,
          type: 'proposal_viewed',
          title: 'Proposta visualizada',
          message: `${companyName} abriu a proposta ${proposalLabel} agora.`,
          priority: 'high',
          channel_in_app: channelInApp,
          channel_email: channelEmail,
          channel_push: false,
          status: 'pending',
          action_url: actionUrl,
        });

      if (nErr) {
        console.error(`[PRIME notification] insert error for ${userId}`, nErr);
      } else {
        console.log(`[PRIME notification] proposal_viewed notification created for ${userId}`);
      }
    }
  } catch (error) {
    console.error('[PRIME notification] Error:', error);
  }
}