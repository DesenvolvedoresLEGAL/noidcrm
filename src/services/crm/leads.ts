import { Lead, LeadListParams } from './types';

// Mock data - will be replaced with real API calls
const MOCK_LEADS: Lead[] = [
  {
    id: '1',
    account_id: 'acc-lead-1',
    contact_id: 'contact-lead-1',
    status: 'new',
    origem: 'Website',
    fonte: 'Formulário Contato',
    intent_score: 75,
    fit_score: 80,
    assigned_to: 'user-1',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
  {
    id: '2',
    account_id: 'acc-lead-2',
    contact_id: 'contact-lead-2',
    status: 'contacted',
    origem: 'LinkedIn',
    fonte: 'InMail',
    intent_score: 60,
    fit_score: 90,
    assigned_to: 'user-1',
    created_at: new Date(Date.now() - 86400000).toISOString(),
    updated_at: new Date(Date.now() - 86400000).toISOString(),
  },
  {
    id: '3',
    account_id: 'acc-lead-3',
    contact_id: 'contact-lead-3',
    status: 'qualified',
    origem: 'Indicação',
    fonte: 'Cliente Atual',
    intent_score: 95,
    fit_score: 85,
    assigned_to: 'user-2',
    created_at: new Date(Date.now() - 172800000).toISOString(),
    updated_at: new Date(Date.now() - 172800000).toISOString(),
  },
  {
    id: '4',
    account_id: 'acc-lead-4',
    contact_id: 'contact-lead-4',
    status: 'new',
    origem: 'Google ADS',
    fonte: 'Campanha Performance Max',
    intent_score: 82,
    fit_score: 75,
    assigned_to: 'user-1',
    created_at: new Date(Date.now() - 43200000).toISOString(),
    updated_at: new Date(Date.now() - 43200000).toISOString(),
  },
  {
    id: '5',
    account_id: 'acc-lead-5',
    contact_id: 'contact-lead-5',
    status: 'contacted',
    origem: 'WhatsApp',
    fonte: 'Mensagem Direta',
    intent_score: 70,
    fit_score: 88,
    assigned_to: 'user-2',
    created_at: new Date(Date.now() - 259200000).toISOString(),
    updated_at: new Date(Date.now() - 86400000).toISOString(),
  },
  {
    id: '6',
    account_id: 'acc-lead-6',
    contact_id: 'contact-lead-6',
    status: 'disqualified',
    origem: 'Ligação',
    fonte: 'Cold Call',
    intent_score: 30,
    fit_score: 40,
    assigned_to: 'user-1',
    created_at: new Date(Date.now() - 604800000).toISOString(),
    updated_at: new Date(Date.now() - 432000000).toISOString(),
  },
  {
    id: '7',
    account_id: 'acc-lead-7',
    contact_id: 'contact-lead-7',
    status: 'qualified',
    origem: 'Evento',
    fonte: 'Feira Tech Summit 2024',
    intent_score: 88,
    fit_score: 92,
    assigned_to: 'user-2',
    created_at: new Date(Date.now() - 345600000).toISOString(),
    updated_at: new Date(Date.now() - 172800000).toISOString(),
  },
  {
    id: '8',
    account_id: 'acc-lead-8',
    contact_id: 'contact-lead-8',
    status: 'new',
    origem: 'Instagram',
    fonte: 'Anúncio Stories',
    intent_score: 65,
    fit_score: 70,
    assigned_to: 'user-1',
    created_at: new Date(Date.now() - 21600000).toISOString(),
    updated_at: new Date(Date.now() - 21600000).toISOString(),
  },
];

export async function listLeads(params: LeadListParams = {}): Promise<{ data: Lead[]; total: number }> {
  // Simulate API delay
  await new Promise(resolve => setTimeout(resolve, 300));
  
  let filtered = [...MOCK_LEADS];
  
  if (params.status) {
    filtered = filtered.filter(l => l.status === params.status);
  }
  
  if (params.source) {
    filtered = filtered.filter(l => l.origem === params.source);
  }
  
  if (params.q) {
    const query = params.q.toLowerCase();
    filtered = filtered.filter(l => 
      l.origem?.toLowerCase().includes(query) ||
      l.fonte?.toLowerCase().includes(query)
    );
  }
  
  return {
    data: filtered,
    total: filtered.length,
  };
}

export async function getLead(id: string): Promise<Lead | null> {
  await new Promise(resolve => setTimeout(resolve, 200));
  return MOCK_LEADS.find(l => l.id === id) || null;
}

export async function createLead(dto: Partial<Lead>): Promise<Lead> {
  await new Promise(resolve => setTimeout(resolve, 300));
  
  const newLead: Lead = {
    id: `lead-${Date.now()}`,
    status: 'new',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    ...dto,
  };
  
  MOCK_LEADS.push(newLead);
  return newLead;
}
