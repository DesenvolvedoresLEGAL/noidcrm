import { supabase } from '@/integrations/supabase/client';

export interface DynamicVariable {
  id: string;
  organization_id: string | null;
  variable_key: string;
  label: string;
  category: string;
  description: string | null;
  source_entity: string | null;
  source_field: string | null;
  format_type: string | null;
  is_system: boolean;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface VariableContext {
  organization?: any;
  account?: any;
  contact?: any;
  proposal?: any;
  owner?: any;
  opportunity?: any;
  customFieldValues?: Record<string, any>;
}

// List all dynamic variables
export async function listDynamicVariables(): Promise<DynamicVariable[]> {
  const { data, error } = await supabase
    .from('dynamic_variables')
    .select('*')
    .eq('is_active', true)
    .order('category', { ascending: true })
    .order('label', { ascending: true });

  if (error) throw error;
  return (data || []) as DynamicVariable[];
}

// Get variables grouped by category
export async function getVariablesByCategory(): Promise<Record<string, DynamicVariable[]>> {
  const variables = await listDynamicVariables();
  
  return variables.reduce((acc, variable) => {
    if (!acc[variable.category]) {
      acc[variable.category] = [];
    }
    acc[variable.category].push(variable);
    return acc;
  }, {} as Record<string, DynamicVariable[]>);
}

// Create custom dynamic variable
export async function createDynamicVariable(
  variable: Omit<DynamicVariable, 'id' | 'organization_id' | 'created_at' | 'updated_at' | 'is_system'>
): Promise<DynamicVariable> {
  const { data: orgId } = await supabase.rpc('get_user_organization_id');
  if (!orgId) throw new Error('User must belong to an organization');

  const { data, error } = await supabase
    .from('dynamic_variables')
    .insert({ 
      ...variable, 
      organization_id: orgId,
      is_system: false 
    })
    .select()
    .single();

  if (error) throw error;
  return data as DynamicVariable;
}

// Update custom dynamic variable
export async function updateDynamicVariable(
  id: string,
  updates: Partial<DynamicVariable>
): Promise<DynamicVariable> {
  const { data, error } = await supabase
    .from('dynamic_variables')
    .update(updates)
    .eq('id', id)
    .eq('is_system', false)
    .select()
    .single();

  if (error) throw error;
  return data as DynamicVariable;
}

// Delete custom dynamic variable
export async function deleteDynamicVariable(id: string): Promise<void> {
  const { error } = await supabase
    .from('dynamic_variables')
    .delete()
    .eq('id', id)
    .eq('is_system', false);

  if (error) throw error;
}

// Format helpers
function formatCurrency(value?: number): string {
  if (!value) return '';
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL'
  }).format(value);
}

function formatCNPJ(cnpj?: string): string {
  if (!cnpj) return '';
  const cleaned = cnpj.replace(/\D/g, '');
  if (cleaned.length !== 14) return cnpj;
  return cleaned.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, '$1.$2.$3/$4-$5');
}

function formatPhone(phone?: string): string {
  if (!phone) return '';
  const cleaned = phone.replace(/\D/g, '');
  if (cleaned.length === 11) {
    return cleaned.replace(/^(\d{2})(\d{5})(\d{4})$/, '($1) $2-$3');
  } else if (cleaned.length === 10) {
    return cleaned.replace(/^(\d{2})(\d{4})(\d{4})$/, '($1) $2-$3');
  }
  return phone;
}

function formatAddress(entity?: any): string {
  if (!entity) return '';
  const parts = [
    entity.logradouro || entity.address_street,
    entity.numero || entity.address_number,
    entity.complemento || entity.address_complement,
    entity.bairro,
    entity.cidade || entity.address_city,
    entity.uf || entity.address_state,
    entity.cep || entity.address_zip,
  ].filter(Boolean);
  return parts.join(', ');
}

function formatDate(dateStr?: string): string {
  if (!dateStr) return '';
  try {
    const date = new Date(dateStr);
    return date.toLocaleDateString('pt-BR');
  } catch {
    return '';
  }
}

function formatDateExtended(dateStr?: string): string {
  if (!dateStr) return '';
  try {
    const date = new Date(dateStr);
    return date.toLocaleDateString('pt-BR', {
      day: 'numeric',
      month: 'long',
      year: 'numeric'
    });
  } catch {
    return '';
  }
}

