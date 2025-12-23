import { serve } from 'https://deno.land/std@0.190.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const PIPELINE_TEMPLATES = {
  b2b: {
    name: 'Vendas B2B',
    type: 'sales',
    stages: [
      { name: 'Prospecção', order_index: 0, color: '#64748b' },
      { name: 'Qualificação', order_index: 1, color: '#3b82f6' },
      { name: 'Proposta', order_index: 2, color: '#8b5cf6' },
      { name: 'Negociação', order_index: 3, color: '#f59e0b' },
      { name: 'Fechamento', order_index: 4, color: '#10b981' }
    ]
  },
  b2c: {
    name: 'Vendas B2C',
    type: 'sales',
    stages: [
      { name: 'Lead', order_index: 0, color: '#64748b' },
      { name: 'Contato', order_index: 1, color: '#3b82f6' },
      { name: 'Demonstração', order_index: 2, color: '#8b5cf6' },
      { name: 'Venda', order_index: 3, color: '#10b981' },
      { name: 'Pós-venda', order_index: 4, color: '#06b6d4' }
    ]
  },
  enterprise: {
    name: 'Vendas Enterprise',
    type: 'sales',
    stages: [
      { name: 'Prospecção', order_index: 0, color: '#64748b' },
      { name: 'Discovery', order_index: 1, color: '#3b82f6' },
      { name: 'POC', order_index: 2, color: '#8b5cf6' },
      { name: 'Proposta', order_index: 3, color: '#f59e0b' },
      { name: 'Negociação', order_index: 4, color: '#fb923c' },
      { name: 'Fechamento', order_index: 5, color: '#10b981' },
      { name: 'Onboarding', order_index: 6, color: '#06b6d4' }
    ]
  },
  custom: {
    name: 'Pipeline Básico',
    type: 'sales',
    stages: [
      { name: 'Novo', order_index: 0, color: '#64748b' },
      { name: 'Em andamento', order_index: 1, color: '#3b82f6' },
      { name: 'Concluído', order_index: 2, color: '#10b981' }
    ]
  }
};

