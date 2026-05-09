import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface ProvisionRequest {
  proposal_id: string;
  acceptor_name: string;
  acceptor_email: string;
  acceptor_phone?: string;
}

Deno.serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  // Auth guard: internal-only — provisions orgs with service role.
  const internalSecret = req.headers.get('x-internal-secret');
  const expectedSecret = Deno.env.get('INTERNAL_WORKFLOW_SECRET');
  if (!expectedSecret || internalSecret !== expectedSecret) {
    return new Response(JSON.stringify({ success: false, error: 'Unauthorized' }), {
      status: 401,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  try {
    console.log('[provision-client-organization] Starting client provisioning...');
    
    const payload: ProvisionRequest = await req.json();
    console.log('[provision-client-organization] Received payload:', JSON.stringify(payload, null, 2));

    const { proposal_id, acceptor_name, acceptor_email, acceptor_phone } = payload;

    // Validate required fields
    if (!proposal_id || !acceptor_email) {
      console.error('[provision-client-organization] Missing required fields');
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: 'Missing required fields: proposal_id, acceptor_email' 
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Create Supabase client with service role for admin operations
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    // 1. Fetch proposal with all related data
    console.log('[provision-client-organization] Fetching proposal data...');
    const { data: proposal, error: proposalError } = await supabase
      .from('proposals')
      .select(`
        id,
        title,
        total_amount,
        organization_id,
        opportunity:opportunities(
          id,
          title,
          owner_user_id,
          pipeline_id,
          account:accounts(
            id,
            razao_social,
            nome_fantasia,
            cnpj,
            segmento,
            tamanho,
            cidade,
            uf,
            telefones,
            emails
          )
        )
      `)
      .eq('id', proposal_id)
      .single();

    if (proposalError || !proposal) {
      console.error('[provision-client-organization] Proposal not found:', proposalError);
      return new Response(
        JSON.stringify({ success: false, error: 'Proposal not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Supabase returns arrays for relations in edge functions
    const opportunityData = Array.isArray(proposal.opportunity) 
      ? proposal.opportunity[0] 
      : proposal.opportunity;
    const account = opportunityData?.account 
      ? (Array.isArray(opportunityData.account) ? opportunityData.account[0] : opportunityData.account)
      : null;
    const opportunity = opportunityData;

    if (!account) {
      console.error('[provision-client-organization] No account linked to proposal');
      return new Response(
        JSON.stringify({ success: false, error: 'No account linked to proposal' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // 2. Calculate MRR from payment terms
    console.log('[provision-client-organization] Calculating MRR...');
    const { data: paymentTerms } = await supabase
      .from('proposal_payment_terms')
      .select('monthly_value, payment_type')
      .eq('proposal_id', proposal_id)
      .in('payment_type', ['recurring', 'subscription']);

    const mrrValue = (paymentTerms || []).reduce((sum, t) => sum + (t.monthly_value || 0), 0);
    console.log('[provision-client-organization] MRR calculated:', mrrValue);

    // 3. Generate unique slug for the new organization
    const baseSlug = (account.nome_fantasia || account.razao_social || 'cliente')
      .toLowerCase()
      .replace(/[^a-z0-9]/g, '-')
      .replace(/-+/g, '-')
      .substring(0, 30);
    
    const uniqueSlug = `${baseSlug}-${Date.now().toString(36)}`;
    console.log('[provision-client-organization] Generated slug:', uniqueSlug);

    // 4. Create the new organization for the client
    console.log('[provision-client-organization] Creating client organization...');
    const trialEndsAt = new Date();
    trialEndsAt.setDate(trialEndsAt.getDate() + 365); // 1 year active status

    const { data: newOrg, error: orgError } = await supabase
      .from('organizations')
      .insert({
        name: account.nome_fantasia || account.razao_social,
        legal_name: account.razao_social,
        cnpj: account.cnpj,
        slug: uniqueSlug,
        status: 'active',
        current_plan_id: 'pro', // Default to pro plan for SLG clients
        industry: account.segmento,
        team_size: account.tamanho,
        trial_ends_at: trialEndsAt.toISOString(),
        email: acceptor_email,
        phone: acceptor_phone || (account.telefones as any)?.[0] || null,
        acquisition_channel: 'slg', // Sales-Led Growth - via proposal
      })
      .select()
      .single();

    if (orgError) {
      console.error('[provision-client-organization] Error creating organization:', orgError);
      return new Response(
        JSON.stringify({ success: false, error: 'Failed to create organization', details: orgError }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('[provision-client-organization] Organization created:', newOrg.id);

    // 5. Check if user already exists, if not create invitation
    let userId: string | null = null;
    const { data: existingUser } = await supabase
      .from('profiles')
      .select('user_id')
      .eq('email', acceptor_email.toLowerCase())
      .maybeSingle();

    if (existingUser) {
      userId = existingUser.user_id;
      console.log('[provision-client-organization] Existing user found:', userId);
      
      // Add user to organization as owner
      await supabase
        .from('organization_members')
        .insert({
          organization_id: newOrg.id,
          user_id: userId,
          role: 'owner',
          invited_by: opportunity?.owner_user_id || null,
        });
    } else {
      // Create invitation for new user
      console.log('[provision-client-organization] Creating invitation for new user...');
      await supabase
        .from('organization_invitations')
        .insert({
          organization_id: newOrg.id,
          email: acceptor_email.toLowerCase(),
          role: 'owner',
          invited_by: opportunity?.owner_user_id || null,
          expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(), // 7 days
        });
    }

    // 6. Record SLG conversion
    console.log('[provision-client-organization] Recording SLG conversion...');
    const { data: slgConversion, error: slgError } = await supabase
      .from('slg_conversions')
      .insert({
        proposal_id: proposal_id,
        account_id: account.id,
        organization_id: newOrg.id,
        plg_opportunity_id: opportunity?.id || null,
        mrr_value: mrrValue,
        total_contract_value: proposal.total_amount || 0,
        sales_user_id: opportunity?.owner_user_id || null,
        pipeline_id: opportunity?.pipeline_id || null,
        converted_at: new Date().toISOString(),
        provisioned_at: new Date().toISOString(),
        client_email: acceptor_email,
      })
      .select()
      .single();

    if (slgError) {
      console.error('[provision-client-organization] Error recording SLG conversion:', slgError);
      // Non-blocking - continue even if this fails
    } else {
      console.log('[provision-client-organization] SLG conversion recorded:', slgConversion?.id);
    }

    // 7. Log audit event
    await supabase
      .from('audit_log')
      .insert({
        organization_id: proposal.organization_id,
        action: 'slg_client_provisioned',
        entity_type: 'organization',
        entity_id: newOrg.id,
        metadata: {
          proposal_id: proposal_id,
          account_id: account.id,
          mrr_value: mrrValue,
          total_contract_value: proposal.total_amount,
          acceptor_email: acceptor_email,
          sales_user_id: opportunity?.owner_user_id,
        }
      });

    // 8. Update opportunity status if exists (move to CS pipeline or mark as won)
    if (opportunity?.id) {
      // Find CS pipeline for the selling organization
      const { data: csPipeline } = await supabase
        .from('pipelines')
        .select('id')
        .eq('organization_id', proposal.organization_id)
        .eq('pipeline_type', 'cs')
        .maybeSingle();

      if (csPipeline) {
        // Get first stage of CS pipeline
        const { data: csFirstStage } = await supabase
          .from('pipeline_stages')
          .select('id')
          .eq('pipeline_id', csPipeline.id)
          .order('order_index', { ascending: true })
          .limit(1)
          .maybeSingle();

        if (csFirstStage) {
          // Create new CS opportunity linked to the provisioned org
          await supabase
            .from('opportunities')
            .insert({
              organization_id: proposal.organization_id,
              pipeline_id: csPipeline.id,
              stage_id: csFirstStage.id,
              title: `CS: ${account.nome_fantasia || account.razao_social}`,
              account_id: account.id,
              owner_user_id: opportunity.owner_user_id,
              status: 'in_progress',
              origem: 'SLG Conversion',
              temperature: 'hot',
              valor: mrrValue,
              observacoes: `Cliente provisionado via SLG. Org ID: ${newOrg.id}. MRR: R$ ${mrrValue.toFixed(2)}`,
            });
        }
      }
    }

    console.log('[provision-client-organization] Provisioning completed successfully!');

    return new Response(
      JSON.stringify({ 
        success: true, 
        data: {
          organization_id: newOrg.id,
          organization_slug: newOrg.slug,
          mrr_value: mrrValue,
          slg_conversion_id: slgConversion?.id,
          user_exists: !!existingUser,
        }
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('[provision-client-organization] Unexpected error:', error);
    return new Response(
      JSON.stringify({ success: false, error: 'Internal server error', details: String(error) }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
