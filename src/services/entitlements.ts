import { supabase } from '@/integrations/supabase/client';

export async function checkLimit(
  organizationId: string,
  limitKey: string,
  currentCount: number
): Promise<{ allowed: boolean; limit: number; message?: string }> {
  
  // Buscar current_plan_id da org
  const { data: org } = await supabase
    .from('organizations')
    .select('current_plan_id')
    .eq('id', organizationId)
    .single();

  if (!org?.current_plan_id) {
    return { allowed: false, limit: 0, message: 'Organização sem plano definido' };
  }

  // Buscar entitlement
  const { data: ent } = await supabase
    .from('plan_entitlements')
    .select('value')
    .eq('plan_id', org.current_plan_id)
    .eq('key', limitKey)
    .maybeSingle();

  const limit = Number(ent?.value || 0);
  
  // Limites "ilimitados" representados por 999 ou 999999
  if (limit >= 999) {
    return { allowed: true, limit };
  }

  if (currentCount >= limit) {
    return {
      allowed: false,
      limit,
      message: `Você atingiu o limite de ${limitKey.replace('_limit', '')} do plano ${org.current_plan_id}. Faça upgrade para continuar.`,
    };
  }

  return { allowed: true, limit };
}

export async function incrementUsage(
  organizationId: string,
  metric: string,
  increment: number = 1
): Promise<void> {
  const period = new Date().toISOString().slice(0, 7); // YYYY-MM
  
  const { error } = await supabase.rpc('increment_usage', {
    p_org_id: organizationId,
    p_metric: metric,
    p_period: period,
    p_inc: increment,
  });

  if (error) {
    console.error('Error incrementing usage:', error);
    throw error;
  }
}
