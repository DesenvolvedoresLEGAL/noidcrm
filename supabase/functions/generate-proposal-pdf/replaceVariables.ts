interface VariableContext {
  organization?: any;
  account?: any;
  contact?: any;
  proposal?: any;
  owner?: any;
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

function formatAddress(org?: any): string {
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

function formatDate(dateStr?: string): string {
  if (!dateStr) return '';
  const date = new Date(dateStr);
  return date.toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric'
  });
}

function formatDateExtended(dateStr?: string): string {
  if (!dateStr) return '';
  const date = new Date(dateStr);
  return date.toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: 'long',
    year: 'numeric'
  });
}

export function replaceVariables(text: string, context: VariableContext): string {
  if (!text) return text;
  
  let result = text;
  
  // Organization variables
  if (context.organization) {
    const org = context.organization;
    result = result.replace(/\{\{org_nome\}\}/g, org.name || '');
    result = result.replace(/\{\{org_cnpj\}\}/g, formatCNPJ(org.cnpj));
    result = result.replace(/\{\{org_razao_social\}\}/g, org.legal_name || '');
    result = result.replace(/\{\{org_endereco\}\}/g, formatAddress(org));
    result = result.replace(/\{\{org_cidade\}\}/g, org.address_city || '');
    result = result.replace(/\{\{org_estado\}\}/g, org.address_state || '');
    result = result.replace(/\{\{org_telefone\}\}/g, formatPhone(org.phone));
    result = result.replace(/\{\{org_email\}\}/g, org.email || '');
    result = result.replace(/\{\{org_website\}\}/g, org.website || '');
  }
  
  // Account/Client variables
  if (context.account) {
    const acc = context.account;
    result = result.replace(/\{\{cliente_razao_social\}\}/g, acc.razao_social || '');
    result = result.replace(/\{\{cliente_nome_fantasia\}\}/g, acc.nome_fantasia || '');
    result = result.replace(/\{\{cliente_cnpj\}\}/g, formatCNPJ(acc.cnpj));
    result = result.replace(/\{\{cliente_segmento\}\}/g, acc.segmento || '');
    result = result.replace(/\{\{cliente_tamanho\}\}/g, acc.tamanho || '');
  }
  
  // Contact variables
  if (context.contact) {
    const contact = context.contact;
    result = result.replace(/\{\{contato_nome\}\}/g, contact.nome || '');
    result = result.replace(/\{\{contato_email\}\}/g, contact.emails?.[0] || '');
    result = result.replace(/\{\{contato_telefone\}\}/g, formatPhone(contact.telefones?.[0]));
    result = result.replace(/\{\{contato_cargo\}\}/g, contact.cargo || '');
  }
  
  // Proposal variables
  if (context.proposal) {
    const prop = context.proposal;
    result = result.replace(/\{\{proposta_titulo\}\}/g, prop.title || '');
    result = result.replace(/\{\{proposta_numero\}\}/g, prop.id?.slice(0, 8).toUpperCase() || '');
    result = result.replace(/\{\{proposta_versao\}\}/g, String(prop.version || 1));
    result = result.replace(/\{\{proposta_data\}\}/g, formatDate(prop.created_at));
    result = result.replace(/\{\{proposta_validade\}\}/g, formatDate(prop.expires_at));
    result = result.replace(/\{\{proposta_total\}\}/g, formatCurrency(prop.total_amount));
    result = result.replace(/\{\{proposta_subtotal\}\}/g, formatCurrency(prop.subtotal));
  }
  
  // Owner/Seller variables
  if (context.owner) {
    const owner = context.owner;
    result = result.replace(/\{\{vendedor_nome\}\}/g, owner.full_name || '');
    result = result.replace(/\{\{vendedor_email\}\}/g, owner.email || '');
    result = result.replace(/\{\{vendedor_telefone\}\}/g, formatPhone(owner.phone));
  }
  
  // Date/Time variables
  const now = new Date();
  result = result.replace(/\{\{data_hoje\}\}/g, formatDate(now.toISOString()));
  result = result.replace(/\{\{data_hoje_extenso\}\}/g, formatDateExtended(now.toISOString()));
  result = result.replace(/\{\{hora_atual\}\}/g, 
    now.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
  );
  
  return result;
}
