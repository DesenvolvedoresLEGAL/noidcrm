import { supabase } from '@/integrations/supabase/client';

export interface OnboardingData {
  companyName: string;
  industry: string;
  teamSize: string;
  cnpj?: string;
  workspaceName: string;
  workspaceSlug: string;
  pipelineType: 'b2b' | 'b2c' | 'enterprise' | 'custom';
}

export interface OnboardingStatus {
  id: string;
  user_id: string;
  completed: boolean;
  current_step: number;
  data: Record<string, any>;
  created_at: string;
  completed_at: string | null;
}

const PIPELINE_TEMPLATES = {
  b2b: {
    name: 'Vendas B2B',
    type: 'sales' as const,
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
    type: 'sales' as const,
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
    type: 'sales' as const,
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
    type: 'sales' as const,
    stages: [
      { name: 'Novo', order_index: 0, color: '#64748b' },
      { name: 'Em andamento', order_index: 1, color: '#3b82f6' },
      { name: 'Concluído', order_index: 2, color: '#10b981' }
    ]
  }
};

export async function getOnboardingStatus(): Promise<OnboardingStatus | null> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const { data, error } = await supabase
    .from('onboarding_status')
    .select('*')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  // PGRST116 = no rows found (not an error)
  if (error && error.code !== 'PGRST116') throw error;
  if (!data) return null;
  
  return {
    ...data,
    data: (data.data as any) || {}
  };
}

export async function updateOnboardingStep(step: number, data?: Record<string, any>) {
  const { error } = await supabase
    .from('onboarding_status')
    .update({ 
      current_step: step,
      data: data || {}
    })
    .eq('user_id', (await supabase.auth.getUser()).data.user?.id);

  if (error) throw error;
}

export async function checkSlugAvailability(slug: string): Promise<boolean> {
  const { data, error } = await supabase
    .from('organizations')
    .select('id')
    .eq('slug', slug)
    .maybeSingle();

  if (error) throw error;
  return !data; // true if available (no data found)
}

export async function completeOnboarding(userId: string, data: OnboardingData) {
  // 1. Create organization
  const { data: org, error: orgError } = await supabase
    .from('organizations')
    .insert({
      name: data.workspaceName,
      slug: data.workspaceSlug,
      industry: data.industry,
      team_size: data.teamSize,
      cnpj: data.cnpj,
      status: 'trial',
      trial_ends_at: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString()
    })
    .select()
    .single();

  if (orgError) throw orgError;

  // 2. Add user as owner
  const { error: memberError } = await supabase
    .from('organization_members')
    .insert({
      user_id: userId,
      organization_id: org.id,
      role: 'owner',
      status: 'active',
      joined_at: new Date().toISOString()
    });

  if (memberError) throw memberError;

  // 3. Create pipeline
  const template = PIPELINE_TEMPLATES[data.pipelineType];
  const pipelineId = `${org.id}-${template.type}-1`;
  
  const { error: pipelineError } = await supabase
    .from('pipelines')
    .insert({
      id: pipelineId,
      name: template.name,
      type: template.type,
      organization_id: org.id
    });

  if (pipelineError) throw pipelineError;

  // 4. Create stages
  const stagesData = template.stages.map(stage => ({
    id: `${pipelineId}-stage-${stage.order_index}`,
    pipeline_id: pipelineId,
    name: stage.name,
    order_index: stage.order_index,
    color: stage.color,
    organization_id: org.id
  }));

  const { error: stagesError } = await supabase
    .from('stages')
    .insert(stagesData);

  if (stagesError) throw stagesError;

  // 5. Update profile with organization_id
  const { error: profileError } = await supabase
    .from('profiles')
    .update({ organization_id: org.id })
    .eq('user_id', userId);

  if (profileError) throw profileError;

  // 6. Mark onboarding as completed
  const { error: statusError } = await supabase
    .from('onboarding_status')
    .update({ 
      completed: true, 
      completed_at: new Date().toISOString() 
    })
    .eq('user_id', userId);

  if (statusError) throw statusError;

  return org;
}
