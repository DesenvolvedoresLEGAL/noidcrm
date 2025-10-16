import { Lead, LeadListParams } from './types';

// Mock data - will be replaced with real API calls
const MOCK_LEADS: Lead[] = [
  {
    id: '1',
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
    status: 'qualified',
    origem: 'Indicação',
    fonte: 'Cliente Atual',
    intent_score: 95,
    fit_score: 85,
    assigned_to: 'user-2',
    created_at: new Date(Date.now() - 172800000).toISOString(),
    updated_at: new Date(Date.now() - 172800000).toISOString(),
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
