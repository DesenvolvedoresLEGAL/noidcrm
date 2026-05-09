import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface LinkRequest {
  organization_id: string;
  proposal_id?: string;
  cnpj?: string;
}

Deno.serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  // Auth guard: internal-only endpoint (uses service role).
  const internalSecret = req.headers.get('x-internal-secret');
  const expectedSecret = Deno.env.get('INTERNAL_WORKFLOW_SECRET');
  if (!expectedSecret || internalSecret !== expectedSecret) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { organization_id, proposal_id, cnpj }: LinkRequest = await req.json();

    if (!organization_id) {
      throw new Error('organization_id is required');
    }

    console.log('[link-slg-organization] Starting for org:', organization_id);

    // Fetch organization
    const { data: org, error: orgError } = await supabase
      .from('organizations')
      .select('id, name, cnpj, status')
      .eq('id', organization_id)
      .single();

    if (orgError || !org) {
      throw new Error(`Organization not found: ${orgError?.message}`);
    }

    console.log('[link-slg-organization] Found org:', org.name);

    // Find accepted proposal by ID or by CNPJ
    let proposal = null;
    
    if (proposal_id) {
      const { data } = await supabase
        .from('proposals')
        .select(`
          id,
          proposal_number,
          total_amount,
          status,
          opportunity_id,
          client_name,
          opportunities:opportunity_id (
            account_id,
            accounts:account_id (cnpj)
          )
        `)
        .eq('id', proposal_id)
        .single();
      
      proposal = data;
    } else if (cnpj || org.cnpj) {
      const searchCnpj = cnpj || org.cnpj;
      console.log('[link-slg-organization] Searching proposal by CNPJ:', searchCnpj);
      
      // Find proposals where the account has matching CNPJ
      const { data } = await supabase
        .from('proposals')
        .select(`
          id,
          proposal_number,
          total_amount,
          status,
          opportunity_id,
          client_name,
          opportunities:opportunity_id (
            account_id,
            accounts:account_id (cnpj)
          )
        `)
        .eq('status', 'accepted')
        .order('accepted_at', { ascending: false })
        .limit(50);

      if (data) {
        proposal = data.find((p: any) => {
          const opp = p.opportunities as any;
          const acc = opp?.accounts as any;
          return acc?.cnpj === searchCnpj;
        });
      }
    }

    if (!proposal) {
      return new Response(JSON.stringify({
        success: false,
        error: 'No accepted proposal found for this organization'
      }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    console.log('[link-slg-organization] Found proposal:', proposal.proposal_number);

    // Calculate MRR from total_amount (assuming 12 months)
    const mrrValue = (proposal.total_amount || 0) / 12;
    const opp = proposal.opportunities as any;
    const accountId = opp?.account_id;

    // Check if slg_conversion already exists
    const { data: existingConversion } = await supabase
      .from('slg_conversions')
      .select('id')
      .eq('organization_id', organization_id)
      .eq('proposal_id', proposal.id)
      .single();

    if (existingConversion) {
      return new Response(JSON.stringify({
        success: true,
        message: 'SLG conversion already exists',
        slg_conversion_id: existingConversion.id
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Create SLG conversion
    const { data: slgConversion, error: slgError } = await supabase
      .from('slg_conversions')
      .insert({
        organization_id: organization_id,
        proposal_id: proposal.id,
        account_id: accountId,
        mrr_value: mrrValue,
        arr_value: proposal.total_amount,
        converted_at: new Date().toISOString(),
        provisioned_at: new Date().toISOString()
      })
      .select()
      .single();

    if (slgError) {
      throw new Error(`Failed to create SLG conversion: ${slgError.message}`);
    }

    console.log('[link-slg-organization] Created SLG conversion:', slgConversion.id);

    // Update organization to active status with neural plan
    const { error: updateError } = await supabase
      .from('organizations')
      .update({
        status: 'active',
        current_plan_id: 'neural',
        max_users: null, // No limit for paying customers
        is_plan_locked: true
      })
      .eq('id', organization_id);

    if (updateError) {
      console.error('[link-slg-organization] Failed to update org:', updateError);
    }

    // Log audit event
    await supabase.from('audit_log').insert({
      organization_id: organization_id,
      action: 'slg_organization_linked',
      entity_type: 'organization',
      entity_id: organization_id,
      metadata: {
        proposal_id: proposal.id,
        proposal_number: proposal.proposal_number,
        mrr_value: mrrValue
      }
    });

    console.log('[link-slg-organization] Successfully linked organization');

    return new Response(JSON.stringify({
      success: true,
      message: 'Organization linked to SLG proposal',
      slg_conversion_id: slgConversion.id,
      proposal_number: proposal.proposal_number,
      mrr_value: mrrValue
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error: any) {
    console.error('[link-slg-organization] Error:', error);
    return new Response(JSON.stringify({
      success: false,
      error: error.message
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});
