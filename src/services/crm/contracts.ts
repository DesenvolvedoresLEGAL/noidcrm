import { Contract } from './types';

// Mock data com contratos mais realistas
const mockContracts: Contract[] = [
  {
    id: 'ct-001',
    opportunityId: 'opp-001',
    clientName: 'Tech Solutions Brasil',
    clientEmail: 'contato@techsolutions.com.br',
    clientDocument: '12.345.678/0001-90',
    value: 120000,
    monthlyValue: 10000,
    startDate: '2024-01-15',
    endDate: '2025-01-14',
    signedDate: '2024-01-10',
    status: 'active',
    type: 'annual',
    renewalDate: '2025-01-14',
    autoRenewal: true,
    paymentMethod: 'bank_transfer',
    terms: 'Contrato de prestação de serviços de consultoria em TI',
    notes: 'Cliente prioritário com suporte 24/7',
    createdBy: 'João Silva',
    createdAt: '2024-01-05T10:00:00Z',
    updatedAt: '2024-01-10T14:30:00Z',
    created_at: '2024-01-05T10:00:00Z',
  },
  {
    id: 'ct-002',
    opportunityId: 'opp-002',
    clientName: 'Varejo Digital Ltda',
    clientEmail: 'admin@varejodigital.com',
    clientDocument: '98.765.432/0001-11',
    value: 36000,
    monthlyValue: 3000,
    startDate: '2024-03-01',
    endDate: '2025-02-28',
    signedDate: '2024-02-25',
    status: 'active',
    type: 'annual',
    renewalDate: '2025-02-28',
    autoRenewal: false,
    paymentMethod: 'credit_card',
    terms: 'Licença de software para e-commerce',
    createdBy: 'Maria Santos',
    createdAt: '2024-02-15T09:00:00Z',
    updatedAt: '2024-02-25T11:20:00Z',
    created_at: '2024-02-15T09:00:00Z',
  },
  {
    id: 'ct-003',
    opportunityId: 'opp-003',
    clientName: 'Indústria Alimentícia S.A.',
    clientEmail: 'compras@industriaalimentos.com',
    clientDocument: '11.222.333/0001-44',
    value: 8400,
    monthlyValue: 2800,
    startDate: '2024-10-01',
    endDate: '2024-12-31',
    signedDate: '2024-09-28',
    status: 'expiring',
    type: 'quarterly',
    renewalDate: '2024-12-31',
    autoRenewal: true,
    paymentMethod: 'bank_slip',
    terms: 'Contrato trimestral de manutenção de sistemas',
    notes: 'Renovação automática ativada',
    createdBy: 'Carlos Oliveira',
    createdAt: '2024-09-20T08:00:00Z',
    updatedAt: '2024-09-28T16:45:00Z',
    created_at: '2024-09-20T08:00:00Z',
  },
  {
    id: 'ct-004',
    opportunityId: 'opp-004',
    clientName: 'Startup Inovadora',
    clientEmail: 'ceo@startupinova.com',
    clientDocument: '22.333.444/0001-55',
    value: 15000,
    monthlyValue: 5000,
    startDate: '2024-06-01',
    endDate: '2024-08-31',
    status: 'expired',
    type: 'quarterly',
    renewalDate: '2024-08-31',
    autoRenewal: false,
    paymentMethod: 'pix',
    terms: 'Contrato piloto de implementação',
    notes: 'Cliente não renovou - migrou para concorrente',
    createdBy: 'Ana Costa',
    createdAt: '2024-05-15T10:00:00Z',
    updatedAt: '2024-09-01T09:00:00Z',
    created_at: '2024-05-15T10:00:00Z',
  },
  {
    id: 'ct-005',
    opportunityId: 'opp-005',
    clientName: 'Consultoria Empresarial',
    clientEmail: 'contato@consultoriaempresarial.com',
    clientDocument: '33.444.555/0001-66',
    value: 50000,
    startDate: '2024-11-15',
    endDate: '2024-12-15',
    status: 'pending',
    type: 'one-time',
    autoRenewal: false,
    paymentMethod: 'bank_transfer',
    terms: 'Projeto único de transformação digital',
    notes: 'Aguardando assinatura do diretor',
    createdBy: 'Pedro Lima',
    createdAt: '2024-11-10T14:00:00Z',
    updatedAt: '2024-11-12T10:30:00Z',
    created_at: '2024-11-10T14:00:00Z',
  },
  {
    id: 'ct-006',
    opportunityId: 'opp-006',
    clientName: 'E-commerce Fashion',
    clientEmail: 'ti@ecommercefashion.com',
    clientDocument: '44.555.666/0001-77',
    value: 18000,
    monthlyValue: 1500,
    startDate: '2023-12-01',
    endDate: '2024-11-30',
    signedDate: '2023-11-25',
    status: 'renewed',
    type: 'annual',
    renewalDate: '2024-11-30',
    autoRenewal: true,
    paymentMethod: 'credit_card',
    terms: 'Plataforma de gestão de estoque',
    notes: 'Renovado para 2025 com upgrade de plano',
    createdBy: 'João Silva',
    createdAt: '2023-11-15T09:00:00Z',
    updatedAt: '2024-11-15T11:00:00Z',
    created_at: '2023-11-15T09:00:00Z',
  },
  {
    id: 'ct-007',
    opportunityId: 'opp-007',
    clientName: 'Logística Express',
    clientEmail: 'financeiro@logisticaexpress.com',
    clientDocument: '55.666.777/0001-88',
    value: 2500,
    startDate: '2024-11-01',
    endDate: '2024-11-30',
    status: 'cancelled',
    type: 'monthly',
    autoRenewal: false,
    paymentMethod: 'bank_slip',
    terms: 'Serviço de rastreamento em tempo real',
    notes: 'Cancelado a pedido do cliente - problemas financeiros',
    createdBy: 'Maria Santos',
    createdAt: '2024-10-25T08:00:00Z',
    updatedAt: '2024-11-05T15:20:00Z',
    created_at: '2024-10-25T08:00:00Z',
  },
  {
    id: 'ct-008',
    opportunityId: 'opp-008',
    clientName: 'Universidade Digital',
    clientEmail: 'reitoria@universidadedigital.edu',
    clientDocument: '66.777.888/0001-99',
    value: 240000,
    monthlyValue: 20000,
    startDate: '2024-02-01',
    endDate: '2026-01-31',
    signedDate: '2024-01-20',
    status: 'active',
    type: 'annual',
    renewalDate: '2026-01-31',
    autoRenewal: true,
    paymentMethod: 'bank_transfer',
    terms: 'Plataforma EAD com 10.000 alunos',
    notes: 'Maior contrato da empresa - cliente estratégico',
    attachments: ['contrato_assinado.pdf', 'anexo_sla.pdf'],
    createdBy: 'Carlos Oliveira',
    createdAt: '2024-01-10T10:00:00Z',
    updatedAt: '2024-01-20T16:00:00Z',
    created_at: '2024-01-10T10:00:00Z',
  },
  {
    id: 'ct-009',
    opportunityId: 'opp-009',
    clientName: 'Clínica Médica São Paulo',
    clientEmail: 'admin@clinicasp.com.br',
    clientDocument: '77.888.999/0001-00',
    value: 7200,
    monthlyValue: 2400,
    startDate: '2024-09-01',
    endDate: '2024-11-30',
    signedDate: '2024-08-28',
    status: 'expiring',
    type: 'quarterly',
    renewalDate: '2024-11-30',
    autoRenewal: false,
    paymentMethod: 'pix',
    terms: 'Sistema de gestão de prontuários',
    notes: 'Em negociação para renovação anual',
    createdBy: 'Ana Costa',
    createdAt: '2024-08-20T09:00:00Z',
    updatedAt: '2024-11-10T14:00:00Z',
    created_at: '2024-08-20T09:00:00Z',
  },
  {
    id: 'ct-010',
    opportunityId: 'opp-010',
    clientName: 'Construção e Engenharia',
    clientEmail: 'contato@construtora.com',
    clientDocument: '88.999.000/0001-11',
    value: 25000,
    startDate: '2024-12-01',
    endDate: '2025-02-28',
    status: 'draft',
    type: 'quarterly',
    autoRenewal: false,
    paymentMethod: 'bank_transfer',
    terms: 'Software de gestão de obras',
    notes: 'Minuta em revisão jurídica',
    createdBy: 'Pedro Lima',
    createdAt: '2024-11-20T10:00:00Z',
    updatedAt: '2024-11-20T10:00:00Z',
    created_at: '2024-11-20T10:00:00Z',
  },
];

