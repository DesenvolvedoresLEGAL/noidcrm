/**
 * MRR CALCULATIONS - SINGLE SOURCE OF TRUTH
 * 
 * Este arquivo centraliza TODO o cálculo de MRR da aplicação.
 * REGRAS:
 * 1. MRR é calculado a partir de proposal_payment_terms com payment_type = 'recurring' ou 'monthly'
 * 2. Deduplicação por account_id para evitar dobrar MRR quando há múltiplas oportunidades (Sales + CS)
 * 3. Organizações com current_plan_id = 'internal_full' são EXCLUÍDAS dos cálculos financeiros
 * 4. Apenas oportunidades de pipelines com pipeline_type = 'sales' são consideradas
 */

import { supabase } from "@/integrations/supabase/client";

// IDs de planos internos que devem ser excluídos de métricas financeiras
export const INTERNAL_PLAN_IDS = ['internal_full'];

export interface MRRResult {
  totalMRR: number;
  arr: number;
  mrrByAccount: Map<string, number>;
  accountsWithMRR: number;
}

export interface MRRCalculationOptions {
  organizationId: string;
  excludeInternalOrgs?: boolean;
  onlySalesPipelines?: boolean;
}

/**
 * Calcula MRR real baseado em propostas aceitas com termos recorrentes.
 * Esta é a ÚNICA função que deve ser usada para calcular MRR em toda a aplicação.
 */
export async function calculateRealMRR(options: MRRCalculationOptions): Promise<MRRResult> {
  const { organizationId, excludeInternalOrgs = false, onlySalesPipelines = true } = options;
  
  // 1. Se for admin global, verificar organizações internas
  let internalOrgIds = new Set<string>();
  if (excludeInternalOrgs) {
    const { data: internalOrgs } = await supabase
      .from("organizations")
      .select("id")
      .in("current_plan_id", INTERNAL_PLAN_IDS);
    
    internalOrgIds = new Set((internalOrgs || []).map(o => o.id));
  }
  
  // 2. Buscar pipelines de vendas se necessário
  let salesPipelineIds: string[] = [];
  if (onlySalesPipelines) {
    const { data: salesPipelines } = await supabase
      .from("pipelines")
      .select("id")
      .eq("organization_id", organizationId)
      .eq("pipeline_type", "sales");
    
    salesPipelineIds = (salesPipelines || []).map(p => p.id);
    
    // Se não há pipelines de vendas, retorna zero
    if (salesPipelineIds.length === 0) {
      return { totalMRR: 0, arr: 0, mrrByAccount: new Map(), accountsWithMRR: 0 };
    }
  }
  
  // 3. Buscar oportunidades won com account_id
  let opportunitiesQuery = supabase
    .from("opportunities")
    .select("id, account_id, pipeline_id")
    .eq("organization_id", organizationId)
    .eq("status", "won");
  
  if (onlySalesPipelines && salesPipelineIds.length > 0) {
    opportunitiesQuery = opportunitiesQuery.in("pipeline_id", salesPipelineIds);
  }
  
  const { data: opportunities } = await opportunitiesQuery;
  
  if (!opportunities || opportunities.length === 0) {
    return { totalMRR: 0, arr: 0, mrrByAccount: new Map(), accountsWithMRR: 0 };
  }
  
  // Mapear opportunity_id -> account_id
  const oppIdToAccountId = new Map<string, string>();
  opportunities.forEach(o => {
    if (o.id && o.account_id) {
      oppIdToAccountId.set(o.id, o.account_id);
    }
  });
  
  const opportunityIds = opportunities.map(o => o.id);
  
  // 4. Buscar propostas aceitas para essas oportunidades
  const { data: proposals } = await supabase
    .from("proposals")
    .select("id, opportunity_id, organization_id")
    .eq("organization_id", organizationId)
    .eq("status", "accepted")
    .in("opportunity_id", opportunityIds);
  
  if (!proposals || proposals.length === 0) {
    return { totalMRR: 0, arr: 0, mrrByAccount: new Map(), accountsWithMRR: 0 };
  }
  
  // Filtrar propostas de organizações internas se necessário
  const billableProposals = excludeInternalOrgs
    ? proposals.filter(p => !internalOrgIds.has(p.organization_id))
    : proposals;
  
  const proposalIds = billableProposals.map(p => p.id);
  
  if (proposalIds.length === 0) {
    return { totalMRR: 0, arr: 0, mrrByAccount: new Map(), accountsWithMRR: 0 };
  }
  
  // 5. Buscar termos de pagamento recorrentes
  const { data: paymentTerms } = await supabase
    .from("proposal_payment_terms")
    .select("proposal_id, monthly_value, payment_type")
    .in("proposal_id", proposalIds)
    .in("payment_type", ["recurring", "monthly", "subscription"]);
  
  if (!paymentTerms || paymentTerms.length === 0) {
    return { totalMRR: 0, arr: 0, mrrByAccount: new Map(), accountsWithMRR: 0 };
  }
  
  // Mapear proposal_id -> opportunity_id
  const proposalToOppId = new Map<string, string>();
  billableProposals.forEach(p => {
    if (p.id && p.opportunity_id) {
      proposalToOppId.set(p.id, p.opportunity_id);
    }
  });
  
  // 6. Agregar MRR por account_id (usando o maior valor em caso de duplicatas)
  const mrrByAccount = new Map<string, number>();
  
  paymentTerms.forEach(term => {
    const oppId = proposalToOppId.get(term.proposal_id);
    if (!oppId) return;
    
    const accountId = oppIdToAccountId.get(oppId);
    if (!accountId) return;
    
    const currentMRR = mrrByAccount.get(accountId) || 0;
    const termValue = term.monthly_value || 0;
    
    // Usar o maior MRR encontrado para cada conta (evita somar Sales + CS)
    mrrByAccount.set(accountId, Math.max(currentMRR, currentMRR + termValue));
  });
  
  // 7. Calcular total
  const totalMRR = Array.from(mrrByAccount.values()).reduce((sum, v) => sum + v, 0);
  
  return {
    totalMRR,
    arr: totalMRR * 12,
    mrrByAccount,
    accountsWithMRR: mrrByAccount.size
  };
}

