import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface LeadData {
  // Company data
  razao_social?: string;
  nome_fantasia?: string;
  cnpj?: string;
  email_domain?: string;
  website?: string;
  telefone?: string;
  segmento?: string;
  porte?: string;
  cidade?: string;
  uf?: string;
  origem?: string;
  
  // Contact data
  contact_nome?: string;
  contact_email?: string;
  contact_telefone?: string;
  contact_cargo?: string;
  
  // Opportunity data
  titulo?: string;
  valor_estimado?: number;
  produto?: string;
  notas?: string;
  close_date_prevista?: string;
  
  // Routing
  force_seller_id?: string;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { lead, organization_id, api_key } = await req.json();

    // Validate organization access
    if (!organization_id) {
      return new Response(
        JSON.stringify({ error: 'organization_id is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Verify organization exists
    const { data: org, error: orgError } = await supabase
      .from('organizations')
      .select('id, name')
      .eq('id', organization_id)
      .single();

    if (orgError || !org) {
      return new Response(
        JSON.stringify({ error: 'Invalid organization' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const leadData = lead as LeadData;
    console.log('[ingest-lead] Processing lead for org:', org.name);

    // Step 1: Find or create account
    let accountId: string | null = null;
    
    // Try to find by CNPJ first
    if (leadData.cnpj) {
      const cleanCnpj = leadData.cnpj.replace(/\D/g, '');
      const { data: existingAccount } = await supabase
        .from('accounts')
        .select('id')
        .eq('organization_id', organization_id)
        .eq('cnpj', cleanCnpj)
        .maybeSingle();
      
      if (existingAccount) {
        accountId = existingAccount.id;
        console.log('[ingest-lead] Found existing account by CNPJ:', accountId);
      }
    }

    // Try to find by email domain
    if (!accountId && leadData.email_domain) {
      const { data: existingAccount } = await supabase
        .from('accounts')
        .select('id')
        .eq('organization_id', organization_id)
        .contains('emails', [leadData.email_domain])
        .maybeSingle();
      
      if (existingAccount) {
        accountId = existingAccount.id;
        console.log('[ingest-lead] Found existing account by email:', accountId);
      }
    }

    // Create new account if not found
    if (!accountId) {
      const { data: newAccount, error: accountError } = await supabase
        .from('accounts')
        .insert({
          organization_id,
          razao_social: leadData.razao_social || leadData.nome_fantasia || 'Lead sem nome',
          nome_fantasia: leadData.nome_fantasia,
          cnpj: leadData.cnpj?.replace(/\D/g, ''),
          website: leadData.website,
          segmento: leadData.segmento,
          porte: leadData.porte,
          cidade: leadData.cidade,
          uf: leadData.uf,
          origem_principal: leadData.origem || 'inbound',
          lifecycle_stage: 'Lead',
          emails: leadData.contact_email ? [leadData.contact_email] : [],
          telefones: leadData.telefone ? { principal: leadData.telefone } : null,
        })
        .select('id')
        .single();

      if (accountError) {
        console.error('[ingest-lead] Error creating account:', accountError);
        throw new Error('Failed to create account');
      }
      
      accountId = newAccount.id;
      console.log('[ingest-lead] Created new account:', accountId);
    }

    // Step 2: Find or create contact
    let contactId: string | null = null;
    
    if (leadData.contact_email) {
      const { data: existingContact } = await supabase
        .from('contacts')
        .select('id')
        .eq('organization_id', organization_id)
        .eq('account_id', accountId)
        .contains('emails', [leadData.contact_email])
        .maybeSingle();

      if (existingContact) {
        contactId = existingContact.id;
      } else if (leadData.contact_nome) {
        const nameParts = leadData.contact_nome.trim().split(' ');
        const primeiroNome = nameParts[0];
        const ultimoNome = nameParts.length > 1 ? nameParts.slice(1).join(' ') : '';

        const { data: newContact, error: contactError } = await supabase
          .from('contacts')
          .insert({
            organization_id,
            account_id: accountId,
            nome: leadData.contact_nome,
            primeiro_nome: primeiroNome,
            ultimo_nome: ultimoNome,
            emails: [{ value: leadData.contact_email, type: 'work', is_primary: true }],
            telefones: leadData.contact_telefone 
              ? [{ value: leadData.contact_telefone, type: 'whatsapp', is_primary: true }] 
              : [],
            cargo: leadData.contact_cargo,
          })
          .select('id')
          .single();

        if (!contactError && newContact) {
          contactId = newContact.id;
          console.log('[ingest-lead] Created new contact:', contactId);
        }
      }
    }

    // Step 3: Calculate account scores
    console.log('[ingest-lead] Calculating scores for account:', accountId);
    
    const { data: scoreResult, error: scoreError } = await supabase.functions.invoke('calculate-account-scores', {
      body: { accountId }
    });

    let fitScore = 50;
    let intentScore = 50;
    let leadGrade = 'C';

    if (!scoreError && scoreResult) {
      fitScore = scoreResult.fit_score || 50;
      intentScore = scoreResult.intent_score || 50;
      
      // Calculate lead grade based on combined score
      const combinedScore = (fitScore * 0.4) + (intentScore * 0.6);
      if (combinedScore >= 80) leadGrade = 'A';
      else if (combinedScore >= 65) leadGrade = 'B';
      else if (combinedScore >= 50) leadGrade = 'C';
      else if (combinedScore >= 35) leadGrade = 'D';
      else leadGrade = 'F';
      
      console.log('[ingest-lead] Scores calculated - Fit:', fitScore, 'Intent:', intentScore, 'Grade:', leadGrade);
    }

    // Step 4: Intelligent routing - find best seller
    let assignedSellerId: string | null = leadData.force_seller_id || null;

    if (!assignedSellerId) {
      // Get all active sellers with their performance metrics
      const { data: sellers } = await supabase
        .from('sellers')
        .select(`
          id,
          user_id,
          total_won,
          total_opportunities,
          profiles!inner(full_name)
        `)
        .eq('organization_id', organization_id)
        .eq('is_active', true);

      if (sellers && sellers.length > 0) {
        // Calculate capacity for each seller (open opportunities)
        const sellerMetrics = await Promise.all(sellers.map(async (seller) => {
          const { count } = await supabase
            .from('opportunities')
            .select('id', { count: 'exact', head: true })
            .eq('owner_user_id', seller.user_id)
            .eq('organization_id', organization_id)
            .in('status', ['open', 'in_progress']);

          const openOpps = count || 0;
          const winRate = seller.total_opportunities > 0 
            ? (seller.total_won || 0) / seller.total_opportunities 
            : 0.5;
          
          return {
            ...seller,
            openOpps,
            winRate,
            capacity: Math.max(0, 20 - openOpps), // Assume max 20 opportunities per seller
          };
        }));

        // Sort by routing strategy based on lead grade
        if (leadGrade === 'A' || leadGrade === 'B') {
          // High-value leads go to top performers with capacity
          sellerMetrics.sort((a, b) => {
            if (a.capacity === 0 && b.capacity > 0) return 1;
            if (b.capacity === 0 && a.capacity > 0) return -1;
            return b.winRate - a.winRate;
          });
        } else {
          // Lower grade leads use round-robin with capacity check
          sellerMetrics.sort((a, b) => {
            if (a.capacity === 0 && b.capacity > 0) return 1;
            if (b.capacity === 0 && a.capacity > 0) return -1;
            return a.openOpps - b.openOpps; // Less loaded seller first
          });
        }

        const selectedSeller = sellerMetrics.find(s => s.capacity > 0) || sellerMetrics[0];
        assignedSellerId = selectedSeller?.user_id || null;
        
        const sellerName = (selectedSeller?.profiles as any)?.full_name || 'Unknown';
        console.log('[ingest-lead] Assigned to seller:', sellerName);
      }
    }

    // Fallback: get any admin user
    if (!assignedSellerId) {
      const { data: adminMember } = await supabase
        .from('organization_members')
        .select('user_id')
        .eq('organization_id', organization_id)
        .eq('status', 'active')
        .in('org_role', ['owner', 'admin'])
        .limit(1)
        .single();

      assignedSellerId = adminMember?.user_id || null;
    }

    if (!assignedSellerId) {
      throw new Error('No available seller found');
    }

    // Step 5: Determine pipeline based on lead grade
    let pipelineId: string | null = null;
    let stageId: string | null = null;

    // A/B grades go to sales pipeline, C/D/F go to qualification
    const pipelineType = (leadGrade === 'A' || leadGrade === 'B') ? 'sales' : 'qualification';

    console.log('[ingest-lead] Looking for pipeline with type:', pipelineType);

    // Try to find pipeline by type first
    let { data: pipeline } = await supabase
      .from('pipelines')
      .select('id, name')
      .eq('organization_id', organization_id)
      .eq('pipeline_type', pipelineType)
      .limit(1)
      .maybeSingle();

    // Fallback: if no pipeline found by type, try to find any pipeline (prefer qualification/pre-vendas)
    if (!pipeline) {
      console.log('[ingest-lead] No pipeline found by type, trying fallback...');
      
      const { data: fallbackPipeline } = await supabase
        .from('pipelines')
        .select('id, name')
        .eq('organization_id', organization_id)
        .ilike('name', '%pré%vendas%')
        .limit(1)
        .maybeSingle();
      
      if (fallbackPipeline) {
        pipeline = fallbackPipeline;
        console.log('[ingest-lead] Found fallback pipeline by name:', fallbackPipeline.name);
      } else {
        // Last resort: get any pipeline
        const { data: anyPipeline } = await supabase
          .from('pipelines')
          .select('id, name')
          .eq('organization_id', organization_id)
          .limit(1)
          .maybeSingle();
        
        if (anyPipeline) {
          pipeline = anyPipeline;
          console.log('[ingest-lead] Using first available pipeline:', anyPipeline.name);
        }
      }
    }

    if (pipeline) {
      pipelineId = pipeline.id;
      console.log('[ingest-lead] Selected pipeline:', pipeline.name, pipeline.id);
      
      // Get first stage
      const { data: firstStage } = await supabase
        .from('stages')
        .select('id, name')
        .eq('pipeline_id', pipelineId)
        .order('order_index', { ascending: true })
        .limit(1)
        .maybeSingle();

      if (firstStage) {
        stageId = firstStage.id;
        console.log('[ingest-lead] Selected stage:', firstStage.name, firstStage.id);
      } else {
        console.warn('[ingest-lead] No stages found for pipeline:', pipelineId);
      }
    } else {
      console.error('[ingest-lead] No pipeline found for organization:', organization_id);
    }

    // Step 6: Check for existing open opportunity before creating new one
    let opportunity: { id: string } | null = null;
    let isNewOpportunity = false;

    // Check if there's already an open opportunity for this account/contact
    const { data: existingOpp } = await supabase
      .from('opportunities')
      .select('id')
      .eq('organization_id', organization_id)
      .eq('account_id', accountId)
      .eq('status', 'open')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (existingOpp) {
      opportunity = existingOpp;
      console.log('[ingest-lead] Found existing open opportunity:', opportunity.id);
    } else {
      // Create new opportunity only if none exists
      const opportunityTitle = leadData.titulo || 
        `Lead: ${leadData.nome_fantasia || leadData.razao_social || 'Novo Lead'}`;

      const { data: newOpp, error: oppError } = await supabase
        .from('opportunities')
        .insert({
          organization_id,
          title: opportunityTitle,
          account_id: accountId,
          contact_id: contactId,
          owner_user_id: assignedSellerId,
          pipeline_id: pipelineId,
          stage_id: stageId,
          valor_previsto: leadData.valor_estimado || 0,
          produto: leadData.produto,
          origem: leadData.origem || 'inbound',
          fonte: leadData.origem || 'api',
          status: 'open',
          temperature: leadGrade === 'A' ? 'hot' : leadGrade === 'B' ? 'warm' : 'cold',
        })
        .select('id')
        .single();

      if (oppError) {
        console.error('[ingest-lead] Error creating opportunity:', oppError);
        throw new Error('Failed to create opportunity');
      }

      opportunity = newOpp;
      isNewOpportunity = true;
      console.log('[ingest-lead] Created new opportunity:', opportunity.id);
    }

    // Only trigger workflows and notifications for NEW opportunities
    if (isNewOpportunity) {
      // Step 7: Trigger workflow for new lead
      await supabase
        .from('workflow_executions')
        .insert({
          organization_id,
          opportunity_id: opportunity.id,
          trigger_type: 'opportunity_created',
          trigger_data: {
            lead_grade: leadGrade,
            fit_score: fitScore,
            intent_score: intentScore,
            origem: leadData.origem,
          },
          status: 'pending',
        });

      // Step 8: Notify assigned seller
      await supabase
        .from('notifications')
        .insert({
          organization_id,
          user_id: assignedSellerId,
          type: 'new_lead',
          title: `Novo Lead ${leadGrade}: ${leadData.nome_fantasia || leadData.razao_social}`,
          message: `Um novo lead grade ${leadGrade} foi atribuído a você. Fit Score: ${fitScore}, Intent Score: ${intentScore}`,
          metadata: {
            opportunity_id: opportunity.id,
            account_id: accountId,
            lead_grade: leadGrade,
            fit_score: fitScore,
            intent_score: intentScore,
          },
        });

      // Step 9: For C/D/F grades, enroll in nurturing sequence
      if (leadGrade === 'C' || leadGrade === 'D' || leadGrade === 'F') {
        // Find active nurturing sequence
        const { data: nurturingSequence } = await supabase
          .from('sequences')
          .select('id')
          .eq('organization_id', organization_id)
          .eq('is_active', true)
          .eq('sequence_type', 'nurturing')
          .limit(1)
          .maybeSingle();

        if (nurturingSequence) {
          await supabase
            .from('sequence_enrollments')
            .insert({
              organization_id,
              sequence_id: nurturingSequence.id,
              opportunity_id: opportunity.id,
              status: 'active',
              current_step: 0,
              enrolled_at: new Date().toISOString(),
            });
          
          console.log('[ingest-lead] Enrolled in nurturing sequence:', nurturingSequence.id);
        }
      }
    } else {
      console.log('[ingest-lead] Using existing opportunity, skipping notifications');
    }

    return new Response(
      JSON.stringify({
        success: true,
        data: {
          account_id: accountId,
          contact_id: contactId,
          opportunity_id: opportunity.id,
          lead_grade: leadGrade,
          fit_score: fitScore,
          intent_score: intentScore,
          assigned_seller_id: assignedSellerId,
          pipeline_type: pipelineType,
        },
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('[ingest-lead] Error:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
