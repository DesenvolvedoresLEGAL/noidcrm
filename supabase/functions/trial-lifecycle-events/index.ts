import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// Humanoid organization constants
const HUMANOID_ORG_ID = '774d7d78-8257-4891-aac7-718039b80049';

interface TrialLifecycleRequest {
  organization_id: string;
  event_type: 'trial_expired' | 'trial_extended' | 'trial_reactivated' | 'trial_converted' | 'trial_cancelled';
  new_trial_end_date?: string;
  conversion_data?: {
    plan: string;
    mrr_value: number;
    arr_value: number;
  };
  reason?: string;
}

Deno.serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('[trial-lifecycle-events] Processing trial lifecycle event...');
    
    const payload: TrialLifecycleRequest = await req.json();
    console.log('[trial-lifecycle-events] Received payload:', JSON.stringify(payload, null, 2));

    const { organization_id, event_type, new_trial_end_date, conversion_data, reason } = payload;

    // Validate required fields
    if (!organization_id || !event_type) {
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: 'Missing required fields: organization_id, event_type' 
        }),
        { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    // Create Supabase client with service role
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    // Find the PLG opportunity for this organization
    const { data: opportunity, error: findError } = await supabase
      .from('opportunities')
      .select('id, title, trial_status, trial_start_date, trial_end_date, stage_id, pipeline_id')
      .eq('plg_organization_id', organization_id)
      .is('deleted_at', null)
      .maybeSingle();

    if (findError) {
      console.error('[trial-lifecycle-events] Error finding opportunity:', findError);
      return new Response(
        JSON.stringify({ success: false, error: 'Failed to find opportunity', details: findError }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!opportunity) {
      console.warn('[trial-lifecycle-events] No PLG opportunity found for organization:', organization_id);
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: 'No PLG opportunity found for this organization' 
        }),
        { 
          status: 404, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    console.log('[trial-lifecycle-events] Found opportunity:', opportunity.id);

    // Process based on event type
    let updateData: Record<string, any> = {
      updated_at: new Date().toISOString()
    };

    let auditAction = event_type;
    let auditMetadata: Record<string, any> = {
      event_type,
      origin: 'system',
      timestamp: new Date().toISOString(),
      previous_trial_status: opportunity.trial_status
    };

    switch (event_type) {
      case 'trial_expired':
        // PROMPT MASTER: NÃO mover para perdido, apenas atualizar status
        updateData.trial_status = 'expired';
        auditMetadata.note = 'Trial expirado - aguardando ação humana ou playbook de reativação';
        break;

      case 'trial_extended':
        if (!new_trial_end_date) {
          return new Response(
            JSON.stringify({ 
              success: false, 
              error: 'new_trial_end_date is required for trial_extended event' 
            }),
            { 
              status: 400, 
              headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
            }
          );
        }
        updateData.trial_status = 'active';
        updateData.trial_end_date = new_trial_end_date;
        auditMetadata.previous_end_date = opportunity.trial_end_date;
        auditMetadata.new_end_date = new_trial_end_date;
        break;

      case 'trial_reactivated':
        updateData.trial_status = 'active';
        if (new_trial_end_date) {
          updateData.trial_end_date = new_trial_end_date;
          auditMetadata.new_end_date = new_trial_end_date;
        }
        auditMetadata.reactivation_reason = reason || 'User request';
        break;

      case 'trial_converted':
        updateData.trial_status = 'converted';
        updateData.status = 'won';
        if (conversion_data) {
          updateData.mrr_value = conversion_data.mrr_value;
          updateData.arr_value = conversion_data.arr_value;
          auditMetadata.conversion_plan = conversion_data.plan;
          auditMetadata.mrr_value = conversion_data.mrr_value;
          auditMetadata.arr_value = conversion_data.arr_value;
        }
        break;

      case 'trial_cancelled':
        updateData.trial_status = 'cancelled';
        auditMetadata.cancellation_reason = reason || 'Not specified';
        break;

      default:
        return new Response(
          JSON.stringify({ 
            success: false, 
            error: `Unknown event type: ${event_type}` 
          }),
          { 
            status: 400, 
            headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
          }
        );
    }

    // Update the opportunity
    const { error: updateError } = await supabase
      .from('opportunities')
      .update(updateData)
      .eq('id', opportunity.id);

    if (updateError) {
      console.error('[trial-lifecycle-events] Error updating opportunity:', updateError);
      return new Response(
        JSON.stringify({ success: false, error: 'Failed to update opportunity', details: updateError }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Log the event in audit_log
    const { error: auditError } = await supabase
      .from('audit_log')
      .insert({
        organization_id: HUMANOID_ORG_ID,
        action: auditAction,
        entity_type: 'opportunity',
        entity_id: opportunity.id,
        metadata: auditMetadata
      });

    if (auditError) {
      console.warn('[trial-lifecycle-events] Failed to log audit event:', auditError);
    }

    console.log(`[trial-lifecycle-events] Successfully processed ${event_type} for opportunity ${opportunity.id}`);

    return new Response(
      JSON.stringify({ 
        success: true,
        data: {
          opportunity_id: opportunity.id,
          event_type,
          new_trial_status: updateData.trial_status,
          updated_fields: Object.keys(updateData)
        }
      }),
      { 
        status: 200, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );

  } catch (error) {
    console.error('[trial-lifecycle-events] Unexpected error:', error);
    return new Response(
      JSON.stringify({ success: false, error: 'Internal server error', details: String(error) }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
