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
  trial_starts_at?: string;
  plan?: string;
  users_count?: number;
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
      trial_ends_at,
      trial_starts_at,
      plan,
      users_count
    } = payload;

    // Validate required fields
    if (!organization_id || !organization_name || !owner_email || !trial_ends_at) {
      console.error('[create-plg-opportunity] Missing required fields');
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: 'Missing required fields: organization_id, organization_name, owner_email, trial_ends_at' 
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

    // =====================================================
    // ANTI-DUPLICIDADE: Verificar se já existe oportunidade PLG ativa
    // =====================================================
    console.log('[create-plg-opportunity] Checking for existing PLG opportunity...');
    const { data: existingOpportunity, error: checkError } = await supabase
      .from('opportunities')
      .select('id, title, trial_status, created_at')
      .eq('plg_organization_id', organization_id)
      .eq('pipeline_id', PRESALES_PIPELINE_ID)
      .is('deleted_at', null)
      .maybeSingle();

    if (checkError) {
      console.error('[create-plg-opportunity] Error checking existing opportunity:', checkError);
    }

    // Se já existe oportunidade, atualizar ao invés de criar nova
    if (existingOpportunity) {
      console.log('[create-plg-opportunity] Existing opportunity found:', existingOpportunity.id);
      
      // Atualizar oportunidade existente
      const { error: updateError } = await supabase
        .from('opportunities')
        .update({
          trial_status: 'active',
          trial_end_date: trial_ends_at,
          trial_start_date: trial_starts_at || new Date().toISOString(),
          updated_at: new Date().toISOString()
        })
        .eq('id', existingOpportunity.id);

      if (updateError) {
        console.error('[create-plg-opportunity] Error updating existing opportunity:', updateError);
      }

      // Registrar evento de reativação
      await supabase
        .from('audit_log')
        .insert({
          organization_id: HUMANOID_ORG_ID,
          action: 'trial_reactivated',
          entity_type: 'opportunity',
          entity_id: existingOpportunity.id,
          metadata: {
            trial_org_id: organization_id,
            trial_org_name: organization_name,
            owner_email: owner_email,
            previous_status: existingOpportunity.trial_status,
            new_trial_end_date: trial_ends_at,
            origin: 'system',
            event_type: 'trial_reactivated'
          }
        });

      console.log('[create-plg-opportunity] Existing opportunity reactivated');

      return new Response(
        JSON.stringify({ 
          success: true,
          action: 'reactivated',
          data: {
            opportunity_id: existingOpportunity.id,
            opportunity_title: existingOpportunity.title,
            message: 'Existing PLG opportunity reactivated'
          }
        }),
        { 
          status: 200, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    // =====================================================
    // CRIAR NOVA OPORTUNIDADE PLG
    // =====================================================
    
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

    // 3. Create opportunity in "Trial Ativo (PLG)" stage with FULL PROMPT MASTER metadata
    console.log('[create-plg-opportunity] Creating opportunity with PLG metadata...');
    
    const trialStartDate = trial_starts_at || new Date().toISOString();
    
    const { data: opportunity, error: opportunityError } = await supabase
      .from('opportunities')
      .insert({
        // Core fields
        organization_id: HUMANOID_ORG_ID,
        pipeline_id: PRESALES_PIPELINE_ID,
        stage_id: TRIAL_PLG_STAGE_ID,
        title: `Lead PLG: ${organization_name}`,
        account_id: account.id,
        contact_id: contact?.id || null,
        
        // Source & Type (PROMPT MASTER required)
        origem: 'PLG - Trial Signup',
        fonte: 'trial_plg',
        lead_type: 'inbound_product',
        opportunity_type: 'product_led',
        
        // Trial fields (PROMPT MASTER required)
        trial_status: 'active',
        trial_start_date: trialStartDate,
        trial_end_date: trial_ends_at,
        plg_organization_id: organization_id,
        plg_score: 0,
        activated_features: [],
        
        // Status & Probability
        status: 'new',
        temperature: 'warm',
        prob: 20,
        close_date_prevista: trial_ends_at,
        
        // Automation & Ownership
        automation_enabled: true,
        owner_user_id: null, // Will be assigned manually by sales team
        
        // Values
        valor_previsto: 0,
        mrr_value: 0,
        arr_value: 0,
        
        // Notes with full context
        observacoes: `🚀 Trial PLG iniciado em ${new Date(trialStartDate).toLocaleDateString('pt-BR')}.

📋 Dados do Trial:
• Organização ID: ${organization_id}
• Plano: ${plan || 'Trial Gratuito'}
• Usuários: ${users_count || 1}
• Setor: ${industry || 'Não informado'}
• Tamanho da equipe: ${team_size || 'Não informado'}
• Término do trial: ${new Date(trial_ends_at).toLocaleDateString('pt-BR')}

📧 Contato Principal: ${owner_name || 'Não informado'} (${owner_email})`
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

    // 4. Log the trial_started event (PROMPT MASTER required)
    const { error: auditError } = await supabase
      .from('audit_log')
      .insert({
        organization_id: HUMANOID_ORG_ID,
        action: 'trial_started',
        entity_type: 'opportunity',
        entity_id: opportunity.id,
        metadata: {
          // Event identification
          event_type: 'trial_started',
          origin: 'system',
          timestamp: new Date().toISOString(),
          
          // Trial organization data
          trial_org_id: organization_id,
          trial_org_name: organization_name,
          
          // Contact data
          owner_email: owner_email,
          owner_name: owner_name,
          
          // Related entities
          account_id: account.id,
          contact_id: contact?.id,
          opportunity_id: opportunity.id,
          
          // Trial metadata
          trial_start_date: trialStartDate,
          trial_end_date: trial_ends_at,
          plan_at_entry: plan || 'trial',
          users_count: users_count || 1,
          industry: industry,
          team_size: team_size
        }
      });

    if (auditError) {
      console.warn('[create-plg-opportunity] Failed to log audit event:', auditError);
    }

    console.log('[create-plg-opportunity] PLG opportunity creation completed successfully!');

    return new Response(
      JSON.stringify({ 
        success: true,
        action: 'created',
        data: {
          account_id: account.id,
          contact_id: contact?.id,
          opportunity_id: opportunity.id,
          opportunity_title: opportunity.title,
          trial_status: opportunity.trial_status,
          plg_organization_id: opportunity.plg_organization_id
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
