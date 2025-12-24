import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// Humanoid organization constants
const HUMANOID_ORG_ID = '774d7d78-8257-4891-aac7-718039b80049';
const PRESALES_PIPELINE_ID = '774d7d78-8257-4891-aac7-718039b80049-sales-1';
const TRIAL_PLG_STAGE_ID = '084d145c-491b-460a-8e18-d81e4d7177f8';

interface PLGOpportunityRequest {
  organization_id: string;
  organization_name: string;
  owner_email: string;
  owner_name: string;
  cnpj?: string;
  industry?: string;
  team_size?: string;
  trial_ends_at: string;
}

Deno.serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('[create-plg-opportunity] Starting PLG opportunity creation...');
    
    const payload: PLGOpportunityRequest = await req.json();
    console.log('[create-plg-opportunity] Received payload:', JSON.stringify(payload, null, 2));

    const { 
      organization_id,
      organization_name, 
      owner_email, 
      owner_name, 
      cnpj, 
      industry, 
      team_size,
      trial_ends_at 
    } = payload;

    // Validate required fields
    if (!organization_name || !owner_email || !trial_ends_at) {
      console.error('[create-plg-opportunity] Missing required fields');
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: 'Missing required fields: organization_name, owner_email, trial_ends_at' 
        }),
        { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    // Create Supabase client with service role for admin operations
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    // 1. Create account in Humanoid organization
    console.log('[create-plg-opportunity] Creating account in Humanoid org...');
    const { data: account, error: accountError } = await supabase
      .from('accounts')
      .insert({
        organization_id: HUMANOID_ORG_ID,
        razao_social: organization_name,
        nome_fantasia: organization_name,
        cnpj: cnpj || null,
        segmento: industry || null,
        tamanho: team_size || null,
        origem_principal: 'PLG - Trial Signup',
        lifecycle_stage: 'lead',
        tipo_pessoa: 'juridica'
      })
      .select()
      .single();

    if (accountError) {
      console.error('[create-plg-opportunity] Error creating account:', accountError);
      return new Response(
        JSON.stringify({ success: false, error: 'Failed to create account', details: accountError }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('[create-plg-opportunity] Account created:', account.id);

    // 2. Create contact for the owner
    console.log('[create-plg-opportunity] Creating contact for owner...');
    const { data: contact, error: contactError } = await supabase
      .from('contacts')
      .insert({
        organization_id: HUMANOID_ORG_ID,
        account_id: account.id,
        nome: owner_name || owner_email.split('@')[0],
        emails: [owner_email],
        cargo: 'Founder / Owner',
        is_primary: true,
        is_decision_maker: true,
        status: 'active'
      })
      .select()
      .single();

    if (contactError) {
      console.error('[create-plg-opportunity] Error creating contact:', contactError);
      // Continue anyway, contact is not critical
    } else {
      console.log('[create-plg-opportunity] Contact created:', contact?.id);
    }

    // 3. Create opportunity in "Trial Ativo (PLG)" stage
    console.log('[create-plg-opportunity] Creating opportunity...');
    const { data: opportunity, error: opportunityError } = await supabase
      .from('opportunities')
      .insert({
        organization_id: HUMANOID_ORG_ID,
        pipeline_id: PRESALES_PIPELINE_ID,
        stage_id: TRIAL_PLG_STAGE_ID,
        title: `Lead PLG: ${organization_name}`,
        account_id: account.id,
        contact_id: contact?.id || null,
        origem: 'PLG - Trial Signup',
        temperature: 'warm',
        prob: 20,
        close_date_prevista: trial_ends_at,
        status: 'new',
        automation_enabled: true,
        owner_user_id: null, // Will be assigned manually by sales team
        valor: 0, // Initial value, will be updated based on plan selection
        observacoes: `Trial iniciado em ${new Date().toLocaleDateString('pt-BR')}. Organização ID: ${organization_id}. Setor: ${industry || 'Não informado'}. Tamanho da equipe: ${team_size || 'Não informado'}.`
      })
      .select()
      .single();

    if (opportunityError) {
      console.error('[create-plg-opportunity] Error creating opportunity:', opportunityError);
      return new Response(
        JSON.stringify({ success: false, error: 'Failed to create opportunity', details: opportunityError }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('[create-plg-opportunity] Opportunity created successfully:', opportunity.id);

    // 4. Log the PLG event for tracking
    const { error: auditError } = await supabase
      .from('audit_log')
      .insert({
        organization_id: HUMANOID_ORG_ID,
        action: 'plg_trial_created',
        entity_type: 'opportunity',
        entity_id: opportunity.id,
        metadata: {
          trial_org_id: organization_id,
          trial_org_name: organization_name,
          owner_email: owner_email,
          account_id: account.id,
          contact_id: contact?.id
        }
      });

    if (auditError) {
      console.warn('[create-plg-opportunity] Failed to log audit event:', auditError);
    }

    console.log('[create-plg-opportunity] PLG opportunity creation completed successfully!');

    return new Response(
      JSON.stringify({ 
        success: true, 
        data: {
          account_id: account.id,
          contact_id: contact?.id,
          opportunity_id: opportunity.id,
          opportunity_title: opportunity.title
        }
      }),
      { 
        status: 200, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );

  } catch (error) {
    console.error('[create-plg-opportunity] Unexpected error:', error);
    return new Response(
      JSON.stringify({ success: false, error: 'Internal server error', details: String(error) }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