export const listContracts = async (): Promise<Contract[]> => {
  await new Promise(resolve => setTimeout(resolve, 500));
  return mockContracts;
};

export const getContract = async (id: string): Promise<Contract | null> => {
  await new Promise(resolve => setTimeout(resolve, 300));
  return mockContracts.find(c => c.id === id) || null;
};

export const createContract = async (contract: Omit<Contract, 'id' | 'createdAt' | 'updatedAt' | 'created_at'>): Promise<Contract> => {
  await new Promise(resolve => setTimeout(resolve, 500));
  const timestamp = new Date().toISOString();
  const newContract: Contract = {
    ...contract,
    id: `ct-${Date.now()}`,
    createdAt: timestamp,
    updatedAt: timestamp,
    created_at: timestamp,
  };
  mockContracts.push(newContract);
  return newContract;
};

export const updateContract = async (id: string, updates: Partial<Contract>): Promise<Contract> => {
  await new Promise(resolve => setTimeout(resolve, 500));
  const index = mockContracts.findIndex(c => c.id === id);
  if (index === -1) throw new Error('Contract not found');
  
  mockContracts[index] = {
    ...mockContracts[index],
    ...updates,
    updatedAt: new Date().toISOString(),
  };
  return mockContracts[index];
};

export const deleteContract = async (id: string): Promise<void> => {
  await new Promise(resolve => setTimeout(resolve, 300));
  const index = mockContracts.findIndex(c => c.id === id);
  if (index !== -1) {
    mockContracts.splice(index, 1);
  }
};

export const getContractStats = async () => {
  await new Promise(resolve => setTimeout(resolve, 300));
  
  const active = mockContracts.filter(c => c.status === 'active');
  const expiring = mockContracts.filter(c => c.status === 'expiring');
  const pending = mockContracts.filter(c => c.status === 'pending');
  const expired = mockContracts.filter(c => c.status === 'expired');
  
  const totalValue = active.reduce((sum, c) => sum + c.value, 0);
  const mrr = active.reduce((sum, c) => sum + (c.monthlyValue || 0), 0);
  
  const renewalRate = mockContracts.filter(c => c.status === 'renewed').length / 
    (mockContracts.filter(c => c.status === 'expired' || c.status === 'renewed').length || 1);
  
  return {
    total: mockContracts.length,
    active: active.length,
    expiring: expiring.length,
    pending: pending.length,
    expired: expired.length,
    cancelled: mockContracts.filter(c => c.status === 'cancelled').length,
    renewed: mockContracts.filter(c => c.status === 'renewed').length,
    totalValue,
    mrr,
    renewalRate: renewalRate * 100,
    avgContractValue: totalValue / (active.length || 1),
  };
};
