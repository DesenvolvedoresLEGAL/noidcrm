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
  // Log request details for debugging
  const hasAuth = !!req.headers.get('Authorization');
  console.log('[ONBOARDING] Request:', {
    method: req.method,
    url: req.url,
    hasAuth,
    timestamp: new Date().toISOString()
  });

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
    console.log('[ONBOARDING-EDGE] Request details:', {
      method: req.method,
      url: req.url,
      hasAuth: !!authHeader,
    });

    if (!authHeader) {
      console.error('[ONBOARDING-EDGE] Missing Authorization header');
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

    const { data: { user }, error: authError } = await supabaseAdmin.auth.admin.getUserById(jwt);

    if (authError || !user) {
      console.error('[ONBOARDING-EDGE] Authentication error:', authError);
      return new Response(
        JSON.stringify({ error: 'Usuário não autenticado' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('[ONBOARDING-EDGE] User authenticated:', {
      id: user.id,
      email: user.email,
      email_confirmed_at: user.email_confirmed_at,
      created_at: user.created_at,
    });

    // Verificar se email está confirmado
    if (!user.email_confirmed_at) {
      console.error('[ONBOARDING-EDGE] Email não confirmado:', user.email);
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
    const { companyName, industry, teamSize, cnpj, workspaceName, workspaceSlug, pipelineType } = body;

    console.log('[ONBOARDING-EDGE] Payload recebido:', {
      companyName,
      industry,
      teamSize,
      workspaceName,
      workspaceSlug,
      pipelineType,
      hasCnpj: !!cnpj,
    });

    // Validate required fields
    if (!companyName || !workspaceName || !workspaceSlug || !pipelineType) {
      console.error('[ONBOARDING-EDGE] Campos obrigatórios ausentes:', {
        hasCompanyName: !!companyName,
        hasWorkspaceName: !!workspaceName,
        hasWorkspaceSlug: !!workspaceSlug,
        hasPipelineType: !!pipelineType,
      });
      return new Response(
        JSON.stringify({ 
          error: 'Dados incompletos. Por favor, preencha todos os campos obrigatórios.' 
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('[ONBOARDING-EDGE] Starting for user:', userId, { workspaceSlug, pipelineType });

    // 1. Verificar se slug já existe
    const { data: existingOrg } = await supabaseAdmin
      .from('organizations')
      .select('id')
      .eq('slug', workspaceSlug)
      .maybeSingle();

    if (existingOrg) {
      console.warn('[ONBOARDING-EDGE] Slug duplicado:', workspaceSlug);
      return new Response(
        JSON.stringify({ error: 'Este endereço já está em uso. Por favor, escolha outro.' }),
        { status: 409, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('[ONBOARDING-EDGE] Slug disponível, criando organização...');

    // 2. Criar organização
    console.log('Creating organization...');
    const { data: org, error: orgError } = await supabaseAdmin
      .from('organizations')
      .insert({
        name: workspaceName,
        slug: workspaceSlug,
        industry: industry,
        team_size: teamSize,
        cnpj: cnpj || null,
        status: 'trial',
        trial_ends_at: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString()
      })
      .select()
      .single();

    if (orgError) {
      console.error('Error creating organization:', orgError);
      throw new Error(`Erro ao criar organização: ${orgError.message}`);
    }

    console.log('Organization created:', org.id);

    // 3. Adicionar usuário como owner
    console.log('Adding user as owner...');
    const { error: memberError } = await supabaseAdmin
      .from('organization_members')
      .insert({
        user_id: userId,
        organization_id: org.id,
        role: 'owner',
        status: 'active',
        joined_at: new Date().toISOString()
      });

    if (memberError) {
      console.error('Error adding member:', memberError);
      throw new Error(`Erro ao adicionar membro: ${memberError.message}`);
    }

    // 4. Criar pipeline
    const template = PIPELINE_TEMPLATES[pipelineType as keyof typeof PIPELINE_TEMPLATES];
    if (!template) {
      throw new Error(`Tipo de pipeline inválido: ${pipelineType}`);
    }

    const pipelineId = `${org.id}-${template.type}-1`;
    console.log('Creating pipeline:', pipelineId);

    const { error: pipelineError } = await supabaseAdmin
      .from('pipelines')
      .insert({
        id: pipelineId,
        name: template.name,
        type: template.type,
        organization_id: org.id
      });

    if (pipelineError) {
      console.error('Error creating pipeline:', pipelineError);
      throw new Error(`Erro ao criar pipeline: ${pipelineError.message}`);
    }

    // 5. Criar stages
    console.log('Creating stages...');
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
      console.error('Error creating stages:', stagesError);
      throw new Error(`Erro ao criar estágios: ${stagesError.message}`);
    }

    // 6. Atualizar profile com organization_id
    console.log('Updating profile...');
    const { error: profileError } = await supabaseAdmin
      .from('profiles')
      .update({ organization_id: org.id })
      .eq('user_id', userId);

    if (profileError) {
      console.error('Error updating profile:', profileError);
      throw new Error(`Erro ao atualizar perfil: ${profileError.message}`);
    }

    // 7. Marcar onboarding como completo (UPSERT para garantir que existe)
    console.log('Completing onboarding...');
    const { error: statusError } = await supabaseAdmin
      .from('onboarding_status')
      .upsert({
        user_id: userId,
        completed: true,
        completed_at: new Date().toISOString(),
        current_step: 3,
        data: { companyName, industry, teamSize, cnpj, workspaceName, workspaceSlug, pipelineType }
      }, {
        onConflict: 'user_id'
      });

    if (statusError) {
      console.error('Error updating onboarding status:', statusError);
      throw new Error(`Erro ao completar onboarding: ${statusError.message}`);
    }

    console.log('[ONBOARDING] ✅ Completed successfully for user:', userId);

    return new Response(
      JSON.stringify({ 
        success: true, 
        organization: org,
        message: 'Workspace criado com sucesso!' 
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: any) {
    console.error('[ONBOARDING] ❌ Function error:', error);
    
    // Determine appropriate status code
    let status = 500;
    if (error.message?.includes('autenticado')) {
      status = 401;
    } else if (error.message?.includes('já está em uso')) {
      status = 409;
    } else if (error.message?.includes('inválido') || error.message?.includes('incompleto')) {
      status = 400;
    }
    
    return new Response(
      JSON.stringify({ error: error.message || 'Erro ao criar workspace' }),
      { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
