import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

export interface VariableCategory {
  name: string;
  variables: Record<string, string>;
}

export const PROPOSAL_VARIABLES: VariableCategory[] = [
  {
    name: 'Organização',
    variables: {
      '{{org_nome}}': 'Nome da empresa vendedora',
      '{{org_cnpj}}': 'CNPJ formatado',
      '{{org_razao_social}}': 'Razão social da empresa',
      '{{org_endereco}}': 'Endereço completo',
      '{{org_cidade}}': 'Cidade',
      '{{org_estado}}': 'Estado',
      '{{org_telefone}}': 'Telefone',
      '{{org_email}}': 'Email comercial',
      '{{org_website}}': 'Website',
    },
  },
  {
    name: 'Cliente/Conta',
    variables: {
      '{{cliente_razao_social}}': 'Razão social do cliente',
      '{{cliente_nome_fantasia}}': 'Nome fantasia',
      '{{cliente_cnpj}}': 'CNPJ do cliente',
      '{{cliente_segmento}}': 'Segmento de atuação',
      '{{cliente_tamanho}}': 'Tamanho da empresa',
    },
  },
  {
    name: 'Contato',
    variables: {
      '{{contato_nome}}': 'Nome do contato',
      '{{contato_email}}': 'Email do contato',
      '{{contato_telefone}}': 'Telefone do contato',
      '{{contato_cargo}}': 'Cargo do contato',
    },
  },
  {
    name: 'Proposta',
    variables: {
  // Proposta
  '{{proposta_numero}}': 'Número da proposta (ex: PROP-2025-00001)',
  '{{proposta_versao}}': 'Versão atual (ex: v1, v2)',
  '{{proposta_data}}': 'Data de criação',
  '{{proposta_validade}}': 'Data de validade',
  '{{proposta_total}}': 'Valor total formatado',
  '{{proposta_moeda}}': 'Moeda da proposta (BRL, USD, EUR)',
    },
  },
  {
    name: 'Vendedor',
    variables: {
      '{{vendedor_nome}}': 'Nome do vendedor responsável',
      '{{vendedor_email}}': 'Email do vendedor',
      '{{vendedor_telefone}}': 'Telefone do vendedor',
    },
  },
  {
    name: 'Data/Hora',
    variables: {
      '{{data_hoje}}': 'Data de hoje',
      '{{data_hoje_extenso}}': 'Data por extenso',
      '{{hora_atual}}': 'Hora atual',
    },
  },
];

export interface VariableContext {
  // Organization
  organization?: {
    name?: string;
    cnpj?: string;
    legal_name?: string;
    address_street?: string;
    address_number?: string;
    address_complement?: string;
    address_city?: string;
    address_state?: string;
    address_zip?: string;
    phone?: string;
    email?: string;
    website?: string;
  };
  
  // Account/Client
  account?: {
    razao_social?: string;
    nome_fantasia?: string;
    cnpj?: string;
    segmento?: string;
    tamanho?: string;
  };
  
  // Contact
  contact?: {
    nome?: string;
    emails?: string[];
    telefones?: string[];
    cargo?: string;
  };
  
  // Proposal
  proposal?: {
    title?: string;
    id?: string;
    version?: number;
    proposal_number?: string;
    proposal_version?: number;
    currency?: string;
    created_at?: string;
    expires_at?: string;
    total_amount?: number;
    subtotal?: number;
  };
  
  // Opportunity
  opportunity?: any;
  
  // Owner/Seller
  owner?: {
    full_name?: string;
    email?: string;
    phone?: string;
  };
}

