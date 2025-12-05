import { supabase } from '@/integrations/supabase/client';

export interface LeadIngestionData {
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
  
  // Routing
  force_seller_id?: string;
}

export interface LeadIngestionResult {
  account_id: string;
  contact_id: string | null;
  opportunity_id: string;
  lead_grade: string;
  fit_score: number;
  intent_score: number;
  assigned_seller_id: string;
  pipeline_type: string;
}

export async function ingestLead(
  lead: LeadIngestionData,
  organizationId: string
): Promise<LeadIngestionResult> {
  const { data, error } = await supabase.functions.invoke('ingest-lead', {
    body: {
      lead,
      organization_id: organizationId,
    },
  });

  if (error) {
    console.error('Error ingesting lead:', error);
    throw new Error('Failed to ingest lead');
  }

  if (!data?.success) {
    throw new Error(data?.error || 'Failed to ingest lead');
  }

  return data.data;
}

export async function ingestLeadsBulk(
  leads: LeadIngestionData[],
  organizationId: string,
  onProgress?: (current: number, total: number) => void
): Promise<{ success: LeadIngestionResult[]; failed: { lead: LeadIngestionData; error: string }[] }> {
  const results: LeadIngestionResult[] = [];
  const failed: { lead: LeadIngestionData; error: string }[] = [];

  const batchSize = 5;
  for (let i = 0; i < leads.length; i += batchSize) {
    const batch = leads.slice(i, i + batchSize);
    
    await Promise.all(
      batch.map(async (lead) => {
        try {
          const result = await ingestLead(lead, organizationId);
          results.push(result);
        } catch (error) {
          failed.push({
            lead,
            error: error instanceof Error ? error.message : 'Unknown error',
          });
        }
      })
    );

    onProgress?.(Math.min(i + batchSize, leads.length), leads.length);
  }

  return { success: results, failed };
}

export function createLeadFromForm(formData: {
  empresa: string;
  cnpj?: string;
  website?: string;
  telefone?: string;
  segmento?: string;
  contato_nome?: string;
  contato_email?: string;
  contato_telefone?: string;
  contato_cargo?: string;
  origem?: string;
  valor_estimado?: number;
  produto?: string;
}): LeadIngestionData {
  return {
    razao_social: formData.empresa,
    nome_fantasia: formData.empresa,
    cnpj: formData.cnpj,
    website: formData.website,
    telefone: formData.telefone,
    segmento: formData.segmento,
    contact_nome: formData.contato_nome,
    contact_email: formData.contato_email,
    contact_telefone: formData.contato_telefone,
    contact_cargo: formData.contato_cargo,
    origem: formData.origem || 'manual',
    valor_estimado: formData.valor_estimado,
    produto: formData.produto,
  };
}

export async function previewLeadRouting(
  lead: LeadIngestionData,
  organizationId: string
): Promise<{
  estimated_grade: string;
  estimated_pipeline: string;
  factors: string[];
}> {
  // Calculate estimated grade based on available data
  let score = 50;
  const factors: string[] = [];

  if (lead.cnpj) {
    score += 10;
    factors.push('CNPJ fornecido (+10)');
  }

  if (lead.contact_email) {
    score += 15;
    factors.push('Email de contato (+15)');
  }

  if (lead.valor_estimado && lead.valor_estimado > 10000) {
    score += 20;
    factors.push('Valor estimado alto (+20)');
  }

  if (lead.segmento) {
    score += 5;
    factors.push('Segmento identificado (+5)');
  }

  if (lead.website) {
    score += 5;
    factors.push('Website fornecido (+5)');
  }

  let estimated_grade = 'C';
  if (score >= 80) estimated_grade = 'A';
  else if (score >= 65) estimated_grade = 'B';
  else if (score >= 50) estimated_grade = 'C';
  else if (score >= 35) estimated_grade = 'D';
  else estimated_grade = 'F';

  const estimated_pipeline = (estimated_grade === 'A' || estimated_grade === 'B') 
    ? 'Vendas (alta qualidade)' 
    : 'Qualificação (nutrição)';

  return {
    estimated_grade,
    estimated_pipeline,
    factors,
  };
}