serve(async (req) => {

  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  // Health check endpoint
  if (req.method === 'GET' && new URL(req.url).pathname.includes('/health')) {
    return new Response(
      JSON.stringify({ status: 'ok', timestamp: new Date().toISOString() }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  try {
    // Verificar autenticação
    const authHeader = req.headers.get('Authorization');

    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Usuário não autenticado' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const jwt = authHeader.replace('Bearer ', '');
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // getUser() validates and decodes the JWT token correctly
    const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(jwt);

    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: 'Usuário não autenticado' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Verificar se email está confirmado
    if (!user.email_confirmed_at) {
      return new Response(
        JSON.stringify({ 
          error: 'Email não confirmado. Por favor, verifique seu email antes de continuar.' 
        }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const userId = user.id;

    // Receber dados
    const body = await req.json();
    const { companyName, industry, teamSize, cnpj, workspaceName, workspaceSlug, pipelineType, selectedPlanId, trialDays } = body;

    // Determine plan and trial duration - Always 14 days
    const planId = selectedPlanId || 'neural';
    const trialDuration = 14; // Unified trial period for all plans

    // Validate required fields
    if (!companyName || !workspaceName || !workspaceSlug || !pipelineType) {
      return new Response(
        JSON.stringify({ 
          error: 'Dados incompletos. Por favor, preencha todos os campos obrigatórios.' 
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // 1. Verificar se slug já existe
    const { data: existingOrg } = await supabaseAdmin
      .from('organizations')
      .select('id')
      .eq('slug', workspaceSlug)
      .maybeSingle();

    if (existingOrg) {
      return new Response(
        JSON.stringify({ error: 'Este endereço já está em uso. Por favor, escolha outro.' }),
        { status: 409, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // 2. Criar organização com plano selecionado
    const { data: org, error: orgError } = await supabaseAdmin
      .from('organizations')
      .insert({
        name: workspaceName,
        slug: workspaceSlug,
        industry: industry,
        team_size: teamSize,
        cnpj: cnpj || null,
        status: 'trial',
        current_plan_id: planId,
        trial_ends_at: new Date(Date.now() + trialDuration * 24 * 60 * 60 * 1000).toISOString()
      })
      .select()
      .single();

    if (orgError) {
      console.error('[Onboarding] Failed to create organization:', orgError);
      throw new Error('Não foi possível criar o workspace');
    }

    // 2.1 Criar org_volts_balance para planos Autonomous
    if (planId === 'autonomous') {
      const { error: voltsError } = await supabaseAdmin
        .from('org_volts_balance')
        .insert({
          organization_id: org.id,
          included_volts: 1000,
          used_volts: 0,
          extra_volts: 0,
          period_start: new Date().toISOString(),
          period_end: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString()
        });

      if (voltsError) {
        console.error('[Onboarding] Failed to create volts balance:', voltsError);
        // Non-critical, continue
      }
    }

    // 3. Adicionar usuário como owner (role E org_role = owner)
    const { error: memberError } = await supabaseAdmin
      .from('organization_members')
      .insert({
        user_id: userId,
        organization_id: org.id,
        role: 'owner',
        org_role: 'owner', // IMPORTANTE: Define org_role explicitamente para evitar default 'sales'
        status: 'active',
        joined_at: new Date().toISOString()
      });

    if (memberError) {
      console.error('[Onboarding] Failed to add member:', memberError);
      throw new Error('Não foi possível criar o workspace');
    }

    // 4. Criar pipeline
    const template = PIPELINE_TEMPLATES[pipelineType as keyof typeof PIPELINE_TEMPLATES];
    if (!template) {
      console.error('[Onboarding] Invalid pipeline type:', pipelineType);
      throw new Error('Configuração de pipeline inválida');
    }

    const pipelineId = `${org.id}-${template.type}-1`;

    const { error: pipelineError } = await supabaseAdmin
      .from('pipelines')
      .insert({
        id: pipelineId,
        name: template.name,
        type: template.type,
        organization_id: org.id
      });

    if (pipelineError) {
      console.error('[Onboarding] Failed to create pipeline:', pipelineError);
      throw new Error('Não foi possível criar o workspace');
    }

    // 5. Criar stages
    const stagesData = template.stages.map((stage: any) => ({
      id: `${pipelineId}-stage-${stage.order_index}`,
      pipeline_id: pipelineId,
      name: stage.name,
      order_index: stage.order_index,
      color: stage.color,
      organization_id: org.id
    }));

    const { error: stagesError } = await supabaseAdmin
      .from('stages')
      .insert(stagesData);

    if (stagesError) {
      console.error('[Onboarding] Failed to create stages:', stagesError);
      throw new Error('Não foi possível criar o workspace');
    }

    // 6. Atualizar profile com organization_id
    const { error: profileError } = await supabaseAdmin
      .from('profiles')
      .update({ organization_id: org.id })
      .eq('user_id', userId);

    if (profileError) {
      console.error('[Onboarding] Failed to update profile:', profileError);
      throw new Error('Não foi possível criar o workspace');
    }

    // 7. Marcar onboarding como completo (UPSERT para garantir que existe)
    const { error: statusError } = await supabaseAdmin
      .from('onboarding_status')
      .upsert({
        user_id: userId,
        completed: true,
        completed_at: new Date().toISOString(),
        current_step: 3,
      data: { companyName, industry, teamSize, cnpj, workspaceName, workspaceSlug, pipelineType, selectedPlanId: planId }
      }, {
        onConflict: 'user_id'
      });

    if (statusError) {
      console.error('[Onboarding] Failed to complete onboarding:', statusError);
      throw new Error('Não foi possível completar o onboarding');
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        organization: org,
        message: 'Workspace criado com sucesso!' 
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: any) {
    console.error('[Onboarding] Fatal error:', error);
    
    // Determine appropriate status code and generic message
    let status = 500;
    let message = 'Erro ao criar workspace';
    
    if (error.message?.includes('autenticado') || error.message?.includes('Unauthorized')) {
      status = 401;
      message = 'Usuário não autenticado';
    } else if (error.message?.includes('já está em uso')) {
      status = 409;
      message = 'Este endereço já está em uso';
    } else if (error.message?.includes('inválido') || error.message?.includes('incompleto') || error.message?.includes('Configuração')) {
      status = 400;
      message = 'Dados inválidos ou incompletos';
    }
    
    return new Response(
      JSON.stringify({ error: message }),
      { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