function formatCurrency(value?: number): string {
  if (!value) return 'R$ 0,00';
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
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

function formatAddress(org?: VariableContext['organization']): string {
  if (!org) return '';
  const parts = [
    org.address_street,
    org.address_number,
    org.address_complement,
    org.address_city,
    org.address_state,
    org.address_zip,
  ].filter(Boolean);
  return parts.join(', ');
}

export function replaceVariables(text: string, context: VariableContext): string {
  if (!text) return text;
  
  let result = text;
  
  // Organization variables
  if (context.organization) {
    result = result.replace(/\{\{org_nome\}\}/g, context.organization.name || '');
    result = result.replace(/\{\{org_cnpj\}\}/g, formatCNPJ(context.organization.cnpj));
    result = result.replace(/\{\{org_razao_social\}\}/g, context.organization.legal_name || '');
    result = result.replace(/\{\{org_endereco\}\}/g, formatAddress(context.organization));
    result = result.replace(/\{\{org_cidade\}\}/g, context.organization.address_city || '');
    result = result.replace(/\{\{org_estado\}\}/g, context.organization.address_state || '');
    result = result.replace(/\{\{org_telefone\}\}/g, formatPhone(context.organization.phone));
    result = result.replace(/\{\{org_email\}\}/g, context.organization.email || '');
    result = result.replace(/\{\{org_website\}\}/g, context.organization.website || '');
  }
  
  // Account/Client variables
  if (context.account) {
    result = result.replace(/\{\{cliente_razao_social\}\}/g, context.account.razao_social || '');
    result = result.replace(/\{\{cliente_nome_fantasia\}\}/g, context.account.nome_fantasia || '');
    result = result.replace(/\{\{cliente_cnpj\}\}/g, formatCNPJ(context.account.cnpj));
    result = result.replace(/\{\{cliente_segmento\}\}/g, context.account.segmento || '');
    result = result.replace(/\{\{cliente_tamanho\}\}/g, context.account.tamanho || '');
  }
  
  // Contact variables
  if (context.contact) {
    result = result.replace(/\{\{contato_nome\}\}/g, context.contact.nome || '');
    result = result.replace(/\{\{contato_email\}\}/g, context.contact.emails?.[0] || '');
    result = result.replace(/\{\{contato_telefone\}\}/g, formatPhone(context.contact.telefones?.[0]));
    result = result.replace(/\{\{contato_cargo\}\}/g, context.contact.cargo || '');
  }
  
  // Proposal variables
  if (context.proposal) {
    result = result.replace(/\{\{proposta_titulo\}\}/g, context.proposal.title || '');
    result = result.replace(/\{\{proposta_numero\}\}/g, context.proposal.proposal_number || '[Número não definido]');
    result = result.replace(/\{\{proposta_versao\}\}/g, `v${context.proposal.proposal_version || 1}`);
    result = result.replace(/\{\{proposta_data\}\}/g, 
      context.proposal.created_at ? format(new Date(context.proposal.created_at), 'dd/MM/yyyy') : ''
    );
    result = result.replace(/\{\{proposta_validade\}\}/g, 
      context.proposal.expires_at ? format(new Date(context.proposal.expires_at), 'dd/MM/yyyy') : ''
    );
    result = result.replace(/\{\{proposta_total\}\}/g, formatCurrency(context.proposal.total_amount));
    result = result.replace(/\{\{proposta_moeda\}\}/g, context.proposal.currency || 'BRL');
  }
  
  // Owner/Seller variables
  if (context.owner) {
    result = result.replace(/\{\{vendedor_nome\}\}/g, context.owner.full_name || '');
    result = result.replace(/\{\{vendedor_email\}\}/g, context.owner.email || '');
    result = result.replace(/\{\{vendedor_telefone\}\}/g, formatPhone(context.owner.phone));
  }
  
  // Date/Time variables
  const now = new Date();
  result = result.replace(/\{\{data_hoje\}\}/g, format(now, 'dd/MM/yyyy'));
  result = result.replace(/\{\{data_hoje_extenso\}\}/g, 
    format(now, "dd 'de' MMMM 'de' yyyy", { locale: ptBR })
  );
  result = result.replace(/\{\{hora_atual\}\}/g, format(now, 'HH:mm'));
  
  return result;
}

export function getAllVariables(): string[] {
  return PROPOSAL_VARIABLES.flatMap(category => 
    Object.keys(category.variables)
  );
}

export function getVariableDescription(variable: string): string | undefined {
  for (const category of PROPOSAL_VARIABLES) {
    if (category.variables[variable]) {
      return category.variables[variable];
    }
  }
  return undefined;
}

export function hasVariables(text: string): boolean {
  return /\{\{[a-z_]+\}\}/.test(text);
}

export function extractVariables(text: string): string[] {
  const matches = text.match(/\{\{[a-z_]+\}\}/g);
  return matches ? [...new Set(matches)] : [];
}