/**
 * Calcula MRR global para admin dashboard (todas as organizações, excluindo internas)
 * 
 * Fontes de MRR (em ordem de prioridade):
 * 1. proposal_payment_terms com payment_type recorrente
 * 2. organizations.calculated_mrr como fallback para orgs sem propostas
 */
export async function calculateGlobalMRR(): Promise<{
  totalMRR: number;
  totalARR: number;
  billableOrgsCount: number;
}> {
  // 1. Buscar todas as organizações ativas/trial não-internas
  const { data: billableOrgs } = await supabase
    .from("organizations")
    .select("id, calculated_mrr")
    .in("status", ["active", "trial"])
    .or("current_plan_id.is.null,current_plan_id.not.in.(internal_full)");
  
  if (!billableOrgs || billableOrgs.length === 0) {
    return { totalMRR: 0, totalARR: 0, billableOrgsCount: 0 };
  }
  
  const billableOrgIds = billableOrgs.map(o => o.id);
  
  // 2. Buscar propostas aceitas dessas organizações
  const { data: acceptedProposals } = await supabase
    .from("proposals")
    .select("id, organization_id")
    .eq("status", "accepted")
    .in("organization_id", billableOrgIds);
  
  const proposalMrrByOrg = new Map<string, number>();
  
  if (acceptedProposals && acceptedProposals.length > 0) {
    const proposalIds = acceptedProposals.map(p => p.id);
    
    // 3. Buscar termos recorrentes
    const { data: paymentTerms } = await supabase
      .from("proposal_payment_terms")
      .select("proposal_id, monthly_value")
      .in("proposal_id", proposalIds)
      .in("payment_type", ["recurring", "monthly", "subscription"]);
    
    // Mapear proposal_id -> organization_id
    const proposalToOrg = new Map(acceptedProposals.map(p => [p.id, p.organization_id]));
    
    // Agregar MRR por organização
    (paymentTerms || []).forEach(term => {
      const orgId = proposalToOrg.get(term.proposal_id);
      if (orgId) {
        const current = proposalMrrByOrg.get(orgId) || 0;
        proposalMrrByOrg.set(orgId, current + (term.monthly_value || 0));
      }
    });
  }
  
  // 4. Calcular MRR total: usar proposal_payment_terms quando disponível, senão usar calculated_mrr
  let totalMRR = 0;
  let orgsWithMRR = 0;
  
  billableOrgs.forEach(org => {
    const proposalMrr = proposalMrrByOrg.get(org.id) || 0;
    const calculatedMrr = org.calculated_mrr || 0;
    
    // Priorizar MRR de propostas, usar calculated_mrr como fallback
    const orgMrr = proposalMrr > 0 ? proposalMrr : calculatedMrr;
    
    if (orgMrr > 0) {
      totalMRR += orgMrr;
      orgsWithMRR++;
    }
  });
  
  return {
    totalMRR,
    totalARR: totalMRR * 12,
    billableOrgsCount: orgsWithMRR
  };
}

/**
 * Calcula MRR fechado em um período específico (para métricas de "Novo MRR")
 */
export async function calculateClosedMRRInPeriod(
  organizationId: string,
  startDate: Date,
  endDate: Date
): Promise<number> {
  // 1. Buscar pipelines de vendas
  const { data: salesPipelines } = await supabase
    .from("pipelines")
    .select("id")
    .eq("organization_id", organizationId)
    .eq("pipeline_type", "sales");
  
  const salesPipelineIds = (salesPipelines || []).map(p => p.id);
  
  if (salesPipelineIds.length === 0) return 0;
  
  // 2. Buscar oportunidades won no período de pipelines de vendas
  const { data: wonOpportunities } = await supabase
    .from("opportunities")
    .select("id")
    .eq("organization_id", organizationId)
    .eq("status", "won")
    .in("pipeline_id", salesPipelineIds)
    .gte("updated_at", startDate.toISOString())
    .lte("updated_at", endDate.toISOString());
  
  if (!wonOpportunities || wonOpportunities.length === 0) return 0;
  
  const opportunityIds = wonOpportunities.map(o => o.id);
  
  // 3. Buscar propostas aceitas para essas oportunidades
  const { data: proposals } = await supabase
    .from("proposals")
    .select("id")
    .eq("organization_id", organizationId)
    .eq("status", "accepted")
    .in("opportunity_id", opportunityIds);
  
  if (!proposals || proposals.length === 0) return 0;
  
  const proposalIds = proposals.map(p => p.id);
  
  // 4. Buscar termos recorrentes
  const { data: paymentTerms } = await supabase
    .from("proposal_payment_terms")
    .select("monthly_value")
    .in("proposal_id", proposalIds)
    .in("payment_type", ["recurring", "monthly", "subscription"]);
  
  return (paymentTerms || []).reduce((sum, t) => sum + (t.monthly_value || 0), 0);
}
