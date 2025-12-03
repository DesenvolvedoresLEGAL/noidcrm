import { supabase } from '@/integrations/supabase/client';

export interface CustomFieldGroup {
  id: string;
  organization_id: string;
  name: string;
  entity_type: string;
  display_order: number;
  is_collapsed_default: boolean;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface CustomField {
  id: string;
  organization_id: string;
  group_id: string | null;
  field_key: string;
  label: string;
  field_type: string;
  entity_type: string;
  options: any[];
  validation_rules: Record<string, any>;
  visibility_config: {
    locations: string[];
    permissions: {
      view: string[];
      edit: string[];
    };
  };
  is_required: boolean;
  is_active: boolean;
  display_order: number;
  default_value: string | null;
  help_text: string | null;
  created_at: string;
  updated_at: string;
  group?: CustomFieldGroup;
}

export interface CustomFieldValue {
  id: string;
  organization_id: string;
  custom_field_id: string;
  entity_id: string;
  entity_type: string;
  value: any;
  created_at: string;
  updated_at: string;
  custom_field?: CustomField;
}

export type EntityType = 'account' | 'contact' | 'opportunity' | 'proposal' | 'activity' | 'product';

export type FieldType = 
  | 'text' 
  | 'textarea' 
  | 'number' 
  | 'currency' 
  | 'date' 
  | 'datetime' 
  | 'boolean' 
  | 'select' 
  | 'multi_select' 
  | 'email' 
  | 'phone' 
  | 'url' 
  | 'user' 
  | 'formula';

export const ENTITY_LABELS: Record<EntityType, string> = {
  account: 'Empresas',
  contact: 'Contatos',
  opportunity: 'Oportunidades',
  proposal: 'Propostas',
  activity: 'Atividades',
  product: 'Produtos',
};

export const FIELD_TYPE_LABELS: Record<FieldType, string> = {
  text: 'Texto',
  textarea: 'Texto Longo',
  number: 'Número',
  currency: 'Moeda',
  date: 'Data',
  datetime: 'Data e Hora',
  boolean: 'Sim/Não',
  select: 'Lista de Opções',
  multi_select: 'Múltipla Escolha',
  email: 'E-mail',
  phone: 'Telefone',
  url: 'URL',
  user: 'Usuário',
  formula: 'Fórmula',
};

export const LOCATION_LABELS: Record<string, string> = {
  form_create: 'Formulário de Criação',
  form_edit: 'Formulário de Edição',
  detail_page: 'Página de Detalhes',
  detail_sidebar: 'Sidebar de Detalhes',
  kanban_card: 'Card do Kanban',
  list_table: 'Tabela de Listagem',
};

// Custom Field Groups CRUD
export async function listCustomFieldGroups(entityType?: EntityType): Promise<CustomFieldGroup[]> {
  let query = supabase
    .from('custom_field_groups')
    .select('*')
    .order('display_order', { ascending: true });

  if (entityType) {
    query = query.eq('entity_type', entityType);
  }

  const { data, error } = await query;
  if (error) throw error;
  return (data || []) as CustomFieldGroup[];
}

export async function createCustomFieldGroup(
  group: Omit<CustomFieldGroup, 'id' | 'organization_id' | 'created_at' | 'updated_at'>
): Promise<CustomFieldGroup> {
  const { data: orgId } = await supabase.rpc('get_user_organization_id');
  if (!orgId) throw new Error('User must belong to an organization');

  const { data, error } = await supabase
    .from('custom_field_groups')
    .insert({ ...group, organization_id: orgId })
    .select()
    .single();

  if (error) throw error;
  return data as CustomFieldGroup;
}

export async function updateCustomFieldGroup(
  id: string,
  updates: Partial<CustomFieldGroup>
): Promise<CustomFieldGroup> {
  const { data, error } = await supabase
    .from('custom_field_groups')
    .update(updates)
    .eq('id', id)
    .select()
    .single();

  if (error) throw error;
  return data as CustomFieldGroup;
}

export async function deleteCustomFieldGroup(id: string): Promise<void> {
  const { error } = await supabase
    .from('custom_field_groups')
    .delete()
    .eq('id', id);

  if (error) throw error;
}

// Custom Fields CRUD
export async function listCustomFields(entityType?: EntityType): Promise<CustomField[]> {
  let query = supabase
    .from('custom_fields')
    .select('*, group:custom_field_groups(*)')
    .order('display_order', { ascending: true });

  if (entityType) {
    query = query.eq('entity_type', entityType);
  }

  const { data, error } = await query;
  if (error) throw error;
  return (data || []) as CustomField[];
}

export async function getCustomField(id: string): Promise<CustomField | null> {
  const { data, error } = await supabase
    .from('custom_fields')
    .select('*, group:custom_field_groups(*)')
    .eq('id', id)
    .single();

  if (error) throw error;
  return data as CustomField;
}

export async function createCustomField(
  field: Omit<CustomField, 'id' | 'organization_id' | 'created_at' | 'updated_at' | 'group'>
): Promise<CustomField> {
  const { data: orgId } = await supabase.rpc('get_user_organization_id');
  if (!orgId) throw new Error('User must belong to an organization');

  const { data, error } = await supabase
    .from('custom_fields')
    .insert({ ...field, organization_id: orgId })
    .select('*, group:custom_field_groups(*)')
    .single();

  if (error) throw error;
  return data as CustomField;
}

export async function updateCustomField(
  id: string,
  updates: Partial<CustomField>
): Promise<CustomField> {
  const { group, ...updateData } = updates;
  
  const { data, error } = await supabase
    .from('custom_fields')
    .update(updateData)
    .eq('id', id)
    .select('*, group:custom_field_groups(*)')
    .single();

  if (error) throw error;
  return data as CustomField;
}

export async function deleteCustomField(id: string): Promise<void> {
  const { error } = await supabase
    .from('custom_fields')
    .delete()
    .eq('id', id);

  if (error) throw error;
}

export async function reorderCustomFields(fields: { id: string; display_order: number }[]): Promise<void> {
  for (const field of fields) {
    const { error } = await supabase
      .from('custom_fields')
      .update({ display_order: field.display_order })
      .eq('id', field.id);
    
    if (error) throw error;
  }
}

// Custom Field Values CRUD
export async function getCustomFieldValues(
  entityId: string,
  entityType: EntityType
): Promise<CustomFieldValue[]> {
  const { data, error } = await supabase
    .from('custom_field_values')
    .select('*, custom_field:custom_fields(*)')
    .eq('entity_id', entityId)
    .eq('entity_type', entityType);

  if (error) throw error;
  return (data || []) as CustomFieldValue[];
}

export async function saveCustomFieldValue(
  customFieldId: string,
  entityId: string,
  entityType: EntityType,
  value: any
): Promise<CustomFieldValue> {
  const { data: orgId } = await supabase.rpc('get_user_organization_id');
  if (!orgId) throw new Error('User must belong to an organization');

  const { data, error } = await supabase
    .from('custom_field_values')
    .upsert({
      custom_field_id: customFieldId,
      entity_id: entityId,
      entity_type: entityType,
      value,
      organization_id: orgId,
    }, {
      onConflict: 'custom_field_id,entity_id'
    })
    .select()
    .single();

  if (error) throw error;
  return data as CustomFieldValue;
}

export async function saveMultipleCustomFieldValues(
  entityId: string,
  entityType: EntityType,
  values: Record<string, any>
): Promise<void> {
  const { data: orgId } = await supabase.rpc('get_user_organization_id');
  if (!orgId) throw new Error('User must belong to an organization');

  const upsertData = Object.entries(values).map(([customFieldId, value]) => ({
    custom_field_id: customFieldId,
    entity_id: entityId,
    entity_type: entityType,
    value,
    organization_id: orgId,
  }));

  const { error } = await supabase
    .from('custom_field_values')
    .upsert(upsertData, {
      onConflict: 'custom_field_id,entity_id'
    });

  if (error) throw error;
}

export async function deleteCustomFieldValue(id: string): Promise<void> {
  const { error } = await supabase
    .from('custom_field_values')
    .delete()
    .eq('id', id);

  if (error) throw error;
}

// Validation helpers
export function validateFieldValue(value: any, field: CustomField): string | null {
  const rules = field.validation_rules || {};

  if (field.is_required && (value === null || value === undefined || value === '')) {
    return `${field.label} é obrigatório`;
  }

  if (value === null || value === undefined || value === '') {
    return null;
  }

  switch (field.field_type) {
    case 'email':
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) {
        return 'E-mail inválido';
      }
      break;
    case 'phone':
      if (!/^\+?[\d\s()-]{8,}$/.test(value)) {
        return 'Telefone inválido';
      }
      break;
    case 'url':
      try {
        new URL(value);
      } catch {
        return 'URL inválida';
      }
      break;
    case 'number':
    case 'currency':
      const num = parseFloat(value);
      if (isNaN(num)) {
        return 'Valor numérico inválido';
      }
      if (rules.min !== undefined && num < rules.min) {
        return `Valor mínimo: ${rules.min}`;
      }
      if (rules.max !== undefined && num > rules.max) {
        return `Valor máximo: ${rules.max}`;
      }
      break;
    case 'text':
    case 'textarea':
      if (rules.minLength && value.length < rules.minLength) {
        return `Mínimo ${rules.minLength} caracteres`;
      }
      if (rules.maxLength && value.length > rules.maxLength) {
        return `Máximo ${rules.maxLength} caracteres`;
      }
      if (rules.pattern && !new RegExp(rules.pattern).test(value)) {
        return rules.patternMessage || 'Formato inválido';
      }
      break;
  }

  return null;
}

// Format helpers
export function formatFieldValue(value: any, field: CustomField): string {
  if (value === null || value === undefined) return '-';

  switch (field.field_type) {
    case 'currency':
      return new Intl.NumberFormat('pt-BR', {
        style: 'currency',
        currency: 'BRL'
      }).format(value);
    case 'number':
      return new Intl.NumberFormat('pt-BR').format(value);
    case 'date':
      return new Date(value).toLocaleDateString('pt-BR');
    case 'datetime':
      return new Date(value).toLocaleString('pt-BR');
    case 'boolean':
      return value ? 'Sim' : 'Não';
    case 'multi_select':
      return Array.isArray(value) ? value.join(', ') : value;
    default:
      return String(value);
  }
}