// Resolve a single variable value
export function resolveVariable(variableKey: string, context: VariableContext): string {
  const { organization, account, contact, proposal, owner, opportunity, customFieldValues } = context;

  // Check for custom field value first
  if (customFieldValues && variableKey.startsWith('custom_')) {
    const fieldId = variableKey.replace('custom_', '');
    const value = customFieldValues[fieldId];
    return value !== undefined && value !== null ? String(value) : '';
  }

  // System variables
  switch (variableKey) {
    // Organization
    case 'org_nome':
      return organization?.name || organization?.legal_name || '';
    case 'org_cnpj':
      return formatCNPJ(organization?.cnpj);
    case 'org_endereco':
      return formatAddress(organization);
    case 'org_telefone':
      return formatPhone(organization?.phone);
    case 'org_email':
      return organization?.email || '';
    case 'org_website':
      return organization?.website || '';

    // Client/Account
    case 'cliente_nome':
      return account?.nome_fantasia || account?.razao_social || '';
    case 'cliente_razao_social':
      return account?.razao_social || '';
    case 'cliente_cnpj':
      return formatCNPJ(account?.cnpj);
    case 'cliente_endereco':
      return formatAddress(account);
    case 'cliente_cidade':
      return account?.cidade || '';
    case 'cliente_estado':
      return account?.uf || '';
    case 'cliente_telefone':
      const telefones = account?.telefones;
      if (Array.isArray(telefones) && telefones.length > 0) {
        return formatPhone(telefones[0]?.numero || telefones[0]);
      }
      return '';
    case 'cliente_email':
      const emails = account?.emails;
      if (Array.isArray(emails) && emails.length > 0) {
        return emails[0];
      }
      return '';

    // Contact
    case 'contato_nome':
      return contact?.nome || '';
    case 'contato_cargo':
      return contact?.cargo || '';
    case 'contato_email':
      const contactEmails = contact?.emails;
      if (Array.isArray(contactEmails) && contactEmails.length > 0) {
        return contactEmails[0];
      }
      return '';
    case 'contato_telefone':
      const contactPhones = contact?.telefones;
      if (Array.isArray(contactPhones) && contactPhones.length > 0) {
        return formatPhone(contactPhones[0]);
      }
      return '';

    // Proposal
    case 'proposta_numero':
      return proposal?.proposal_number || '';
    case 'proposta_versao':
      return proposal?.proposal_version ? `v${proposal.proposal_version}` : 'v1';
    case 'proposta_titulo':
      return proposal?.title || '';
    case 'proposta_valor':
      return formatCurrency(proposal?.value);
    case 'proposta_validade':
      return formatDate(proposal?.expires_at);
    case 'proposta_data_criacao':
      return formatDate(proposal?.created_at);

    // Owner/Salesperson
    case 'vendedor_nome':
      return owner?.full_name || '';
    case 'vendedor_email':
      return owner?.email || '';
    case 'vendedor_telefone':
      return formatPhone(owner?.phone);

    // Date/Time
    case 'data_hoje':
      return new Date().toLocaleDateString('pt-BR');
    case 'data_hoje_extenso':
      return formatDateExtended(new Date().toISOString());
    case 'hora_atual':
      return new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });

    // Opportunity
    case 'oportunidade_titulo':
      return opportunity?.title || '';
    case 'oportunidade_valor':
      return formatCurrency(opportunity?.valor_previsto);
    case 'oportunidade_probabilidade':
      return opportunity?.prob ? `${opportunity.prob}%` : '';

    default:
      return '';
  }
}

// Replace all variables in a text
export function replaceAllVariables(text: string, context: VariableContext): string {
  if (!text) return '';

  // Pattern to match {{variable_key}}
  const variablePattern = /\{\{(\w+)\}\}/g;

  return text.replace(variablePattern, (match, variableKey) => {
    const value = resolveVariable(variableKey, context);
    return value || match; // Keep original if no value found
  });
}

// Get preview values for all variables
export async function getVariablePreviewValues(context: VariableContext): Promise<Record<string, string>> {
  const variables = await listDynamicVariables();
  const preview: Record<string, string> = {};

  for (const variable of variables) {
    preview[variable.variable_key] = resolveVariable(variable.variable_key, context);
  }

  return preview;
}
